# GitHub AI Agent Tasks for Repository Maintenance

This file lists tasks you can hand to a GitHub AI agent for this repository.

## Operating Rules (read first)
### Scope & Safety
- ✅ Allowed (default):
  - Docs/comments edits
  - Formatting + autofix linting
  - Adding tests (no production behavior changes)
  - CI config improvements (no secrets changes)
  - Type/typing improvements that don't change runtime behavior
- ❌ Not allowed without explicit approval:
  - Dependency upgrades beyond patch versions
  - Refactors that change runtime behavior or public APIs
  - Auth/session/security logic changes
  - Database migrations/data rewrites
  - "Performance optimizations" without profiling evidence

### PR Rules
- One bundle/category per PR
- Prefer small diffs: avoid drive-by refactors
- Include evidence in PR description:
  - commands run + outputs (or CI links)
  - `git diff --stat`
  - notes on any behavior changes (ideally none for low-risk tasks)

### Required Checks (when applicable)
- `lint` passes (or explain)
- `test` passes (or explain)
- `typecheck` passes (or explain)

---

## Quick Start (low risk)
1. Fix obvious typos in docs and comments.
2. Update README badges and metadata.
3. Normalize formatting with Prettier/ESLint.
4. Add missing docstrings and inline docs.
5. Remove dead code and commented blocks (only when clearly safe).
6. Check for unused imports and variables.
7. Align file headers and license notices.
8. Reformat markdown for consistency.
9. Update copyright years.
10. Add/refresh screenshots in docs.

## Code Quality & Maintenance
1. Run linters and auto-fix issues.
2. Convert string concatenation to template strings.
3. Break up functions that are too long.
4. Simplify overly complex conditionals.
5. Enforce naming conventions (variables/types).
6. Replace deprecated API usage.
7. Remove duplicate code blocks.
8. Add missing types for exported APIs.
9. Add null guards for risky paths.
10. Reduce nested callbacks / promise chains.
11. Normalize error handling patterns.
12. Align logging format across modules.
13. Remove unused feature flags.
14. Eliminate magic numbers with constants.
15. Add input validation where missing.

## Bug Hunting
1. Scan for console.log/print left in production.
2. Find potential null/undefined access paths.
3. Check for unclosed resources/streams.
4. Identify unsafe SQL string building.
5. Detect missing try/catch around IO.
6. Find shadowed variables.
7. Identify inconsistent return types.
8. Flag unexpected mutation of inputs.
9. Check for infinite loop patterns.
10. Verify error paths return proper HTTP codes.

## Documentation
1. Update README with latest features.
2. Generate or refresh API docs.
3. Document environment variables.
4. Add local setup troubleshooting guide.
5. Create a CHANGELOG from recent commits.
6. Add "How to run tests" section.
7. Create architecture overview diagram.
8. Document data flow and key services.
9. Add usage examples to core APIs.
10. Create onboarding checklist for new devs.

## Automation & CI/CD
1. Add CI job for lint + tests.
2. Fail CI on formatting drift.
3. Auto-label PRs based on files changed.
4. Add dependency update workflow.
5. Validate config files in CI (JSON/YAML).
6. Publish artifacts on tagged release.
7. Add scheduled security scan workflow.
8. Add CI step for type checking.
9. Add coverage report and badge.
10. Add smoke tests for deploys.

## Testing
1. Generate unit tests for uncovered modules.
2. Add integration tests for key flows.
3. Create fixtures for complex test data.
4. Convert flaky tests to deterministic ones.
5. Add edge case tests for inputs.
6. Add snapshot tests for UI components.
7. Improve assertions (avoid truthy checks).
8. Add regression tests for recent bugs.
9. Add parameterized tests for variations.
10. Run coverage and report gaps.

## Performance
1. Identify hot code paths and optimize (requires profiling evidence).
2. Find N+1 query patterns.
3. Add caching for expensive reads.
4. Reduce bundle size by removing unused code.
5. Audit heavy dependencies and replace.
6. Defer non-critical scripts.
7. Add memoization where safe.
8. Optimize large list rendering.
9. Reduce repeated computations in loops.
10. Optimize asset loading strategy.

## Security
1. Scan for exposed secrets/keys.
2. Validate input sanitization.
3. Check for XSS vulnerabilities.
4. Validate auth and session handling (review required).
5. Add CSRF protection where needed (review required).
6. Ensure password hashing best practices (review required).
7. Enforce strict CORS configuration (review required).
8. Validate file upload constraints.
9. Add rate limiting to public endpoints (review required).
10. Review encryption usage for sensitive data (review required).

## Dependency Management
1. Audit for known vulnerabilities.
2. Update outdated dependencies (approval required if > patch).
3. Remove unused dependencies.
4. Pin versions for critical packages.
5. Resolve dependency conflicts.
6. Add lockfile updates.
7. Document dependency upgrade policy.
8. Check license compatibility.
9. Split dev vs prod dependencies correctly.
10. Replace deprecated packages.

## Repository Management
1. Add/refresh CODEOWNERS.
2. Add issue and PR templates.
3. Update CONTRIBUTING.md.
4. Normalize folder structure.
5. Clean up unused assets.
6. Update .gitignore entries.
7. Add a SECURITY.md policy.
8. Add a SUPPORT.md guide.
9. Add repository badges.
10. Archive or remove old docs.

## Frontend Specific
1. Check for missing alt text in images.
2. Validate accessibility (aria labels).
3. Verify responsive breakpoints.
4. Remove unused CSS classes.
5. Optimize images and media assets.
6. Verify React hook dependency arrays.
7. Add skeleton/loading states.
8. Fix hydration warnings.
9. Improve error boundaries.
10. Validate form error handling.

## Backend / API Specific
1. Validate OpenAPI/Swagger specs.
2. Ensure consistent HTTP status codes.
3. Validate request/response schemas.
4. Add pagination where missing.
5. Add rate limiting for heavy endpoints (review required).
6. Check auth guards on endpoints (review required).
7. Standardize error response format.
8. Add input validation middleware.
9. Improve logging and tracing.
10. Add request correlation IDs.

## Data & Analytics
1. Validate migrations apply cleanly (review required).
2. Check for missing indexes on hot queries (review required).
3. Verify data constraints and defaults.
4. Add data validation on writes.
5. Audit data retention policies (review required).
6. Add analytics event tracking for key flows.
7. Check for PII leakage in logs.
8. Add data quality checks.
9. Optimize heavy reports (requires profiling evidence).
10. Add materialized views where needed (review required).

## Observability
1. Add structured logging.
2. Improve error reporting context.
3. Add tracing spans for critical flows.
4. Add uptime and latency metrics.
5. Create runbooks for incidents.
6. Add alerting thresholds.
7. Add SLO/SLA documentation.
8. Add dashboards for critical KPIs.
9. Monitor background job failures.
10. Add health check endpoints.

## Cleanup & Housekeeping
1. Remove stale feature flags.
2. Delete old experiment branches.
3. Remove leftover build artifacts.
4. Clean up unused scripts.
5. Remove duplicate or obsolete docs.
6. Standardize file naming conventions.
7. Remove unused environment variables.
8. Normalize config file formatting.
9. Add comments to confusing configs.
10. Simplify build scripts.

## Suggested Task Bundles
- **PR hygiene**: lint + format + tests + doc touchups.
- **Security sweep**: secret scan + dependency audit + auth review.
- **Performance sprint**: bundle analysis + query optimization + caching.
- **Docs refresh**: README + setup guides + env vars + examples.
- **Release prep**: changelog + version bump + tags + release notes.
