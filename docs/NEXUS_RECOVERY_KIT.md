# Teamspace Home

# 🎯 NEXUS/Centuries Project Recovery Kit

**For Cursor AI** – Production-ready forensic analysis + battle plan

---

## Part 1: Run This Python Script First

Save as `nexus_[analyzer.py](http://analyzer.py)` and run on your project directory:

```python
#!/usr/bin/env python3
"""
NEXUS/CENTURIES PROJECT ANALYZER
Forensic analysis tool for Cursor-assisted recovery
Tailored for Node.js/TypeScript full-stack projects
"""

import os
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import argparse

class NexusProjectAnalyzer:
    def __init__(self, project_path: str = "."):
        self.project_path = Path(project_path).absolute()
        self.results = {
            "metadata": {
                "timestamp": [datetime.now](http://datetime.now)().isoformat(),
                "project_path": str(self.project_path),
                "project_name": "NEXUS/Centuries",
                "analyzer_version": "2.0.0"
            },
            "analysis": {},
            "recommendations": {},
            "nexus_specific": {}
        }

    def analyze_project_structure(self) -> Dict:
        """Deep forensic analysis of project structure"""
        structure = {
            "files_by_extension": {},
            "directories": [],
            "total_size_mb": 0,
            "file_count": 0,
            "empty_files": [],
            "large_files": [],
            "git_status": self._get_git_status()
        }

        total_size = 0
        skip_dirs = {'__pycache__', '.git', 'node_modules', 'venv', '.venv', 'env', 'dist', 'build', '.next'}
        
        for root, dirs, files in os.walk(self.project_path):
            dirs[:] = [d for d in dirs if d not in skip_dirs]

            for file in files:
                filepath = Path(root) / file
                try:
                    size = filepath.stat().st_size
                    total_size += size
                    ext = filepath.suffix.lower()
                    structure["files_by_extension"][ext] = structure["files_by_extension"].get(ext, 0) + 1

                    # Flag empty files (potential corruption)
                    if size == 0 and ext not in ['.gitkeep', '.keep', '.env']:
                        rel_path = str(filepath.relative_to(self.project_path))
                        structure["empty_files"].append(rel_path)
                        self._log_issue(f"Empty file detected: {rel_path}", "high")
                    
                    # Flag suspiciously large files
                    if size > 10 * 1024 * 1024:  # > 10MB
                        structure["large_files"].append({
                            "path": str(filepath.relative_to(self.project_path)),
                            "size_mb": round(size / (1024 * 1024), 2)
                        })

                except (OSError, PermissionError) as e:
                    self._log_issue(f"Cannot access: {filepath} - {str(e)}", "medium")

        structure["total_size_mb"] = round(total_size / (1024 * 1024), 2)
        structure["file_count"] = sum(structure["files_by_extension"].values())
        return structure

    def _get_git_status(self) -> Dict:
        """Get git repository status"""
        try:
            # Check if git repo exists
            result = [subprocess.run](http://subprocess.run)(
                ["git", "rev-parse", "--git-dir"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                return {"has_git": False}

            # Get status
            status_result = [subprocess.run](http://subprocess.run)(
                ["git", "status", "--porcelain"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Get branch
            branch_result = [subprocess.run](http://subprocess.run)(
                ["git", "branch", "--show-current"],
                cwd=self.project_path,
                capture_output=True,
                text=True,
                timeout=5
            )

            modified_files = [l for l in status_result.stdout.split('\n') if l.strip()]
            
            return {
                "has_git": True,
                "current_branch": branch_result.stdout.strip(),
                "modified_files_count": len(modified_files),
                "uncommitted_changes": len(modified_files) > 0,
                "status_output": status_result.stdout[:500]  # Limit output
            }
        except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
            return {"has_git": False}

    def _log_issue(self, description: str, severity: str = "medium"):
        """Log potential issues"""
        if "issues" not in self.results["analysis"]:
            self.results["analysis"]["issues"] = []
        self.results["analysis"]["issues"].append({
            "type": "potential_problem",
            "description": description,
            "severity": severity,
            "timestamp": [datetime.now](http://datetime.now)().isoformat()
        })

    def identify_core_files(self) -> Dict:
        """Identify core vs peripheral files with categorization"""
        core_patterns = {
            "config": ['package.json', 'tsconfig.json', '.env', '.env.example', 'docker-compose.yml', 'Dockerfile'],
            "database": ['schema.sql', 'migration', 'prisma', 'drizzle'],
            "api": ['server.ts', 'app.ts', 'main.ts', 'api/', 'routes/', 'controllers/'],
            "connectors": ['connector', 'BaseConnector', 'TwitterConnector', 'PlatformManager'],
            "frontend": ['page.tsx', 'layout.tsx', 'components/', 'app/'],
            "docs": ['[README.md](http://README.md)', '[API.md](http://API.md)', '[ARCHITECTURE.md](http://ARCHITECTURE.md)']
        }

        found_files = {category: [] for category in core_patterns.keys()}
        
        for category, patterns in core_patterns.items():
            for pattern in patterns:
                matches = list(self.project_path.rglob(f"*{pattern}*"))
                for match in matches:
                    if any(skip in str(match) for skip in ['node_modules', 'dist', 'build', '__pycache__']):
                        continue
                    rel_path = str(match.relative_to(self.project_path))
                    found_files[category].append(rel_path)

        return found_files

    def analyze_nexus_completion(self) -> Dict:
        """Analyze NEXUS/Centuries specific components"""
        nexus_status = {
            "prompt_1_database": self._check_prompt_1(),
            "prompt_2_api": self._check_prompt_2(),
            "prompt_3_connectors": self._check_prompt_3(),
            "prompt_4_frontend": self._check_prompt_4(),
            "prompt_5_deployment": self._check_prompt_5()
        }
        
        completed = sum(1 for v in nexus_status.values() if v["status"] == "complete")
        total = len(nexus_status)
        
        return {
            "prompts": nexus_status,
            "completion_rate": f"{completed}/{total}",
            "completion_percentage": round((completed / total) * 100, 1),
            "next_critical_step": self._identify_blocker(nexus_status)
        }

    def _check_prompt_1(self) -> Dict:
        """Check database schema completion"""
        indicators = [
            self.project_path / "001_initial_schema.sql",
            self.project_path / "schema.sql",
            self.project_path / "migrations"
        ]
        exists = any(p.exists() for p in indicators)
        return {
            "status": "complete" if exists else "missing",
            "confidence": "high" if exists else "low",
            "files_found": [str(p.relative_to(self.project_path)) for p in indicators if p.exists()]
        }

    def _check_prompt_2(self) -> Dict:
        """Check API Gateway completion - THIS IS CRITICAL"""
        indicators = [
            "server.ts", "app.ts", "main.ts",
            "routes/", "api/", "src/routes",
            "fastify", "express"
        ]
        
        found = []
        for indicator in indicators:
            matches = list(self.project_path.rglob(f"*{indicator}*"))
            found.extend([str(m.relative_to(self.project_path)) for m in matches[:3]])
        
        has_api = len(found) > 0
        
        # Check for auth endpoints
        has_auth = False
        for pattern in ["auth.ts", "auth.js", "authentication"]:
            if list(self.project_path.rglob(f"*{pattern}*")):
                has_auth = True
                break
        
        status = "complete" if (has_api and has_auth) else "partial" if has_api else "missing"
        
        return {
            "status": status,
            "confidence": "high" if status == "complete" else "medium" if status == "partial" else "low",
            "files_found": found[:10],
            "has_auth": has_auth,
            "critical": True,
            "blocking": ["prompt_4_frontend", "prompt_5_deployment"] if status != "complete" else []
        }

    def _check_prompt_3(self) -> Dict:
        """Check platform connectors"""
        indicators = ["BaseConnector", "TwitterConnector", "connector", "PlatformManager"]
        found = []
        
        for indicator in indicators:
            matches = list(self.project_path.rglob(f"*{indicator}*"))
            found.extend([str(m.relative_to(self.project_path)) for m in matches[:2]])
        
        exists = len(found) > 0
        return {
            "status": "complete" if exists else "missing",
            "confidence": "high" if exists else "low",
            "files_found": found
        }

    def _check_prompt_4(self) -> Dict:
        """Check frontend completion"""
        indicators = ["app/", "pages/", "components/", "page.tsx", "layout.tsx"]
        found = []
        
        for indicator in indicators:
            matches = list(self.project_path.rglob(f"*{indicator}*"))
            found.extend([str(m.relative_to(self.project_path)) for m in matches[:3]])
        
        has_next_config = (self.project_path / "next.config.js").exists() or (self.project_path / "next.config.ts").exists()
        
        status = "complete" if (len(found) > 5 and has_next_config) else "partial" if len(found) > 0 else "missing"
        
        return {
            "status": status,
            "confidence": "medium",
            "files_found": found[:10],
            "has_next_config": has_next_config
        }

    def _check_prompt_5(self) -> Dict:
        """Check deployment setup"""
        indicators = [
            self.project_path / "Dockerfile",
            self.project_path / "docker-compose.yml",
            self.project_path / ".github/workflows",
            self.project_path / "amplify.yml"
        ]
        
        found = [str(p.relative_to(self.project_path)) for p in indicators if p.exists()]
        exists = len(found) > 0
        
        return {
            "status": "complete" if exists else "missing",
            "confidence": "high" if exists else "low",
            "files_found": found
        }

    def _identify_blocker(self, nexus_status: Dict) -> str:
        """Identify what's blocking progress"""
        for prompt_name, details in nexus_status.items():
            if details.get("critical") and details["status"] != "complete":
                return f"{prompt_name.upper()} - {', '.join(details.get('blocking', []))}"
        
        # Find first incomplete
        for prompt_name, details in nexus_status.items():
            if details["status"] != "complete":
                return prompt_name.upper()
        
        return "NONE - All prompts complete!"

    def generate_dependency_map(self) -> Dict:
        """Parse package.json and requirements.txt"""
        dep_map = {
            "nodejs": {"dependencies": [], "devDependencies": [], "has_package_json": False},
            "python": {"dependencies": [], "has_requirements": False}
        }

        # Node.js dependencies
        package_json = self.project_path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    dep_map["nodejs"]["dependencies"] = list(data.get("dependencies", {}).keys())
                    dep_map["nodejs"]["devDependencies"] = list(data.get("devDependencies", {}).keys())
                    dep_map["nodejs"]["has_package_json"] = True
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                self._log_issue(f"Cannot parse package.json: {str(e)}", "high")

        # Python dependencies
        requirements = self.project_path / "requirements.txt"
        if requirements.exists():
            try:
                with open(requirements, 'r', encoding='utf-8') as f:
                    deps = [line.split('==')[0].split('>=')[0].strip() 
                           for line in f if line.strip() and not line.startswith('#')]
                    dep_map["python"]["dependencies"] = deps
                    dep_map["python"]["has_requirements"] = True
            except UnicodeDecodeError as e:
                self._log_issue(f"Cannot parse requirements.txt: {str(e)}", "medium")

        return dep_map

    def assess_health_score(self) -> Dict:
        """Calculate comprehensive health scores"""
        checks = {
            "has_git": (self.project_path / ".git").exists(),
            "has_package_json": (self.project_path / "package.json").exists(),
            "has_readme": (self.project_path / "[README.md](http://README.md)").exists(),
            "has_docker": (self.project_path / "Dockerfile").exists() or (self.project_path / "docker-compose.yml").exists(),
            "has_env_example": (self.project_path / ".env.example").exists(),
            "has_tests": len(list(self.project_path.rglob("*.test.*"))) > 0 or len(list(self.project_path.rglob("*.spec.*"))) > 0,
            "has_typescript": (self.project_path / "tsconfig.json").exists(),
            "has_ci": (self.project_path / ".github/workflows").exists()
        }

        scores = {
            "infrastructure": 0,
            "documentation": 0,
            "quality_assurance": 0,
            "deployment_readiness": 0,
            "overall": 0
        }

        # Infrastructure (git, package management, typescript)
        infra_score = sum([checks["has_git"], checks["has_package_json"], checks["has_typescript"]]) / 3 * 100
        scores["infrastructure"] = round(infra_score)

        # Documentation
        doc_score = sum([checks["has_readme"], checks["has_env_example"]]) / 2 * 100
        scores["documentation"] = round(doc_score)

        # Quality Assurance
        qa_score = sum([checks["has_tests"], checks["has_typescript"]]) / 2 * 100
        scores["quality_assurance"] = round(qa_score)

        # Deployment
        deploy_score = sum([checks["has_docker"], checks["has_ci"], checks["has_env_example"]]) / 3 * 100
        scores["deployment_readiness"] = round(deploy_score)

        # Overall weighted average
        weights = {"infrastructure": 0.3, "documentation": 0.2, "quality_assurance": 0.25, "deployment_readiness": 0.25}
        scores["overall"] = round(sum(scores[k] * weights[k] for k in weights))

        return {"scores": scores, "checks": checks}

    def create_cursor_prompt(self) -> str:
        """Generate battle-ready Cursor prompt"""
        nexus = self.results["nexus_specific"]
        health = self.results["analysis"]["health_score"]["scores"]
        structure = self.results["analysis"]["structure"]
        
        prompt = f"""# 🎯 NEXUS/CENTURIES PROJECT RECOVERY — CURSOR BATTLE PLAN

**Generated:** {[datetime.now](http://datetime.now)().strftime('%Y-%m-%d %H:%M:%S')}
**Project Health:** {health['overall']}/100
**Completion:** {nexus['completion_rate']} prompts ({nexus['completion_percentage']}%)
**Critical Blocker:** {nexus['next_critical_step']}

---

## 📊 FORENSIC ANALYSIS COMPLETE

### Project Structure
- **Total Files:** {structure['file_count']}
- **Project Size:** {structure['total_size_mb']} MB
- **Empty Files (Potential Corruption):** {len(structure.get('empty_files', []))}
- **Git Repository:** {"✅ Yes" if structure['git_status']['has_git'] else "❌ No"}
"""

        if structure['git_status'].get('has_git'):
            prompt += f"""- **Current Branch:** {structure['git_status'].get('current_branch', 'unknown')}
- **Uncommitted Changes:** {"⚠️ Yes" if structure['git_status'].get('uncommitted_changes') else "✅ No"}
"""

        prompt += f"""
### NEXUS/Centuries Component Status

**Prompt 1 - Database Schema:** {nexus['prompts']['prompt_1_database']['status'].upper()}
**Prompt 2 - API Gateway:** {nexus['prompts']['prompt_2_api']['status'].upper()} {'⚠️ CRITICAL BLOCKER' if nexus['prompts']['prompt_2_api']['status'] != 'complete' else ''}
**Prompt 3 - Platform Connectors:** {nexus['prompts']['prompt_3_connectors']['status'].upper()}
**Prompt 4 - Frontend:** {nexus['prompts']['prompt_4_frontend']['status'].upper()}
**Prompt 5 - Deployment:** {nexus['prompts']['prompt_5_deployment']['status'].upper()}

### Dependencies
"""
        
        deps = self.results["analysis"]["dependencies"]
        if deps['nodejs']['has_package_json']:
            prompt += f"**Node.js Packages:** {len(deps['nodejs']['dependencies'])} dependencies, {len(deps['nodejs']['devDependencies'])} dev dependencies\n"
        if deps['python']['has_requirements']:
            prompt += f"**Python Packages:** {len(deps['python']['dependencies'])} dependencies\n"

        issues = self.results["analysis"].get("issues", [])
        if issues:
            prompt += f"\n### ⚠️ Issues Detected: {len(issues)}\n"
            for issue in issues[:5]:
                prompt += f"- **[{issue['severity'].upper()}]** {issue['description']}\n"

        prompt += """
---

## 🎯 YOUR MISSION (EXECUTE IN ORDER)

### PHASE 0: SAFETY & BACKUP
1. **CREATE BACKUP IMMEDIATELY**
```

# Create timestamped backup

tar -czf "../nexus-backup-$(date +%Y%m%d_%H%M%S).tar.gz" . \

--exclude='node_modules' \

--exclude='.git' \

--exclude='dist' \

--exclude='build'

```

2. **COMMIT CURRENT STATE**
```

git add -A

git commit -m "Pre-recovery snapshot - $(date)"

git tag "pre-recovery-$(date +%Y%m%d_%H%M%S)"

```

### PHASE 1: TRIAGE & CLEANUP
"""

        if structure.get('empty_files'):
            prompt += f"""
**Action Required:** {len(structure['empty_files'])} empty files detected (potential corruption)

**Generate cleanup script:**
```

#!/bin/bash

# Safe cleanup with dry-run

DRY_RUN=true

# Empty files to investigate:

"""

for f in structure['empty_files'][:10]:

prompt += f"# - {f}n"

prompt += """

# Run with DRY_RUN=false to actually delete

if [[ "$DRY_RUN" == "true" ]]; then

echo "[DRY-RUN] Would delete empty files above"

else

# Add actual deletion logic after manual review

echo "Manual review required before deletion"

fi

```
"""

        prompt += f"""
**Verify dependency integrity:**
```

# Node.js

rm -rf node_modules package-lock.json

npm install

# If using TypeScript, verify compilation

npm run build

```

### PHASE 2: COMPLETE MISSING COMPONENTS

**CRITICAL:** {nexus['next_critical_step']}

"""

        # Add specific instructions based on what's missing
        prompt_2_status = nexus['prompts']['prompt_2_api']['status']
        
        if prompt_2_status != 'complete':
            prompt += """
#### 🚨 BUILD PROMPT 2: API GATEWAY (Node.js/Fastify)

**This is BLOCKING all frontend and deployment work.**

**Requirements:**
```

// Structure needed:

src/

├── server.ts              // Main entry point

├── app.ts                 // Fastify app setup

├── routes/

│   ├── auth.ts           // POST /auth/register, /auth/login, /auth/refresh

│   ├── feed.ts           // GET /feed/unified (with Redis caching)

│   ├── posts.ts          // CRUD for posts

│   └── platforms.ts      // OAuth flows

├── middleware/

│   ├── auth.ts           // JWT verification

│   ├── rateLimit.ts      // Rate limiting

│   └── validation.ts     // Zod schemas

├── lib/

│   ├── db.ts             // Neon Postgres client

│   └── redis.ts          // Upstash Redis client

└── types/

└── index.ts          // TypeScript interfaces

```

**Integration points:**
- **Database:** Connect to existing Prompt 1 schema (Neon Postgres)
- **Connectors:** Wire up existing Prompt 3 platform connectors
- **Auth:** JWT with refresh tokens, bcrypt password hashing
- **Caching:** Redis caching for feeds (30s TTL, <50ms response)
- **Validation:** Zod schemas for all inputs
- **Testing:** Jest tests with >80% coverage

**Deliverables:**
1. Complete API server that `docker-compose up` works
2. All auth endpoints functional
3. Feed endpoint fetching from DB
4. Platform OAuth flows working
5. Full test suite passing
6. API documentation (OpenAPI/Swagger)

**Success criteria:**
- `npm run dev` starts server without errors
- Auth flow works (register → login → get JWT → access protected route)
- Can fetch unified feed from database
- Tests pass with adequate coverage
"""

        else:
            # If API is done, focus on next component
            if nexus['prompts']['prompt_4_frontend']['status'] != 'complete':
                prompt += """
#### BUILD PROMPT 4: FRONTEND (Next.js + React)

Your API is ready. Now build the frontend that consumes it.

**Requirements:**
- Next.js 14+ with App Router
- TypeScript strict mode
- TailwindCSS (match your existing prototypes)
- React Query for data fetching
- Zustand for state management

**Key pages:**
- `/` - Landing/auth page
- `/dashboard` - Unified feed
- `/compose` - Create post
- `/settings` - Platform connections
"""

        prompt += """
### PHASE 3: VALIDATION & TESTING

**Before proceeding, validate:**
```

# 1. All tests pass

npm test

# 2. TypeScript compiles

npm run build

# 3. Linting passes

npm run lint

# 4. Local environment works

docker-compose up

# Visit [http://localhost:3000](http://localhost:3000) and test auth flow

```

### PHASE 4: DEPLOYMENT PREPARATION

**Setup deployment pipeline:**
1. Docker multi-stage build (production-optimized)
2. GitHub Actions CI/CD
3. Environment variable management (.env.example complete)
4. Health check endpoints
5. Monitoring/logging setup

---

## 🎭 WORKING PHILOSOPHY

**Conservative:** Build incrementally. Test each component before moving to next.

**Transparent:** After EACH step, provide:
- ✅ What was completed
- ⚠️ What issues were found
- 🎯 What's next

**Agentic:** You have authority to:
- Delete corrupted/empty files (after showing me the list)
- Refactor bad code
- Suggest alternative approaches
- Skip non-critical features

**NO handwaving:** Every deliverable must:
- Actually run without errors
- Include working examples
- Have tests that pass
- Be documented

---

## 🚀 START NOW

**Step 1:** Analyze current codebase structure and report findings
**Step 2:** Show me the cleanup plan (what will be deleted/fixed)
**Step 3:** Execute Phase 1 (Triage & Cleanup)
**Step 4:** Execute Phase 2 (Build missing components)

**After each phase, STOP and report progress before continuing.**

GO! 🔥
"""

        return prompt

    def run_full_analysis(self):
        """Execute complete analysis pipeline"""
        print(f"🔍 Analyzing NEXUS/Centuries project at: {self.project_path}")
        print("=" * 70)

        # Run all analyses
        print("📊 Analyzing structure...")
        self.results["analysis"]["structure"] = self.analyze_project_structure()
        
        print("📦 Identifying core files...")
        self.results["analysis"]["core_files"] = self.identify_core_files()
        
        print("🔗 Mapping dependencies...")
        self.results["analysis"]["dependencies"] = self.generate_dependency_map()
        
        print("❤️  Calculating health score...")
        self.results["analysis"]["health_score"] = self.assess_health_score()
        
        print("🎯 Analyzing NEXUS completion status...")
        self.results["nexus_specific"] = self.analyze_nexus_completion()

        return self.results

    def save_results(self, output_dir: str = "./nexus_analysis"):
        """Save all analysis artifacts"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        # Save JSON report
        json_path = output_path / "analysis_report.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, default=str)

        # Save Cursor prompt
        prompt_path = output_path / "CURSOR_[PROMPT.md](http://PROMPT.md)"
        with open(prompt_path, 'w', encoding='utf-8') as f:
            f.write(self.create_cursor_prompt())

        # Save executive summary
        summary_path = output_path / "EXECUTIVE_[SUMMARY.md](http://SUMMARY.md)"
        self._write_summary(summary_path)

        # Save cleanup script
        if self.results["analysis"]["structure"].get("empty_files"):
            script_path = output_path / "[cleanup.sh](http://cleanup.sh)"
            self._write_cleanup_script(script_path)

        print(f"\n✅ Analysis complete! Results saved to: {output_path}")
        print(f"   📄 Full report: {json_[path.name](http://path.name)}")
        print(f"   🎯 Cursor prompt: {prompt_[path.name](http://path.name)}")
        print(f"   📋 Summary: {summary_[path.name](http://path.name)}")
        if self.results["analysis"]["structure"].get("empty_files"):
            print(f"   🧹 Cleanup script: [cleanup.sh](http://cleanup.sh)")

    def _write_summary(self, path: Path):
        """Write executive summary"""
        nexus = self.results["nexus_specific"]
        health = self.results["analysis"]["health_score"]["scores"]
        structure = self.results["analysis"]["structure"]
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write("# NEXUS/CENTURIES PROJECT ANALYSIS\n\n")
            f.write(f"**Generated:** {[datetime.now](http://datetime.now)().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## HEALTH SCORE\n")
            for key, value in health.items():
                indicator = "🟢" if value >= 70 else "🟡" if value >= 40 else "🔴"
                f.write(f"- {indicator} **{key.replace('_', ' ').title()}:** {value}/100\n")
            
            f.write(f"\n## PROJECT STATUS\n")
            f.write(f"- **Completion:** {nexus['completion_rate']} prompts ({nexus['completion_percentage']}%)\n")
            f.write(f"- **Critical Blocker:** {nexus['next_critical_step']}\n")
            f.write(f"- **Total Files:** {structure['file_count']}\n")
            f.write(f"- **Project Size:** {structure['total_size_mb']} MB\n")
            
            if structure.get('empty_files'):
                f.write(f"\n## ⚠️ ISSUES\n")
                f.write(f"- **Empty files detected:** {len(structure['empty_files'])}\n")
            
            f.write("\n## NEXT STEPS\n")
            f.write("1. Review CURSOR_[PROMPT.md](http://PROMPT.md)\n")
            f.write("2. Paste entire prompt into Cursor\n")
            f.write("3. Execute phase-by-phase recovery\n")

    def _write_cleanup_script(self, path: Path):
        """Write cleanup bash script"""
        empty_files = self.results["analysis"]["structure"].get("empty_files", [])
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write("#!/bin/bash\n")
            f.write("# NEXUS/CENTURIES Safe Cleanup Script\n")
            f.write(f"# Generated: {[datetime.now](http://datetime.now)().isoformat()}\n\n")
            f.write("set -e\n\n")
            f.write("DRY_RUN=true  # Set to false to actually delete\n\n")
            f.write("echo '🧹 NEXUS/CENTURIES Cleanup Script'\n")
            f.write("echo '================================'\n\n")
            
            if empty_files:
                f.write(f"echo 'Found {len(empty_files)} empty files'\n\n")
                f.write("EMPTY_FILES=(\n")
                for file in empty_files:
                    f.write(f'    "{file}"\n')
                f.write(")\n\n")
                
                f.write("for file in \"${EMPTY_FILES[@]}\"; do\n")
                f.write("    if [[ \"$DRY_RUN\" == \"true\" ]]; then\n")
                f.write("        echo \"[DRY-RUN] Would delete: $file\"\n")
                f.write("    else\n")
                f.write("        rm -f \"$file\"\n")
                f.write("        echo \"Deleted: $file\"\n")
                f.write("    fi\n")
                f.write("done\n\n")
            
            f.write("echo ''\n")
            f.write("echo '✅ Cleanup complete'\n")
            f.write("echo 'Set DRY_RUN=false to execute deletions'\n")
        
        # Make executable
        path.chmod(0o755)

    def print_summary(self):
        """Print concise summary to terminal"""
        nexus = self.results["nexus_specific"]
        health = self.results["analysis"]["health_score"]["scores"]
        structure = self.results["analysis"]["structure"]
        
        print("\n" + "=" * 70)
        print("📊 NEXUS/CENTURIES ANALYSIS SUMMARY")
        print("=" * 70)
        
        print(f"\n🎯 COMPLETION: {nexus['completion_rate']} ({nexus['completion_percentage']}%)")
        print(f"❤️  HEALTH SCORE: {health['overall']}/100")
        
        if health['overall'] >= 70:
            print("   Status: 🟢 Good - Continue building")
        elif health['overall'] >= 40:
            print("   Status: 🟡 Fair - Cleanup recommended")
        else:
            print("   Status: 🔴 Poor - Significant work needed")
        
        print(f"\n📂 PROJECT SIZE: {structure['total_size_mb']} MB ({structure['file_count']} files)")
        
        if structure['git_status']['has_git']:
            print(f"🔀 GIT: Branch '{structure['git_status'].get('current_branch', 'unknown')}'")
            if structure['git_status'].get('uncommitted_changes'):
                print("   ⚠️  Uncommitted changes detected")
        
        print(f"\n🚨 CRITICAL BLOCKER: {nexus['next_critical_step']}")
        
        issues = self.results["analysis"].get("issues", [])
        if issues:
            print(f"\n⚠️  ISSUES FOUND: {len(issues)}")
            for issue in issues[:3]:
                print(f"   - [{issue['severity'].upper()}] {issue['description'][:60]}...")
        
        print("\n" + "=" * 70)
        print("🎯 NEXT: Open nexus_analysis/CURSOR_[PROMPT.md](http://PROMPT.md)")
        print("=" * 70)

def main():
    parser = argparse.ArgumentParser(
        description='NEXUS/Centuries Project Analyzer - Cursor Recovery Tool'
    )
    parser.add_argument(
        'path',
        nargs='?',
        default='.',
        help='Project directory path (default: current directory)'
    )
    parser.add_argument(
        '--output', '-o',
        default='./nexus_analysis',
        help='Output directory for reports (default: ./nexus_analysis)'
    )
    parser.add_argument(
        '--skip-save',
        action='store_true',
        help='Skip saving files, just print summary'
    )

    args = parser.parse_args()

    try:
        # Run analysis
        analyzer = NexusProjectAnalyzer(args.path)
        [analyzer.run](http://analyzer.run)_full_analysis()
        
        # Print summary
        analyzer.print_summary()
        
        # Save results
        if not args.skip_save:
            [analyzer.save](http://analyzer.save)_results(args.output)
            
            print("\n🚀 READY FOR CURSOR:")
            print(f"   1. Open '{args.output}/CURSOR_[PROMPT.md](http://PROMPT.md)'")
            print("   2. Copy the ENTIRE file")
            print("   3. Paste into Cursor")
            print("   4. Let Cursor execute the recovery plan")
            print("\n💡 The prompt is tailored to your NEXUS/Centuries project")
            print("   with forensic data from your actual codebase.")
        
        return 0
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Analysis interrupted by user")
        return 1
    except Exception as e:
        print(f"\n\n❌ ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
```

---

## Part 2: How to Use This Kit

### Step 1: Run the Analyzer

```bash
# Save the script above as nexus_[analyzer.py](http://analyzer.py)
python nexus_[analyzer.py](http://analyzer.py) /path/to/your/nexus/project

# Or if you're already in the project directory:
python nexus_[analyzer.py](http://analyzer.py) .

# Quick check without saving files:
python nexus_[analyzer.py](http://analyzer.py) . --skip-save
```

### Step 2: Review the Analysis

The script generates:

- `CURSOR_[PROMPT.md](http://PROMPT.md)` - **Copy this entire file to Cursor**
- `analysis_report.json` - Full forensic data
- `EXECUTIVE_[SUMMARY.md](http://SUMMARY.md)` - Quick overview
- [`cleanup.sh`](http://cleanup.sh) - Safe cleanup script (if issues found)

### Step 3: Feed to Cursor

1. Open `nexus_analysis/CURSOR_[PROMPT.md](http://PROMPT.md)`
2. **Copy the ENTIRE contents**
3. Paste into Cursor
4. Watch Cursor execute the recovery systematically

---

## What Makes This Robust

### The Python Script

✅ **Real forensic analysis** - not generic templates

✅ **NEXUS-specific checks** - knows about Prompt 1-5 structure

✅ **Safety first** - backup commands, dry-run scripts

✅ **Error handling** - graceful degradation on file access errors

✅ **Comprehensive metrics** - health scores, completion tracking

✅ **Tailored output** - Cursor prompt adapts to YOUR actual project state

### The Cursor Prompt

✅ **Data-driven** - based on your actual codebase analysis

✅ **Phase-gated** - prevents runaway work, forces validation

✅ **Explicit authorization** - clear on what can be deleted/changed

✅ **Integration-aware** - knows Prompt 1 DB must connect to Prompt 2 API

✅ **Testable** - every phase has success criteria

✅ **No handwaving** - demands working code, not explanations

---

## Key Improvements Over Generic Prompts

1. **Forensic First** - Analyzes before prescribing
2. **Context-Aware** - Knows you have DB + Connectors, missing API
3. **Safety Net** - Backup commands, git tags, dry-run scripts
4. **Measurable** - Health scores, completion percentages
5. **Adaptive** - Prompt changes based on what's actually missing
6. **Integration Focus** - Emphasizes wiring components together
7. **Phase-Gated** - Cursor must report after each step

Run this, feed it to Cursor, and you'll have a concrete, executable recovery plan. 🚀
