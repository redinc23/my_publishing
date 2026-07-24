#!/usr/bin/env python3
"""
tools/copilot_deep_dive.py

Generate a single paste-ready markdown file for Copilot Chat that forces a repo-wide,
bug-focused deep dive and aims for minimal, high-confidence fixes.

Usage:
  python tools/copilot_deep_dive.py
  python tools/copilot_deep_dive.py --run
  python tools/copilot_deep_dive.py --run --max-tree-lines 600 --max-cmd-output 4000
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Optional, Tuple


EXCLUDE_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".idea",
    ".vscode",
    "dist",
    "build",
    "target",
    "out",
    ".next",
    ".nuxt",
    ".cache",
    ".gradle",
    ".terraform",
    ".cargo",
}
EXCLUDE_FILE_NAMES = {
    ".DS_Store",
}
MAX_FILE_SIZE_BYTES = 512_000  # avoid pasting huge files


@dataclass(frozen=True)
class CmdResult:
    cmd: str
    rc: int
    out: str


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for _ in range(60):
        if (cur / ".git").exists():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    raise SystemExit("Not inside a git repo (could not find .git). Run from within your repo.")


def run_cmd(
    cmd: List[str],
    cwd: Path,
    timeout_s: int,
    max_output_chars: int,
) -> CmdResult:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout_s,
            check=False,
        )
        out = proc.stdout or ""
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or "") + "\n\n[Timed out]\n"
        return CmdResult(cmd=" ".join(map(shlex.quote, cmd)), rc=124, out=out[:max_output_chars])

    out = out.strip("\n")
    if len(out) > max_output_chars:
        out = out[:max_output_chars] + "\n\n[...truncated...]\n"
    return CmdResult(cmd=" ".join(map(shlex.quote, cmd)), rc=proc.returncode, out=out)


def iter_repo_tree(root: Path) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dpath = Path(dirpath)
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIR_NAMES and not d.startswith(".git")]
        for fn in filenames:
            if fn in EXCLUDE_FILE_NAMES:
                continue
            yield dpath / fn


def safe_relpath(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def detect_project_markers(root: Path) -> List[str]:
    markers = [
        "pyproject.toml",
        "requirements.txt",
        "Pipfile",
        "poetry.lock",
        "setup.py",
        "package.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "package-lock.json",
        "tsconfig.json",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "Makefile",
        "CMakeLists.txt",
        "composer.json",
        "Gemfile",
        "mix.exs",
        "deno.json",
    ]
    found: List[str] = []
    for m in markers:
        if (root / m).exists():
            found.append(m)
    return found


def propose_test_commands(markers: List[str]) -> List[List[str]]:
    cmds: List[List[str]] = []

    if "pyproject.toml" in markers or "requirements.txt" in markers or "setup.py" in markers:
        cmds.append(["python", "-m", "pytest", "-q"])
        cmds.append(["python", "-m", "pytest", "-q", "-x"])

    if "package.json" in markers:
        cmds.append(["npm", "test", "--silent"])
        cmds.append(["npm", "run", "-s", "test"])

    if "pnpm-lock.yaml" in markers:
        cmds.append(["pnpm", "test"])

    if "yarn.lock" in markers:
        cmds.append(["yarn", "test"])

    if "go.mod" in markers:
        cmds.append(["go", "test", "./..."])

    if "Cargo.toml" in markers:
        cmds.append(["cargo", "test", "-q"])

    if "pom.xml" in markers:
        cmds.append(["mvn", "-q", "test"])

    if "build.gradle" in markers or "build.gradle.kts" in markers:
        cmds.append(["./gradlew", "test"])

    if "Makefile" in markers:
        cmds.append(["make", "test"])

    # de-dupe while preserving order
    seen = set()
    uniq: List[List[str]] = []
    for c in cmds:
        key = tuple(c)
        if key not in seen:
            seen.add(key)
            uniq.append(c)
    return uniq[:6]


def extract_failure_highlights(output: str, max_lines: int = 80) -> str:
    if not output.strip():
        return ""

    lines = output.splitlines()

    # Prefer common failure anchors.
    anchors = [
        r"^=+ FAILURES =+$",
        r"^FAILED\b",
        r"^FAIL\b",
        r"^Error:",
        r"^Traceback \(most recent call last\):",
        r"^\s*at\s.+\(.+:\d+:\d+\)",
        r"^panic:",
        r"^\[ERROR\]",
        r"^E\s+",
    ]
    anchor_re = re.compile("|".join(f"(?:{a})" for a in anchors))

    idxs = [i for i, ln in enumerate(lines) if anchor_re.search(ln)]
    if not idxs:
        # fallback: tail
        tail = lines[-max_lines:]
        return "\n".join(tail)

    start = max(0, idxs[0] - 8)
    end = min(len(lines), start + max_lines)
    return "\n".join(lines[start:end])


def format_section(title: str, body: str) -> str:
    body = body.strip()
    if not body:
        body = "_(empty)_"
    return f"## {title}\n\n```\n{body}\n```\n"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="store_true", help="Run heuristic tests/checks and include output.")
    ap.add_argument("--timeout", type=int, default=180, help="Per-command timeout seconds when --run.")
    ap.add_argument("--max-tree-lines", type=int, default=500, help="Max repo tree lines.")
    ap.add_argument("--max-cmd-output", type=int, default=5000, help="Max chars captured per command.")
    ap.add_argument("--out", default="COPILOT_DEEP_DIVE.md", help="Output markdown filename.")
    args = ap.parse_args()

    repo_root = find_repo_root(Path.cwd())
    markers = detect_project_markers(repo_root)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"# Copilot Deep Dive Packet\n\nGenerated: {now}\nRepo root: `{repo_root}`\n\n"

    quantum_prompt = f"""# QUANTUM STATUS (grounded, not myth)

You are Copilot acting as a **repo-diving debugger**.
Goal: make the “solution” be **as few bugs as possible** (minimal diffs, maximal certainty).

Non-negotiables:
- Read the repo inventory below. Do not guess.
- Reproduce failures (or explain why you can't) using the included command outputs.
- Prefer **small, surgical fixes** over refactors.
- Fix root-cause, not symptoms.
- If you change behavior, add/adjust the smallest test that locks it.
- Output:
  1) The **1–3 most likely root causes** (ranked).
  2) Exact file/line targets.
  3) Minimal patch plan.
  4) Patch (diff format).
  5) Rerun commands and expected passing output.

If nothing is clearly broken:
- Say so explicitly.
- Propose the single smallest hardening change (optional), or do nothing.

Project markers detected: {", ".join(markers) if markers else "(none)"}.
"""

    # Git context
    git_sections: List[Tuple[str, CmdResult]] = []
    git_sections.append(("git status", run_cmd(["git", "status", "--porcelain=v1", "-b"], repo_root, 30, args.max_cmd_output)))
    git_sections.append(("git diff (staged+unstaged)", run_cmd(["git", "diff"], repo_root, 60, args.max_cmd_output)))
    git_sections.append(("git diff --staged", run_cmd(["git", "diff", "--staged"], repo_root, 60, args.max_cmd_output)))
    git_sections.append(("recent commits", run_cmd(["git", "log", "-n", "20", "--oneline", "--decorate"], repo_root, 30, args.max_cmd_output)))

    # Repo tree snapshot (filtered)
    rel_paths: List[str] = []
    for p in iter_repo_tree(repo_root):
        try:
            if p.is_symlink():
                continue
            if p.stat().st_size > MAX_FILE_SIZE_BYTES:
                continue
        except OSError:
            continue
        rel_paths.append(safe_relpath(p, repo_root))

    rel_paths.sort()
    tree_lines = rel_paths[: args.max_tree_lines]
    if len(rel_paths) > args.max_tree_lines:
        tree_lines.append(f"... ({len(rel_paths) - args.max_tree_lines} more files omitted)")

    # Optional run commands
    run_sections: List[str] = []
    if args.run:
        cmds = propose_test_commands(markers)
        if not cmds:
            cmds = [
                ["python", "-m", "pytest", "-q"],
                ["npm", "test", "--silent"],
                ["make", "test"],
            ]

        for c in cmds:
            res = run_cmd(c, repo_root, args.timeout, args.max_cmd_output)
            highlight = extract_failure_highlights(res.out)
            run_sections.append(
                f"## Run: `{res.cmd}` (rc={res.rc})\n\n"
                f"### Highlights\n\n```\n{highlight or '(no output)'}\n```\n\n"
                f"### Full captured output\n\n```\n{res.out or '(no output)'}\n```\n"
            )

    # Write output
    out_path = repo_root / args.out
    parts: List[str] = [header, quantum_prompt, "\n---\n\n"]

    parts.append("## Repo inventory (filtered)\n\n```\n" + "\n".join(tree_lines) + "\n```\n\n")

    for title, res in git_sections:
        parts.append(format_section(title, res.out))

    if args.run:
        parts.append("\n# Command runs\n\n" + "\n\n".join(run_sections))

    parts.append(
        "\n---\n\n"
        "## Copilot instructions for response format\n\n"
        "Respond in this exact skeleton:\n\n"
        "1. **Root causes (ranked)**\n"
        "2. **Evidence** (cite repo files + command output snippets)\n"
        "3. **Minimal patch plan**\n"
        "4. **Diff** (`git diff` style)\n"
        "5. **Rerun checklist** (commands + expected pass)\n"
    )

    out_path.write_text("".join(parts), encoding="utf-8")

    print(f"Wrote: {out_path}")
    print("\nNext step:")
    print(f"1) Open {args.out}")
    print("2) Paste entire contents into Copilot Chat (or Copilot Workspace/Agent).")
    if not args.run:
        print("3) If you want harder evidence, rerun with: --run")


if __name__ == "__main__":
    main()
