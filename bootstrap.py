"""Dependency Upgrade PR Agent (Python).

Writes a complete repo scaffold that implements:
scan -> plan -> apply -> validate -> patch(loop) -> package -> gate

Run:
  python bootstrap.py
  make agent-venv
  make run PKG=<package>
"""

from __future__ import annotations

from pathlib import Path

REQUIREMENTS_TXT = """\
packaging>=24.0
PyYAML>=6.0
ruff>=0.5.0
pyupgrade>=3.15.0
pytest>=8.0.0
mypy>=1.10.0
"""

AGENT_YAML = """\
python_version: "3.11"
resolver:
  primary: pip
  fallback: uv
ci_profile:
  commands:
    - "ruff --fix ."
    - "pytest -q"
    - "mypy ."
policy:
  allow_major_bump: false
  allowed_licenses: ["MIT","BSD","Apache-2.0","GPL-3.0","LGPL-3.0"]
patch_loop_max_iterations: 3
limits:
  max_wall_clock_minutes: 45
  max_diff_files: 40
pr:
  title_template: "chore(deps): bump {{name}} {{from}} -> {{to}}"
  labels: ["dependencies","safe-to-review"]
artifacts_dir: ".agent/artifacts"
runs_db: ".agent/runs.sqlite"
venv_dir: ".agent/.venv"
"""

README_MD = """\
# Dependency Upgrade PR Agent (Python)

A deterministic, auditable single-dependency upgrade loop:

`scan -> plan -> apply -> validate -> patch(loop) -> package -> gate`

## Quickstart

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt

# Run inside a target repo you want to upgrade (must have pyproject.toml / PEP 621).
python -m agent.cli --repo . --package <PACKAGE> [--target <VERSION>]
```

Artifacts are written to `.agent/artifacts/` (diff, reports, PR payload JSON).
No network writes / PR creation occurs automatically.

### Notes

* Uses a sandbox venv at `.agent/.venv`.
* Uses `pip index versions` to discover published versions when `--target` is omitted.
* Gates: `ruff --fix .`, `pytest -q`, `mypy .` (configurable via agent.yaml).
* Patch loop is bounded (default N=3).

### Human gate

After reviewing `.agent/artifacts/pr_payload.json` and `diff.patch`, you can open a PR manually.
A helper script is provided: `scripts/approve_and_open_pr.sh`.
"""

MAKEFILE_TXT = """\
.PHONY: agent-venv run approve

agent-venv:
\tpython -m venv .agent/.venv
\t.agent/.venv/bin/pip install -U pip wheel
\t.agent/.venv/bin/pip install -r requirements.txt

run:
\t.agent/.venv/bin/python -m agent.cli --repo . --package $(PKG)

approve:
\tbash scripts/approve_and_open_pr.sh
"""

APPROVE_SH = """\
#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI not found. Install GitHub CLI first."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found. Install jq first."
  exit 1
fi

PAYLOAD=".agent/artifacts/pr_payload.json"
if [[ ! -f "$PAYLOAD" ]]; then
  echo "ERROR: $PAYLOAD not found. Run the agent first."
  exit 1
fi

TITLE="$(jq -r '.pr.title' "$PAYLOAD")"
BODY="$(jq -r '.pr.body' "$PAYLOAD")"
LABELS="$(jq -r '.pr.labels | join(",")' "$PAYLOAD")"

gh pr create --title "$TITLE" --body "$BODY" --label "$LABELS"
"""

AGENT_INIT_PY = '''\
"""Dependency Upgrade PR Agent (Python).

Implements a deterministic upgrade workflow:
scan -> plan -> apply -> validate -> patch(loop) -> package -> gate
"""

__all__ = ["cli"]
'''

MODELS_PY = '''\
"""Typed models for plan + PR payload."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal


@dataclass(frozen=True)
class UpgradePlan:
    package: str
    from_version: str
    to_version: str
    commands: list[str]
    risk_notes: list[str] = field(default_factory=list)
    breaking_api_patterns: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PRPayload:
    title: str
    body: str
    labels: list[str]


@dataclass
class RunContext:
    repo_root: str
    package_name: str
    requested_version: str | None

    selected_version: str | None = None
    current_version: str | None = None
    dep_file: str | None = None

    commands: list[str] = field(default_factory=list)

    status: Literal["ok", "failed_safe"] | None = None
    failed_safe_reason: str | None = None
    iterations: int = 0

    artifacts_dir: str = ".agent/artifacts"
    runs_db: str = ".agent/runs.sqlite"
    venv_dir: str = ".agent/.venv"

    data: dict[str, Any] = field(default_factory=dict)
'''

CONFIG_PY = '''\
"""Config loader for agent.yaml."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class AgentConfig:
    python_version: str
    ci_commands: list[str]
    allow_major_bump: bool
    allowed_licenses: list[str]
    patch_loop_max_iterations: int
    max_wall_clock_minutes: int
    max_diff_files: int
    pr_title_template: str
    pr_labels: list[str]
    artifacts_dir: str
    runs_db: str
    venv_dir: str

    @staticmethod
    def load(path: str = "agent.yaml") -> "AgentConfig":
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Missing {path}. Create it from the scaffold.")

        raw: dict[str, Any] = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        ci_commands = list((raw.get("ci_profile") or {}).get("commands") or [])
        policy = raw.get("policy") or {}
        limits = raw.get("limits") or {}
        pr = raw.get("pr") or {}

        return AgentConfig(
            python_version=str(raw.get("python_version", "3.11")),
            ci_commands=ci_commands or ["ruff --fix .", "pytest -q", "mypy ."],
            allow_major_bump=bool(policy.get("allow_major_bump", False)),
            allowed_licenses=list(policy.get("allowed_licenses") or []),
            patch_loop_max_iterations=int(raw.get("patch_loop_max_iterations", 3)),
            max_wall_clock_minutes=int(limits.get("max_wall_clock_minutes", 45)),
            max_diff_files=int(limits.get("max_diff_files", 40)),
            pr_title_template=str(
                pr.get("title_template", "chore(deps): bump {{name}} {{from}} -> {{to}}")
            ),
            pr_labels=list(pr.get("labels") or ["dependencies", "safe-to-review"]),
            artifacts_dir=str(raw.get("artifacts_dir", ".agent/artifacts")),
            runs_db=str(raw.get("runs_db", ".agent/runs.sqlite")),
            venv_dir=str(raw.get("venv_dir", ".agent/.venv")),
        )
'''

RUN_DB_PY = '''\
"""SQLite run-state persistence (one DB per repo)."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any

from agent.models import RunContext

SCHEMA = r"""
CREATE TABLE IF NOT EXISTS runs(
  id TEXT PRIMARY KEY,
  repo_path TEXT,
  branch_base TEXT,
  package_name TEXT,
  requested_version TEXT,
  selected_version TEXT,
  policy_json TEXT,
  ci_profile_json TEXT,
  start_ts TEXT,
  end_ts TEXT,
  status TEXT CHECK(status IN ('ok','failed_safe')),
  iterations INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  step TEXT,
  attempt_no INTEGER,
  cmd TEXT,
  exit_code INTEGER,
  stdout_path TEXT,
  stderr_path TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS artifacts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  kind TEXT,
  path TEXT,
  sha256 TEXT
);
"""


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


class RunDB:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def create_run(
        self,
        run_id: str,
        ctx: RunContext,
        policy: dict[str, Any],
        ci_profile: dict[str, Any],
        start_ts: str,
        branch_base: str = "main",
    ) -> None:
        self._conn.execute(
            "INSERT INTO runs(id, repo_path, branch_base, package_name, requested_version, "
            "selected_version, policy_json, ci_profile_json, start_ts, status, iterations) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                run_id,
                ctx.repo_root,
                branch_base,
                ctx.package_name,
                ctx.requested_version,
                ctx.selected_version,
                json.dumps(policy, ensure_ascii=False),
                json.dumps(ci_profile, ensure_ascii=False),
                start_ts,
                None,
                0,
            ),
        )
        self._conn.commit()

    def finalize_run(self, run_id: str, ctx: RunContext, end_ts: str) -> None:
        self._conn.execute(
            "UPDATE runs SET selected_version=?, end_ts=?, status=?, iterations=? WHERE id=?",
            (ctx.selected_version, end_ts, ctx.status, ctx.iterations, run_id),
        )
        self._conn.commit()

    def log_attempt(
        self,
        run_id: str,
        step: str,
        attempt_no: int,
        cmd: str,
        exit_code: int,
        stdout_path: str,
        stderr_path: str,
        created_at: str,
    ) -> None:
        self._conn.execute(
            "INSERT INTO attempts(run_id, step, attempt_no, cmd, exit_code, stdout_path, "
            "stderr_path, created_at) VALUES(?,?,?,?,?,?,?,?)",
            (run_id, step, attempt_no, cmd, exit_code, stdout_path, stderr_path, created_at),
        )
        self._conn.commit()

    def log_artifact(self, run_id: str, kind: str, path: str) -> str:
        sha = sha256_file(path)
        self._conn.execute(
            "INSERT INTO artifacts(run_id, kind, path, sha256) VALUES(?,?,?,?)",
            (run_id, kind, path, sha),
        )
        self._conn.commit()
        return sha
'''

TOOLS_PY = '''\
"""Thin wrappers for shell tools: git, pip, pytest, ruff, mypy, rg."""
from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from packaging.requirements import Requirement
from packaging.version import Version


@dataclass(frozen=True)
class CmdResult:
    cmd: str
    returncode: int
    stdout: str
    stderr: str


def run_cmd(
    cmd: str,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    timeout_s: int | None = None,
) -> CmdResult:
    p = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout_s,
    )
    return CmdResult(cmd=cmd, returncode=p.returncode, stdout=p.stdout, stderr=p.stderr)


def ensure_dirs(*paths: str) -> None:
    for p in paths:
        Path(p).mkdir(parents=True, exist_ok=True)


def venv_bin(venv_dir: str, exe: str) -> str:
    return str(Path(venv_dir) / "bin" / exe)


def venv_env(venv_dir: str) -> dict[str, str]:
    env = dict(os.environ)
    bin_dir = str(Path(venv_dir) / "bin")
    env["VIRTUAL_ENV"] = str(Path(venv_dir).resolve())
    env["PATH"] = bin_dir + os.pathsep + env.get("PATH", "")
    return env


def parse_pip_index_versions(output: str) -> list[Version]:
    m = re.search(r"Available versions:\\s*(.+)", output)
    if not m:
        return []
    raw = m.group(1)
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    versions: list[Version] = []
    for p in parts:
        try:
            versions.append(Version(p))
        except Exception:
            continue
    return versions


def find_requirement_in_list(
    reqs: list[str], package: str
) -> tuple[int, Requirement] | None:
    for i, s in enumerate(reqs):
        try:
            r = Requirement(s)
        except Exception:
            continue
        if r.name.lower() == package.lower():
            return i, r
    return None


def format_requirement_with_new_version(req: Requirement, new_version: str) -> str:
    base = req.name
    if req.extras:
        base += "[" + ",".join(sorted(req.extras)) + "]"

    # Use == to pin exact version, avoiding issues with compound specifiers
    # (e.g., >=2.0,<3.0 would lose the upper bound if we only preserved the first operator)
    out = f"{base}=={new_version}"
    if req.marker:
        out += f"; {req.marker}"
    return out


def git_diff_patch(cwd: str, out_path: str) -> None:
    res = run_cmd("git diff", cwd=cwd)
    Path(out_path).write_text(res.stdout, encoding="utf-8")


def git_current_branch(cwd: str) -> str:
    r = run_cmd("git rev-parse --abbrev-ref HEAD", cwd=cwd)
    return r.stdout.strip() if r.returncode == 0 else "unknown"
'''

REPO_OPS_PY = '''\
"""Repo scanning + pyproject update logic (PEP 621)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import tomllib  # py311+
except Exception:  # pragma: no cover
    import tomli as tomllib  # type: ignore

from agent.tools import find_requirement_in_list, format_requirement_with_new_version


@dataclass(frozen=True)
class PyProjectDeps:
    path: Path
    raw: dict[str, Any]
    project_deps: list[str]
    optional_deps: dict[str, list[str]]


def load_pyproject(path: str) -> PyProjectDeps:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError("pyproject.toml required")

    raw = tomllib.loads(p.read_text(encoding="utf-8"))
    proj = raw.get("project", {}) if isinstance(raw, dict) else {}
    deps = list(proj.get("dependencies") or [])
    opt = dict(proj.get("optional-dependencies") or {})

    opt_clean: dict[str, list[str]] = {}
    for k, v in opt.items():
        opt_clean[str(k)] = list(v or [])

    return PyProjectDeps(path=p, raw=raw, project_deps=deps, optional_deps=opt_clean)


def find_current_spec(deps: PyProjectDeps, package: str) -> str | None:
    hit = find_requirement_in_list(deps.project_deps, package)
    if hit:
        _, r = hit
        return str(r.specifier) or None

    for _group, reqs in deps.optional_deps.items():
        hit2 = find_requirement_in_list(reqs, package)
        if hit2:
            _, r2 = hit2
            return str(r2.specifier) or None

    return None


def best_effort_current_version(spec: str | None) -> str | None:
    if not spec:
        return None
    if spec.startswith("=="):
        return spec[2:]
    return None


def _replace_pep621_array(text: str, key: str, new_list: list[str]) -> str:
    # Heuristic replacer for: key = ["a", "b"] or key = [
    #   "a",
    #   "b",
    # ]
    pattern = re.compile(rf"(?ms)^\\s*{re.escape(key)}\\s*=\\s*\\[(.*?)\\]\\s*$")
    repl_items = ",\\n".join([f'  "{s}"' for s in new_list])
    repl = f"{key} = [\\n{repl_items}\\n]"
    return pattern.sub(repl, text, count=1)


def _replace_optional_dep_group(text: str, group: str, new_list: list[str]) -> str:
    # Replace within [project.optional-dependencies] table:
    # group = ["x", "y"]  or group = [ ... ]
    # Match from [project.optional-dependencies] section up to the target group, ensuring we're within that section
    section_pattern = r"\[project\.optional-dependencies\]"
    group_pattern = rf"^\\s*{re.escape(group)}\\s*=\\s*\\[(.*?)\\]\\s*$"
    
    # Find the section start
    section_match = re.search(section_pattern, text)
    if not section_match:
        return text  # Section doesn't exist, nothing to replace
    
    # Find the next section or end of file
    section_start = section_match.end()
    next_section_match = re.search(r"^\\[", text[section_start:], re.MULTILINE)
    section_end = section_start + next_section_match.start() if next_section_match else len(text)
    
    # Extract the section content
    section_content = text[section_start:section_end]
    
    # Replace the group within this section only
    pattern = re.compile(group_pattern, re.MULTILINE | re.DOTALL)
    repl_items = ",\\n".join([f'  "{s}"' for s in new_list])
    repl = f"{group} = [\\n{repl_items}\\n]"
    new_section_content = pattern.sub(repl, section_content, count=1)
    
    # Reconstruct the file
    return text[:section_start] + new_section_content + text[section_end:]


def update_dependency_in_pyproject(
    pyproject_path: str, package: str, new_version: str
) -> bool:
    p = Path(pyproject_path)
    text = p.read_text(encoding="utf-8")

    deps = load_pyproject(pyproject_path)
    updated = False
    changed_optional: set[str] = set()

    hit = find_requirement_in_list(deps.project_deps, package)
    if hit:
        i, req = hit
        old = deps.project_deps[i]
        deps.project_deps[i] = format_requirement_with_new_version(req, new_version)
        updated = deps.project_deps[i] != old

    for group, reqs in deps.optional_deps.items():
        hit2 = find_requirement_in_list(reqs, package)
        if hit2:
            i2, req2 = hit2
            old2 = reqs[i2]
            reqs[i2] = format_requirement_with_new_version(req2, new_version)
            if reqs[i2] != old2:
                updated = True
                changed_optional.add(group)

    if not updated:
        return False

    out = text
    if hit:
        out = _replace_pep621_array(out, "dependencies", deps.project_deps)

    # Optional deps require the section to exist; if it doesn't, we won't invent it.
    for group in changed_optional:
        out = _replace_optional_dep_group(out, group, deps.optional_deps[group])

    p.write_text(out, encoding="utf-8")
    return True
'''

PACKAGER_PY = '''\
"""Artifact packaging: diff.patch, run_report.md, run_trace.jsonl, pr_payload.json."""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from agent.models import PRPayload, RunContext, UpgradePlan
from agent.tools import git_current_branch, git_diff_patch


def render_pr_title(template: str, name: str, from_v: str, to_v: str) -> str:
    return (
        template.replace("{{name}}", name)
        .replace("{{from}}", from_v)
        .replace("{{to}}", to_v)
    )


def render_pr_body(
    plan: UpgradePlan, risks: list[str], evidence: dict[str, str]
) -> str:
    lines: list[str] = []
    lines.append("## What changed")
    lines.append(f"- Bumped {plan.package} from {plan.from_version} to {plan.to_version}.")
    lines.append("")
    lines.append("## Why now")
    lines.append("- Routine dependency maintenance; validated with lint/tests/types.")
    lines.append("")
    lines.append("## Risk & rollout")
    if risks:
        for r in risks:
            lines.append(f"- {r}")
    else:
        lines.append(
            "- Low/unknown risk; no targeted API migrations were required by the scaffold patcher."
        )
    lines.append("")
    lines.append("## How to validate")
    for c in plan.commands:
        lines.append("```bash")
        lines.append(c)
        lines.append("```")
    lines.append("")
    lines.append("## Evidence")
    for k, v in evidence.items():
        lines.append(f"- {k}: {v}")
    return "\\n".join(lines).strip() + "\\n"


def emit_artifacts(
    ctx: RunContext, plan: UpgradePlan, pr: PRPayload, trace: list[dict]
) -> dict[str, str]:
    Path(ctx.artifacts_dir).mkdir(parents=True, exist_ok=True)

    diff_path = str(Path(ctx.artifacts_dir) / "diff.patch")
    git_diff_patch(ctx.repo_root, diff_path)

    trace_path = str(Path(ctx.artifacts_dir) / "run_trace.jsonl")
    with open(trace_path, "w", encoding="utf-8") as f:
        for row in trace:
            f.write(json.dumps(row, ensure_ascii=False) + "\\n")

    pr_path = str(Path(ctx.artifacts_dir) / "pr_payload.json")
    payload = {"pr": {"title": pr.title, "body": pr.body, "labels": pr.labels}}
    Path(pr_path).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    report_path = str(Path(ctx.artifacts_dir) / "run_report.md")
    report: list[str] = []
    report.append("# Dependency upgrade report")
    report.append(f"- Repo: `{ctx.repo_root}`")
    report.append(f"- Branch: `{git_current_branch(ctx.repo_root)}`")
    report.append(f"- Package: `{ctx.package_name}`")
    report.append(f"- From: `{ctx.current_version or 'unknown'}`")
    report.append(f"- To: `{ctx.selected_version or 'unknown'}`")
    report.append(f"- Status: `{ctx.status}`")
    if ctx.failed_safe_reason:
        report.append(f"- Failed-safe reason: `{ctx.failed_safe_reason}`")
    report.append("")
    report.append("## Plan")
    report.append("```json")
    report.append(json.dumps(asdict(plan), indent=2, ensure_ascii=False))
    report.append("```")
    report.append("")
    report.append("## Artifacts")
    report.append(f"- diff.patch: `{diff_path}`")
    report.append(f"- run_trace.jsonl: `{trace_path}`")
    report.append(f"- pr_payload.json: `{pr_path}`")
    Path(report_path).write_text("\\n".join(report) + "\\n", encoding="utf-8")

    return {
        "diff": diff_path,
        "trace": trace_path,
        "pr_payload": pr_path,
        "report": report_path,
    }
'''

ENGINE_PY = '''\
"""State machine runner (deterministic, auditable)."""
from __future__ import annotations

import uuid
from datetime import datetime
from pathlib import Path

from packaging.version import Version

from agent.config import AgentConfig
from agent.models import PRPayload, RunContext, UpgradePlan
from agent.packager import emit_artifacts, render_pr_body, render_pr_title
from agent.repo_ops import (
    best_effort_current_version,
    find_current_spec,
    load_pyproject,
    update_dependency_in_pyproject,
)
from agent.run_db import RunDB
from agent.tools import (
    ensure_dirs,
    parse_pip_index_versions,
    run_cmd,
    venv_bin,
    venv_env,
)


def _now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _run_id() -> str:
    return uuid.uuid4().hex


def _safe_write(path: str, content: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def _log_cmd(
    db: RunDB, run_id: str, step: str, attempt_no: int, res, logs_dir: str
) -> None:
    ts = _now()
    out_p = str(Path(logs_dir) / f"{step}.{attempt_no}.stdout.txt")
    err_p = str(Path(logs_dir) / f"{step}.{attempt_no}.stderr.txt")
    _safe_write(out_p, res.stdout)
    _safe_write(err_p, res.stderr)
    db.log_attempt(run_id, step, attempt_no, res.cmd, res.returncode, out_p, err_p, ts)


def _ensure_venv(ctx: RunContext, db: RunDB, run_id: str, trace: list[dict]) -> None:
    logs_dir = str(Path(ctx.repo_root) / ".agent" / "logs")
    ensure_dirs(str(Path(ctx.repo_root) / ".agent"), ctx.artifacts_dir, logs_dir)
    if Path(ctx.venv_dir).exists():
        return

    res1 = run_cmd(f"python -m venv {ctx.venv_dir}", cwd=ctx.repo_root)
    trace.append({"ts": _now(), "step": "apply", "cmd": res1.cmd, "rc": res1.returncode})
    _log_cmd(db, run_id, "apply", 1, res1, logs_dir)
    if res1.returncode != 0:
        raise RuntimeError("venv creation failed")

    pip = venv_bin(ctx.venv_dir, "pip")
    res2 = run_cmd(f"{pip} install -U pip wheel", cwd=ctx.repo_root)
    trace.append({"ts": _now(), "step": "apply", "cmd": res2.cmd, "rc": res2.returncode})
    _log_cmd(db, run_id, "apply", 2, res2, logs_dir)
    if res2.returncode != 0:
        raise RuntimeError("pip bootstrap failed")


def scan(ctx: RunContext) -> None:
    root = Path(ctx.repo_root)
    if not root.exists():
        raise FileNotFoundError(f"repo_root not found: {ctx.repo_root}")
    if not (root / "pyproject.toml").exists():
        raise FileNotFoundError(
            "pyproject.toml required (scaffold supports PEP 621 projects)."
        )
    ctx.dep_file = "pyproject.toml"


def _select_latest_compatible(
    ctx: RunContext, cfg: AgentConfig, db: RunDB, run_id: str, trace: list[dict]
) -> str:
    res = run_cmd(
        f"python -m pip index versions {ctx.package_name} --no-color",
        cwd=ctx.repo_root,
    )
    trace.append({"ts": _now(), "step": "plan", "cmd": res.cmd, "rc": res.returncode})
    _log_cmd(db, run_id, "plan", 1, res, str(Path(ctx.repo_root) / ".agent" / "logs"))

    versions = parse_pip_index_versions(res.stdout + "\\n" + res.stderr)
    stable = [v for v in versions if not v.is_prerelease]
    stable.sort(reverse=True)
    if not stable:
        raise RuntimeError("No versions discovered from pip index versions output.")

    if not ctx.current_version:
        return str(stable[0])

    cur = Version(ctx.current_version)
    if cfg.allow_major_bump:
        return str(next((v for v in stable if v > cur), stable[0]))

    cur_major = cur.release[0] if cur.release else None
    same_major = [
        v for v in stable if v > cur and v.release and v.release[0] == cur_major
    ]
    if same_major:
        return str(same_major[0])
    # No same-major upgrade available; return current version to respect policy
    return ctx.current_version


def plan(
    ctx: RunContext, cfg: AgentConfig, db: RunDB, run_id: str, trace: list[dict]
) -> UpgradePlan:
    py = load_pyproject(str(Path(ctx.repo_root) / "pyproject.toml"))
    spec = find_current_spec(py, ctx.package_name)
    ctx.current_version = best_effort_current_version(spec)

    selected = ctx.requested_version or _select_latest_compatible(
        ctx, cfg, db, run_id, trace
    )
    ctx.selected_version = selected
    ctx.commands = list(cfg.ci_commands)

    risks: list[str] = []
    if not ctx.current_version:
        risks.append(
            "Current version could not be confidently inferred from pyproject spec; verify version delta."
        )
    if cfg.allowed_licenses:
        risks.append(
            "License policy is configured but license verification is not implemented in this scaffold."
        )
    if ctx.requested_version is None:
        risks.append(
            "Auto-selected target from published versions; confirm changelog if this is a sensitive dependency."
        )

    return UpgradePlan(
        package=ctx.package_name,
        from_version=ctx.current_version or "unknown",
        to_version=ctx.selected_version,
        commands=ctx.commands,
        risk_notes=risks,
        breaking_api_patterns=[],
    )


def apply(ctx: RunContext, db: RunDB, run_id: str, trace: list[dict]) -> None:
    _ensure_venv(ctx, db, run_id, trace)

    updated = update_dependency_in_pyproject(
        pyproject_path=str(Path(ctx.repo_root) / "pyproject.toml"),
        package=ctx.package_name,
        new_version=ctx.selected_version or "",
    )
    if not updated:
        trace.append(
            {
                "ts": _now(),
                "step": "apply",
                "note": "package not found in pyproject deps; manifest not updated",
            }
        )

    logs_dir = str(Path(ctx.repo_root) / ".agent" / "logs")
    pip = venv_bin(ctx.venv_dir, "pip")
    res1 = run_cmd(f"{pip} install -e .", cwd=ctx.repo_root)
    trace.append({"ts": _now(), "step": "apply", "cmd": res1.cmd, "rc": res1.returncode})
    _log_cmd(db, run_id, "apply", 3, res1, logs_dir)
    if res1.returncode != 0:
        res2 = run_cmd(f"{pip} install .", cwd=ctx.repo_root)
        trace.append(
            {"ts": _now(), "step": "apply", "cmd": res2.cmd, "rc": res2.returncode}
        )
        _log_cmd(db, run_id, "apply", 4, res2, logs_dir)
        if res2.returncode != 0:
            raise RuntimeError("Project install failed")

    res3 = run_cmd(
        f'{pip} install "{ctx.package_name}=={ctx.selected_version}"', cwd=ctx.repo_root
    )
    trace.append({"ts": _now(), "step": "apply", "cmd": res3.cmd, "rc": res3.returncode})
    _log_cmd(db, run_id, "apply", 5, res3, logs_dir)
    if res3.returncode != 0:
        raise RuntimeError("Dependency install failed")


def validate(
    ctx: RunContext, db: RunDB, run_id: str, trace: list[dict]
) -> tuple[bool, dict[str, str]]:
    env = venv_env(ctx.venv_dir)
    evidence: dict[str, str] = {}
    ok = True

    logs_dir = str(Path(ctx.repo_root) / ".agent" / "logs")
    for i, c in enumerate(ctx.commands, start=1):
        res = run_cmd(c, cwd=ctx.repo_root, env=env)
        trace.append({"ts": _now(), "step": "validate", "cmd": res.cmd, "rc": res.returncode})
        _log_cmd(db, run_id, "validate", i, res, logs_dir)

        evidence[c] = "PASS" if res.returncode == 0 else "FAIL"
        ok = ok and (res.returncode == 0)
        ctx.data.setdefault("last_validate", {})[c] = {
            "stdout": res.stdout,
            "stderr": res.stderr,
            "rc": res.returncode,
        }

    return ok, evidence


def patch(ctx: RunContext, cfg: AgentConfig, db: RunDB, run_id: str, trace: list[dict]) -> None:
    ctx.iterations += 1
    if ctx.iterations > cfg.patch_loop_max_iterations:
        ctx.status = "failed_safe"
        ctx.failed_safe_reason = "iteration-budget"
        return

    env = venv_env(ctx.venv_dir)
    logs_dir = str(Path(ctx.repo_root) / ".agent" / "logs")

    res1 = run_cmd("ruff --fix .", cwd=ctx.repo_root, env=env)
    trace.append({"ts": _now(), "step": "patch", "cmd": res1.cmd, "rc": res1.returncode})
    _log_cmd(db, run_id, "patch", ctx.iterations * 10 + 1, res1, logs_dir)

    pyupgrade_path = Path(ctx.venv_dir) / "bin" / "pyupgrade"
    if pyupgrade_path.exists():
        res2 = run_cmd(
            'pyupgrade $(python -c "import pathlib; print(\' \'.join(str(p) for p in pathlib.Path(\'.\').rglob(\'*.py\')))")',
            cwd=ctx.repo_root,
            env=env,
        )
        trace.append({"ts": _now(), "step": "patch", "cmd": res2.cmd, "rc": res2.returncode})
        _log_cmd(db, run_id, "patch", ctx.iterations * 10 + 2, res2, logs_dir)


def package(
    ctx: RunContext,
    plan_obj: UpgradePlan,
    cfg: AgentConfig,
    evidence: dict[str, str],
    trace: list[dict],
) -> dict[str, str]:
    title = render_pr_title(
        cfg.pr_title_template, ctx.package_name, plan_obj.from_version, plan_obj.to_version
    )
    body = render_pr_body(plan_obj, plan_obj.risk_notes, evidence)
    pr = PRPayload(title=title, body=body, labels=cfg.pr_labels)
    return emit_artifacts(ctx, plan_obj, pr, trace)


def run(repo_root: str, package_name: str, requested_version: str | None) -> dict[str, str]:
    repo_root = str(Path(repo_root).resolve())
    cfg = AgentConfig.load(str(Path(repo_root) / "agent.yaml"))
    ctx = RunContext(repo_root=repo_root, package_name=package_name, requested_version=requested_version)
    ctx.artifacts_dir = str(Path(repo_root) / cfg.artifacts_dir)
    ctx.runs_db = str(Path(repo_root) / cfg.runs_db)
    ctx.venv_dir = str(Path(repo_root) / cfg.venv_dir)

    ensure_dirs(str(Path(repo_root) / ".agent"), str(Path(repo_root) / ".agent" / "logs"), ctx.artifacts_dir)

    run_id = _run_id()
    trace: list[dict] = []
    start_ts = _now()

    db = RunDB(ctx.runs_db)
    try:
        db.create_run(
            run_id=run_id,
            ctx=ctx,
            policy={"allow_major_bump": cfg.allow_major_bump, "allowed_licenses": cfg.allowed_licenses},
            ci_profile={"commands": cfg.ci_commands},
            start_ts=start_ts,
        )
        scan(ctx)
        plan_obj = plan(ctx, cfg, db, run_id, trace)
        apply(ctx, db, run_id, trace)

        ok, evidence = validate(ctx, db, run_id, trace)
        while not ok and ctx.iterations < cfg.patch_loop_max_iterations and ctx.status != "failed_safe":
            patch(ctx, cfg, db, run_id, trace)
            if ctx.status == "failed_safe":
                break
            ok, evidence = validate(ctx, db, run_id, trace)

        if ok:
            ctx.status = "ok"
        elif ctx.status is None:
            ctx.status = "failed_safe"
            ctx.failed_safe_reason = ctx.failed_safe_reason or "checks-failed"

        artifacts = package(ctx, plan_obj, cfg, evidence, trace)
        return artifacts
    except Exception as exc:  # pragma: no cover - recorded in run db
        if ctx.status is None:
            ctx.status = "failed_safe"
        if not ctx.failed_safe_reason:
            ctx.failed_safe_reason = f"exception: {exc.__class__.__name__}"
        raise
    finally:
        db.finalize_run(run_id, ctx, _now())
        db.close()
'''

CLI_PY = '''\
"""CLI entrypoint."""
from __future__ import annotations

import argparse
from pathlib import Path

from agent.engine import run


def main() -> None:
    ap = argparse.ArgumentParser(description="Dependency Upgrade PR Agent (Python)")
    ap.add_argument("--repo", default=".", help="Path to repo root (default: .)")
    ap.add_argument("--package", required=True, help="Package name to upgrade")
    ap.add_argument("--target", default=None, help="Target version (optional; otherwise auto-select)")
    args = ap.parse_args()

    repo_root = str(Path(args.repo).resolve())
    artifacts = run(repo_root=repo_root, package_name=args.package, requested_version=args.target)

    print("\\nDone. Review artifacts:")
    for k, v in artifacts.items():
        print(f"- {k}: {v}")
    print("\\nHuman gate: open PR only after reviewing pr_payload.json + diff.patch.")


if __name__ == "__main__":
    main()
'''

FILES: dict[str, str] = {
    "requirements.txt": REQUIREMENTS_TXT,
    "agent.yaml": AGENT_YAML,
    "README.md": README_MD,
    "Makefile": MAKEFILE_TXT,
    "scripts/approve_and_open_pr.sh": APPROVE_SH,
    "agent/__init__.py": AGENT_INIT_PY,
    "agent/models.py": MODELS_PY,
    "agent/config.py": CONFIG_PY,
    "agent/run_db.py": RUN_DB_PY,
    "agent/tools.py": TOOLS_PY,
    "agent/repo_ops.py": REPO_OPS_PY,
    "agent/packager.py": PACKAGER_PY,
    "agent/engine.py": ENGINE_PY,
    "agent/cli.py": CLI_PY,
}


def main() -> None:
    for rel_path, content in FILES.items():
        p = Path(rel_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        if p.suffix == ".sh":
            p.chmod(0o755)

    print("Scaffold written.")
    print("Next:")
    print("  make agent-venv")
    print("  make run PKG=<package>")
    print("")
    print("Tip (Cursor): open this folder, then run the Makefile targets in the terminal.")


if __name__ == "__main__":
    main()
