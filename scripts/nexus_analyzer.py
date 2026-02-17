#!/usr/bin/env python3
"""
NEXUS/CENTURIES PROJECT ANALYZER
Forensic analysis & recovery planning tool for Cursor AI.
Standardized for use across multiple repositories.
"""

import os
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import argparse

class NexusProjectAnalyzer:
    def __init__(self, project_path: str = "."):
        self.project_path = Path(project_path).absolute()
        self.results: Dict[str, Any] = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "project_path": str(self.project_path),
                "project_name": "NEXUS/Centuries",
                "analyzer_version": "2.4.1",
                "target_repo": self.project_path.name,
            },
            "analysis": {
                "issues": []
            },
            "recommendations": {},
            "nexus_specific": {},
        }

    def _log_issue(self, description: str, severity: str = "medium") -> None:
        """Log potential issues discovered during analysis."""
        self.results["analysis"]["issues"].append({
            "type": "potential_problem",
            "description": description,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
        })

    def _get_git_status(self) -> Dict[str, Any]:
        """Return git status for the repo."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                return {"has_git": False}

            status_result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5,
            )

            branch_result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5,
            )

            modified_files = [line for line in status_result.stdout.splitlines() if line.strip()]

            return {
                "has_git": True,
                "current_branch": branch_result.stdout.strip(),
                "modified_files_count": len(modified_files),
                "uncommitted_changes": len(modified_files) > 0,
                "status_output": status_result.stdout[:500],
            }
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            return {"has_git": False}

    def analyze_project_structure(self) -> Dict[str, Any]:
        """Deep forensic analysis of project structure."""
        structure: Dict[str, Any] = {
            "files_by_extension": {},
            "directories": [],
            "total_size_mb": 0.0,
            "file_count": 0,
            "empty_files": [],
            "large_files": [],
            "git_status": self._get_git_status(),
        }

        total_size = 0
        skip_dirs = {
            "__pycache__", ".git", "node_modules", "venv", ".venv", "env",
            "dist", "build", ".next", "target", "out", ".cache"
        }

        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if d not in skip_dirs]

            try:
                rel_dir = str(Path(root).relative_to(self.project_path))
                if rel_dir != "." and rel_dir not in structure["directories"]:
                    structure["directories"].append(rel_dir)
            except ValueError:
                continue

            for file in files:
                filepath = Path(root) / file
                try:
                    if filepath.is_symlink():
                        continue

                    size = filepath.stat().st_size
                    total_size += size
                    ext = filepath.suffix.lower()
                    structure["files_by_extension"][ext] = structure["files_by_extension"].get(ext, 0) + 1

                    rel_path = str(filepath.relative_to(self.project_path))

                    if size == 0 and ext not in {".gitkeep", ".keep", ".env", ".nojekyll"}:
                        structure["empty_files"].append(rel_path)
                        severity = "high" if ext in {".ts", ".tsx", ".js", ".jsx", ".py", ".go"} else "low"
                        self._log_issue(f"Empty file detected: {rel_path}", severity=severity)

                    if size > 10 * 1024 * 1024:  # > 10MB
                        structure["large_files"].append({
                            "path": rel_path,
                            "size_mb": round(size / (1024 * 1024), 2),
                        })

                except (OSError, PermissionError) as e:
                    self._log_issue(f"Cannot access: {filepath} - {str(e)}", severity="medium")

        structure["total_size_mb"] = round(total_size / (1024 * 1024), 2)
        structure["file_count"] = sum(structure["files_by_extension"].values())
        return structure

    def generate_dependency_map(self) -> Dict[str, Any]:
        """Parse package.json and requirements.txt."""
        dep_map: Dict[str, Any] = {
            "nodejs": {
                "dependencies": [],
                "devDependencies": [],
                "has_package_json": False,
            },
            "python": {"dependencies": [], "has_requirements": False},
        }

        # Node.js
        package_json = self.project_path / "package.json"
        if package_json.exists():
            try:
                with package_json.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                dep_map["nodejs"]["dependencies"] = list(data.get("dependencies", {}).keys())
                dep_map["nodejs"]["devDependencies"] = list(data.get("devDependencies", {}).keys())
                dep_map["nodejs"]["has_package_json"] = True
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                self._log_issue(f"Cannot parse package.json: {str(e)}", "high")

        # Python
        requirements = self.project_path / "requirements.txt"
        if requirements.exists():
            try:
                with requirements.open("r", encoding="utf-8") as f:
                    deps = [
                        line.split("==")[0].split(">=")[0].strip()
                        for line in f
                        if line.strip() and not line.startswith("#")
                    ]
                dep_map["python"]["dependencies"] = deps
                dep_map["python"]["has_requirements"] = True
            except Exception as e:
                self._log_issue(f"Cannot parse requirements.txt: {str(e)}", "medium")

        return dep_map

    def identify_core_files(self) -> Dict[str, List[str]]:
        """Identify core files with categorization."""
        core_patterns = {
            "config": ["package.json", "tsconfig.json", ".env", ".env.example", "docker-compose.yml", "Dockerfile", "amplify.yml", "vercel.json"],
            "database": ["schema.sql", "migration", "migrations/", "prisma/", "drizzle/", "supabase/migrations/"],
            "api": ["server.ts", "app.ts", "main.ts", "api/", "routes/", "controllers/"],
            "connectors": ["connector", "BaseConnector", "TwitterConnector", "PlatformManager", "stripe", "openai", "resend"],
            "frontend": ["app/", "pages/", "components/", "page.tsx", "layout.tsx", "next.config.js"],
            "docs": ["README.md", "API.md", "ARCHITECTURE.md", "DEVELOPMENT.md"]
        }

        found_files: Dict[str, List[str]] = {k: [] for k in core_patterns}
        skip_patterns = {"node_modules", "dist", "build", "__pycache__", ".next"}

        for category, patterns in core_patterns.items():
            for pattern in patterns:
                matches = list(self.project_path.rglob(f"*{pattern}*"))
                for match in matches:
                    if any(skip in str(match) for skip in skip_patterns):
                        continue
                    try:
                        rel_path = str(match.relative_to(self.project_path))
                        if rel_path not in found_files[category]:
                            found_files[category].append(rel_path)
                    except ValueError:
                        continue

        return found_files

    def _check_prompt_1(self) -> Dict[str, Any]:
        """Check database schema completion (Prompt 1)."""
        indicators = ["001_initial_schema.sql", "schema.sql", "migrations", "supabase/migrations", "prisma/schema.prisma"]
        found = [str(p.relative_to(self.project_path)) for ind in indicators if (p := self.project_path / ind).exists()]

        sql_matches = list(self.project_path.rglob("*.sql"))
        for m in sql_matches:
            if "migration" in str(m).lower() and "node_modules" not in str(m):
                try:
                    rel = str(m.relative_to(self.project_path))
                    if rel not in found:
                        found.append(rel)
                except ValueError:
                    continue

        status = "complete" if found else "missing"
        return {
            "status": status,
            "confidence": "high" if found else "low",
            "files_found": found[:10],
        }

    def _check_prompt_2(self) -> Dict[str, Any]:
        """Check API Gateway completion (Prompt 2)."""
        indicators = ["server.ts", "app.ts", "main.ts", "routes/", "api/", "src/routes"]
        found = []
        for ind in indicators:
            for m in self.project_path.rglob(f"*{ind}*"):
                if all(s not in str(m) for s in {"node_modules", ".next"}):
                    try:
                        found.append(str(m.relative_to(self.project_path)))
                    except ValueError:
                        continue
                    if len(found) >= 10: break
            if len(found) >= 10: break

        has_auth = False
        for p in ["*auth.ts", "*auth.js", "*authentication*"]:
            if list(self.project_path.rglob(p)):
                has_auth = True
                break

        if len(found) > 0 and has_auth:
            status = "complete"
        elif len(found) > 0:
            status = "partial"
        else:
            status = "missing"

        return {
            "status": status,
            "confidence": "high" if status == "complete" else "medium",
            "files_found": found[:10],
            "has_auth": has_auth,
            "critical": True,
            "blocking": ["prompt_4_frontend", "prompt_5_deployment"] if status != "complete" else [],
        }

    def _check_prompt_3(self) -> Dict[str, Any]:
        """Check platform connectors (Prompt 3)."""
        indicators = ["BaseConnector", "TwitterConnector", "connector", "PlatformManager", "stripe", "openai"]
        found = []
        for ind in indicators:
            for m in self.project_path.rglob(f"*{ind}*"):
                if all(s not in str(m) for s in {"node_modules", ".next", "nexus_analyzer"}):
                    try:
                        found.append(str(m.relative_to(self.project_path)))
                    except ValueError:
                        continue
                    if len(found) >= 10: break
            if len(found) >= 10: break

        status = "complete" if found else "missing"
        return {
            "status": status,
            "confidence": "high" if found else "low",
            "files_found": found[:10],
        }

    def _check_prompt_4(self) -> Dict[str, Any]:
        """Check frontend completion (Prompt 4)."""
        indicators = ["app/", "pages/", "components/", "page.tsx", "layout.tsx"]
        found = []
        for ind in indicators:
            for m in self.project_path.rglob(f"*{ind}*"):
                if all(s not in str(m) for s in {"node_modules", ".next"}):
                    try:
                        found.append(str(m.relative_to(self.project_path)))
                    except ValueError:
                        continue
                    if len(found) >= 10: break
            if len(found) >= 10: break

        has_next_config = any((self.project_path / f).exists() for f in ["next.config.js", "next.config.ts"])

        if len(found) > 5 and has_next_config:
            status = "complete"
        elif len(found) > 0:
            status = "partial"
        else:
            status = "missing"

        return {
            "status": status,
            "confidence": "medium",
            "files_found": found[:10],
            "has_next_config": has_next_config,
        }

    def _check_prompt_5(self) -> Dict[str, Any]:
        """Check deployment setup (Prompt 5)."""
        indicators = ["Dockerfile", "docker-compose.yml", ".github/workflows", "amplify.yml", "vercel.json"]
        found = []
        for ind in indicators:
            p = self.project_path / ind
            if p.exists():
                try:
                    found.append(str(p.relative_to(self.project_path)))
                except ValueError:
                    found.append(ind)

        status = "complete" if found else "missing"
        return {
            "status": status,
            "confidence": "high",
            "files_found": found,
        }

    def _identify_blocker(self, nexus_status: Dict[str, Dict[str, Any]]) -> str:
        for p_name, details in nexus_status.items():
            if details.get("critical") and details["status"] != "complete":
                blocking = details.get("blocking", [])
                return f"{p_name.upper()} (Blocking: {', '.join(blocking)})"

        for p_name, details in nexus_status.items():
            if details["status"] != "complete":
                return p_name.upper()

        return "NONE - All components identified"

    def analyze_nexus_completion(self) -> Dict[str, Any]:
        nexus_status = {
            "prompt_1_database": self._check_prompt_1(),
            "prompt_2_api": self._check_prompt_2(),
            "prompt_3_connectors": self._check_prompt_3(),
            "prompt_4_frontend": self._check_prompt_4(),
            "prompt_5_deployment": self._check_prompt_5(),
        }

        completed = sum(1 for v in nexus_status.values() if v["status"] == "complete")
        total = len(nexus_status)

        return {
            "prompts": nexus_status,
            "completion_rate": f"{completed}/{total}",
            "completion_percentage": round((completed / total) * 100, 1),
            "next_critical_step": self._identify_blocker(nexus_status),
        }

    def assess_health_score(self) -> Dict[str, Any]:
        checks = {
            "has_git": (self.project_path / ".git").exists(),
            "has_package_json": (self.project_path / "package.json").exists(),
            "has_readme": (self.project_path / "README.md").exists(),
            "has_docker": (self.project_path / "Dockerfile").exists() or (self.project_path / "docker-compose.yml").exists(),
            "has_env_example": (self.project_path / ".env.example").exists() or (self.project_path / ".env.local.example").exists(),
            "has_tests": bool(list(self.project_path.rglob("*.test.*")) or list(self.project_path.rglob("*.spec.*"))),
            "has_typescript": (self.project_path / "tsconfig.json").exists(),
            "has_ci": (self.project_path / ".github/workflows").exists(),
        }

        scores = {
            "infrastructure": round(sum([checks["has_git"], checks["has_package_json"], checks["has_typescript"]]) / 3 * 100),
            "documentation": round(sum([checks["has_readme"], checks["has_env_example"]]) / 2 * 100),
            "quality_assurance": round(sum([checks["has_tests"], checks["has_typescript"]]) / 2 * 100),
            "deployment_readiness": round(sum([checks["has_docker"], checks["has_ci"], checks["has_env_example"]]) / 3 * 100),
        }

        weights = {"infrastructure": 0.3, "documentation": 0.2, "quality_assurance": 0.25, "deployment_readiness": 0.25}
        scores["overall"] = round(sum(scores[k] * weights[k] for k in weights))

        return {"scores": scores, "checks": checks}

    def create_cursor_prompt(self) -> str:
        """Generate the battle-ready Cursor prompt from analysis."""
        nexus = self.results["nexus_specific"]
        health = self.results["analysis"]["health_score"]["scores"]
        structure = self.results["analysis"]["structure"]
        p = nexus["prompts"]

        lines = []
        lines.append(f"# 🎯 NEXUS RECOVERY PLAN — {self.project_path.name.upper()}")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Health Score:** {health['overall']}/100")
        lines.append(f"**Completion:** {nexus['completion_rate']} prompts ({nexus['completion_percentage']}%)")
        lines.append(f"**Critical Blocker:** {nexus['next_critical_step']}\n")

        if structure.get("git_status", {}).get("has_git"):
            gs = structure["git_status"]
            lines.append(f"**Git Status:** Branch `{gs.get('current_branch')}`, {gs.get('modified_files_count')} modified files")
            if gs.get("uncommitted_changes"):
                lines.append("⚠️ **Uncommitted changes detected**")

        lines.append("\n---")
        lines.append("## 📊 COMPONENT STATUS")
        lines.append(f"- **Database (P1):** {p['prompt_1_database']['status'].upper()}")
        lines.append(f"- **API Gateway (P2):** {p['prompt_2_api']['status'].upper()}")
        lines.append(f"- **Connectors (P3):** {p['prompt_3_connectors']['status'].upper()}")
        lines.append(f"- **Frontend (P4):** {p['prompt_4_frontend']['status'].upper()}")
        lines.append(f"- **Deployment (P5):** {p['prompt_5_deployment']['status'].upper()}\n")

        lines.append("---")
        lines.append("## 🚀 YOUR MISSION")
        lines.append("1. **Verify State:** Review the analysis report for any discrepancies.")
        lines.append("2. **Safety First:** Create a backup if you haven't already.")
        lines.append(f"3. **Address Blocker:** Focus on resolving **{nexus['next_critical_step']}**.")

        if nexus['completion_percentage'] < 100:
            lines.append("\n### PHASE-BY-PHASE RECOVERY")
            lines.append("Follow the recovery kit instructions in `docs/NEXUS_RECOVERY_KIT.md`.")
        else:
            lines.append("\n🎉 **All components identified!** Proceed with final production hardening and deployment verification.")

        return "\n".join(lines)

    def run_full_analysis(self) -> Dict[str, Any]:
        """Execute complete analysis pipeline."""
        self.results["analysis"]["structure"] = self.analyze_project_structure()
        self.results["analysis"]["dependencies"] = self.generate_dependency_map()
        self.results["analysis"]["core_files"] = self.identify_core_files()
        self.results["analysis"]["health_score"] = self.assess_health_score()
        self.results["nexus_specific"] = self.analyze_nexus_completion()
        return self.results

    def save_results(self, output_dir: str = "./nexus_analysis") -> None:
        """Persist analysis artifacts to disk."""
        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        report_name = f"analysis_report_{self.project_path.name}.json"
        with (out_path / report_name).open("w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2)

        with (out_path / "analysis_report.json").open("w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2)

        with (out_path / "EXECUTIVE_SUMMARY.md").open("w", encoding="utf-8") as f:
            h = self.results['analysis']['health_score']['scores']['overall']
            f.write(f"# EXECUTIVE SUMMARY - {self.project_path.name}\n\n")
            f.write(f"**Health Score:** {h}/100\n")
            f.write(f"**Completion Status:** {self.results['nexus_specific']['completion_rate']} prompts complete.\n")
            f.write(f"**Next Blocker:** {self.results['nexus_specific']['next_critical_step']}\n")

        with (out_path / "CURSOR_PROMPT.md").open("w", encoding="utf-8") as f:
            f.write(self.create_cursor_prompt())

def analyze_multiple_repos(repos_file: str, output_dir: str):
    """Analyze all repositories listed in a file."""
    if not os.path.exists(repos_file):
        print(f"Error: {repos_file} not found.")
        return

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    with open(repos_file, 'r', encoding='utf-8') as f:
        repo_configs = [line.strip().split('|') for line in f if line.strip() and not line.startswith('#')]

    print(f"\n🚀 Found {len(repo_configs)} repositories in {repos_file}")

    summary = ["# NEXUS Multi-Repo Rollout Summary", f"Generated: {datetime.now().isoformat()}", ""]

    for config in repo_configs:
        repo_path_str = config[0]
        repo_name = repo_path_str.split('/')[-1]

        if os.path.exists(repo_name):
            print(f"🔍 Analyzing local repo: {repo_name}...")
            analyzer = NexusProjectAnalyzer(repo_name)
            analyzer.run_full_analysis()
            analyzer.save_results(output_dir)
            h = analyzer.results['analysis']['health_score']['scores']['overall']
            summary.append(f"- ✅ **{repo_name}**: Health {h}/100, Status {analyzer.results['nexus_specific']['completion_rate']}")
        else:
            summary.append(f"- ⏳ **{repo_name}**: Pending Analysis (Directory not found locally)")

    with (out_path / "ROLLOUT_SUMMARY.md").open("w", encoding="utf-8") as f:
        f.write("\n".join(summary))
    print(f"\n✅ Rollout summary saved to {output_dir}/ROLLOUT_SUMMARY.md")

def main():
    parser = argparse.ArgumentParser(description="NEXUS Project Analyzer")
    parser.add_argument("paths", nargs="*", default=["."], help="Paths to analyze")
    parser.add_argument("--repos", help="Path to repos.txt for multi-repo rollout summary")
    parser.add_argument("--output", default="./nexus_analysis", help="Output directory")
    args = parser.parse_args()

    # If --repos is provided, we ONLY do the multi-repo summary based on repos.txt
    if args.repos:
        analyze_multiple_repos(args.repos, args.output)
    else:
        # Otherwise, analyze the provided paths
        for path in args.paths:
            if os.path.exists(path):
                print(f"Analyzing {path}...")
                analyzer = NexusProjectAnalyzer(path)
                analyzer.run_full_analysis()
                analyzer.save_results(args.output)
                print(f"Analysis complete for {path}. Results in {args.output}")

if __name__ == "__main__":
    main()
