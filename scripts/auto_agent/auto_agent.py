"""
Auto Agent (diff generator)

Generates a unified diff for a task using OpenAI API, then writes it to disk.
This script does NOT apply changes; the workflow applies with `git apply`.

Usage:
  python auto_agent.py --task "/auto fix the failing test ..." --repo-root . --out-diff /tmp/auto.patch

Security posture:
- Sends a curated subset of repo context (file list + select file contents).
- Never reads .git, secrets, env files by default.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import pathlib
import re
import sys
from dataclasses import dataclass
from typing import Iterable, List, Sequence, Tuple

import requests


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


DEFAULT_EXCLUDE_DIRS = {
    ".git",
    ".github",  # keep workflows out of scope unless explicitly asked
    "node_modules",
    "dist",
    "build",
    ".next",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".turbo",
    "coverage",
}

DEFAULT_EXCLUDE_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.example",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}

# Paths that should never be modified
DANGEROUS_PATHS = {
    ".github/workflows/",
    ".env",
    ".secret",
    "secrets/",
    "config/secrets",
    ".vault",
    "id_rsa",
    ".pem",
    ".key",
}


DIFF_HEADER_RE = re.compile(r"^(diff --git a/.* b/.*)$", re.MULTILINE)


@dataclass(frozen=True)
class RepoContext:
    file_paths: List[str]
    sampled_files: List[Tuple[str, str]]  # (path, content)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate unified diff via OpenAI API.")
    p.add_argument("--task", required=True, help="Task text, e.g. '/auto add unit tests for X'")
    p.add_argument("--repo-root", required=True, help="Path to repository root")
    p.add_argument("--out-diff", required=True, help="Where to write the unified diff")
    p.add_argument("--model", default="gpt-4o", help="OpenAI model name")
    p.add_argument(
        "--file-globs",
        default="**/*.py,**/*.ts,**/*.js,**/*.md,README*",
        help="Comma-separated glob patterns relative to repo root",
    )
    p.add_argument("--max-files", type=int, default=250, help="Max candidate files to include in file list")
    p.add_argument("--max-sampled-files", type=int, default=20, help="Max files to include with contents")
    p.add_argument("--max-bytes-per-file", type=int, default=40_000, help="Max bytes read per sampled file")
    return p.parse_args()


def _iter_repo_files(repo_root: pathlib.Path) -> Iterable[pathlib.Path]:
    for path in repo_root.rglob("*"):
        if path.is_dir():
            continue
        rel_parts = path.relative_to(repo_root).parts
        if any(part in DEFAULT_EXCLUDE_DIRS for part in rel_parts):
            continue
        if path.name in DEFAULT_EXCLUDE_FILES:
            continue
        yield path


def _matches_any_glob(rel_path: str, globs: Sequence[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, g.strip()) for g in globs if g.strip())


def _read_text_file(path: pathlib.Path, max_bytes: int) -> str:
    try:
        data = path.read_bytes()[:max_bytes]
        return data.decode("utf-8", errors="replace")
    except Exception:
        return ""


def _build_context(
    repo_root: pathlib.Path,
    file_globs: Sequence[str],
    max_files: int,
    max_sampled_files: int,
    max_bytes_per_file: int,
) -> RepoContext:
    candidates: List[str] = []
    for p in _iter_repo_files(repo_root):
        rel = str(p.relative_to(repo_root)).replace("\\", "/")
        if _matches_any_glob(rel, file_globs):
            candidates.append(rel)
            if len(candidates) >= max_files:
                break

    # Sample a few high-signal files (README + manifests + small code files)
    priority_names = (
        "README.md",
        "README.mdx",
        "pyproject.toml",
        "requirements.txt",
        "requirements-dev.txt",
        "package.json",
        "tsconfig.json",
        "Makefile",
    )

    sampled: List[Tuple[str, str]] = []
    # 1) priority files first if present
    for name in priority_names:
        p = repo_root / name
        if p.exists() and p.is_file():
            content = _read_text_file(p, max_bytes_per_file)
            if content.strip():
                sampled.append((name, content))
                if len(sampled) >= max_sampled_files:
                    return RepoContext(file_paths=candidates, sampled_files=sampled)

    # 2) then top of candidate list
    for rel in candidates:
        if len(sampled) >= max_sampled_files:
            break
        if rel in [s[0] for s in sampled]:
            continue
        p = repo_root / rel
        if not p.exists():
            continue
        text = _read_text_file(p, max_bytes_per_file)
        if text.strip():
            sampled.append((rel, text))

    return RepoContext(file_paths=candidates, sampled_files=sampled)


def _require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def _extract_task(task_text: str) -> str:
    """Extract the actual task from '/auto ...' command."""
    stripped = task_text.strip()
    if stripped.lower().startswith("/auto"):
        return stripped[len("/auto"):].strip()
    return stripped


def _ensure_unified_diff(text: str) -> str:
    """Validate and clean the diff output."""
    if not text:
        raise ValueError("Model output was empty.")

    # Try to extract diff from markdown code blocks if present
    code_block_match = re.search(r"```(?:diff)?\n(.*?)```", text, re.DOTALL)
    if code_block_match:
        text = code_block_match.group(1)

    if not DIFF_HEADER_RE.search(text):
        raise ValueError(
            "Model output did not look like a unified diff (missing 'diff --git' headers).\n"
            f"Output preview: {text[:500]}"
        )
    return text.strip() + "\n"


def _openai_generate_diff(*, api_key: str, model: str, task: str, context: RepoContext) -> str:
    """Call OpenAI Chat API to generate a unified diff."""

    system_prompt = """You are a senior software engineer. Your task is to generate code changes as a unified git diff.

CRITICAL RULES:
1. Return ONLY a unified git diff that applies cleanly with `git apply`
2. Do NOT include any prose, explanations, or markdown fences
3. Start your response with `diff --git a/...`
4. Do NOT modify files in .github/workflows/ unless explicitly asked
5. Do NOT add secrets, API keys, tokens, or credentials
6. Do NOT fetch or download remote code
7. Make minimal, targeted changes - avoid unnecessary refactoring
8. Add tests when appropriate for the changes made
9. Follow the existing code style and conventions

OUTPUT FORMAT:
Your entire response must be a valid unified diff starting with:
diff --git a/path/to/file b/path/to/file
--- a/path/to/file
+++ b/path/to/file
@@ -line,count +line,count @@
 context line
-removed line
+added line
 context line"""

    # Build user message with context
    files_summary = "\n".join(f"- {p}" for p in context.file_paths[:100])
    if len(context.file_paths) > 100:
        files_summary += f"\n... and {len(context.file_paths) - 100} more files"

    sampled_content = ""
    for path, content in context.sampled_files:
        # Truncate very large files for the prompt
        truncated = content[:15000]
        if len(content) > 15000:
            truncated += "\n... (truncated)"
        sampled_content += f"\n\n=== FILE: {path} ===\n{truncated}"

    user_message = f"""TASK: {task}

REPOSITORY FILES:
{files_summary}

SAMPLED FILE CONTENTS:{sampled_content}

Generate a unified diff to accomplish the task. Remember: output ONLY the diff, starting with `diff --git`."""

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
        "max_tokens": 8000,
    }

    print(f"Calling OpenAI API with model: {model}")
    print(f"Task: {task}")
    print(f"Context: {len(context.file_paths)} files, {len(context.sampled_files)} sampled")

    resp = requests.post(
        OPENAI_CHAT_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=300,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"OpenAI API error: {resp.status_code} - {resp.text}")

    data = resp.json()

    # Extract the response content
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected API response structure: {e}\nResponse: {data}")

    return _ensure_unified_diff(content)


def main() -> int:
    args = _parse_args()
    repo_root = pathlib.Path(args.repo_root).resolve()

    task = _extract_task(args.task)
    if not task:
        raise ValueError("Empty task after '/auto' - please provide a description of what to do")

    print(f"Processing task: {task}")

    globs = [g.strip() for g in str(args.file_globs).split(",") if g.strip()]
    context = _build_context(
        repo_root=repo_root,
        file_globs=globs,
        max_files=args.max_files,
        max_sampled_files=args.max_sampled_files,
        max_bytes_per_file=args.max_bytes_per_file,
    )

    print(f"Built context: {len(context.file_paths)} candidate files, {len(context.sampled_files)} sampled")

    api_key = _require_env("OPENAI_API_KEY")
    diff_text = _openai_generate_diff(
        api_key=api_key,
        model=args.model,
        task=task,
        context=context,
    )

    out_path = pathlib.Path(args.out_diff)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(diff_text, encoding="utf-8")

    # Print preview
    lines = diff_text.split("\n")
    print(f"\nGenerated diff ({len(lines)} lines):")
    print("-" * 40)
    for line in lines[:30]:
        print(line)
    if len(lines) > 30:
        print(f"... ({len(lines) - 30} more lines)")
    print("-" * 40)

    print(f"\nWrote diff to {out_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        raise SystemExit(1)
