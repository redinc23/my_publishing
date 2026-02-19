# Dependencies Documentation

This document provides detailed information about project dependencies, known issues, and how to manage them.

## Overview

The MANGU Platform uses npm as its package manager and includes approximately 1,040 total packages (including transitive dependencies).

## Package Manager

- **Package Manager**: npm 9.x or higher
- **Node.js Version**: 18.x or higher (LTS)
- **Package Lock**: `package-lock.json` (committed to repository)

## Installing Dependencies

```bash
# Install all dependencies (development + production)
npm install

# Install only production dependencies
npm install --omit=dev

# Clean install (removes node_modules first)
npm ci
```

## Core Dependencies

### Frontend Framework & UI

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 14.2.35 | React framework with App Router |
| `react` | 18.3.1 | UI library |
| `react-dom` | 18.3.1 | React DOM renderer |
| `typescript` | 5.3.3 | Type system |
| `tailwindcss` | 3.4.1 | CSS framework |

### Backend & Database

| Package | Version | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` | 2.39.0 | Supabase client |
| `@supabase/ssr` | 0.1.0 | Supabase SSR utilities |

### Payments

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | 14.25.0 | Stripe server SDK |
| `@stripe/stripe-js` | 2.4.0 | Stripe client SDK |

### AI & ML

| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | 4.24.1 | OpenAI API client |

### Email

| Package | Version | Purpose |
|---------|---------|---------|
| `resend` | 3.2.0 | Email API client |
| `@react-email/components` | 0.0.20 | Email templates |

### UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/react-*` | Various | Accessible UI primitives |
| `framer-motion` | 10.18.0 | Animation library |
| `lucide-react` | 0.309.0 | Icon library |

### Forms & Validation

| Package | Version | Purpose |
|---------|---------|---------|
| `react-hook-form` | 7.50.0 | Form handling |
| `@hookform/resolvers` | 3.3.4 | Form validation resolvers |
| `zod` | 3.25.76 | Schema validation |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| `date-fns` | 4.1.0 | Date utilities |
| `lodash` | 4.17.21 | Utility functions |
| `lru-cache` | 11.2.4 | In-memory caching |
| `clsx` | 2.1.0 | Conditional classes |
| `tailwind-merge` | 2.2.0 | Merge Tailwind classes |

### Data Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `chart.js` | 4.5.1 | Chart library |
| `react-chartjs-2` | 5.3.1 | React wrapper for Chart.js |
| `recharts` | 3.6.0 | React charts |
| `d3` | 7.9.0 | Data visualization |

## Development Dependencies

### Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | 29.7.0 | Unit testing framework |
| `@testing-library/react` | 14.1.2 | React testing utilities |
| `@testing-library/jest-dom` | 6.2.0 | Jest DOM matchers |
| `@playwright/test` | 1.57.0 | E2E testing framework |

### Code Quality

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | 8.56.0 | JavaScript linter |
| `eslint-config-next` | 14.2.35 | Next.js ESLint config |
| `@typescript-eslint/*` | 6.19.0 | TypeScript ESLint plugins |
| `prettier` | 3.2.4 | Code formatter |

### Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| `autoprefixer` | 10.4.17 | CSS autoprefixer |
| `postcss` | 8.4.33 | CSS processor |
| `tsx` | 4.7.0 | TypeScript execution |
| `ts-node` | 10.9.2 | TypeScript Node.js |

## Python Scripts (Standard Library Only)

The repository includes Python scripts that use **only** the Python standard library:

### `scripts/nexus_analyzer.py`
**Dependencies**: Python 3.x standard library only
- `os`, `json`, `sys`, `subprocess`
- `pathlib`, `datetime`, `typing`, `argparse`

**Installation**: No additional packages required
```bash
python3 scripts/nexus_analyzer.py --help
```

### `tools/copilot_deep_dive.py`
**Dependencies**: Python 3.x standard library only
- `argparse`, `os`, `re`, `shlex`
- `subprocess`, `sys`, `dataclasses`
- `datetime`, `pathlib`, `typing`

**Installation**: No additional packages required
```bash
python3 tools/copilot_deep_dive.py --help
```

## Known Issues & Vulnerabilities

### Current Status (as of last audit)

```
7 vulnerabilities (2 low, 5 moderate)
```

### Production Vulnerabilities

#### 1. Cookie (Moderate)

**Package**: `cookie` < 0.7.0 (via `@supabase/ssr`)
**Issue**: Accepts cookie name, path, and domain with out of bounds characters
**Impact**: Low - Used only in server-side code with controlled inputs
**Status**: Waiting for `@supabase/ssr` update
**Mitigation**: Input validation in place, no user-supplied cookie names

#### 2. Lodash (Moderate)

**Package**: `lodash` 4.17.21
**Issue**: Prototype Pollution in `_.unset` and `_.omit` functions
**Impact**: Low - Not using affected functions in critical paths
**Status**: Can be fixed with `npm audit fix`
**Recommendation**: Update when convenient

#### 3. Next.js (Moderate)

**Package**: `next` 14.2.35
**Issue**: DoS vulnerability in Image Optimizer with remotePatterns
**Impact**: Low - Not using remotePatterns in production configuration
**Status**: Requires major version upgrade to 16.x
**Mitigation**: Image optimization configured safely
**Note**: Upgrade to 16.x would be breaking change

#### 4. PrismJS (Moderate)

**Package**: `prismjs` < 1.30.0 (via `@react-email/components`)
**Issue**: DOM Clobbering vulnerability
**Impact**: Low - Used only for email templates (server-side)
**Status**: Waiting for `@react-email/components` update
**Mitigation**: Not exposed to user input

### Development-Only Vulnerabilities

Additional vulnerabilities exist in development dependencies (ESLint, testing tools) that do not affect production builds.

### Security Recommendations

1. **Before Production Launch**:
   ```bash
   # Fix non-breaking updates
   npm audit fix
   
   # Review breaking changes
   npm audit fix --force --dry-run
   ```

2. **Regular Maintenance**:
   - Run `npm audit` monthly
   - Update dependencies quarterly
   - Monitor security advisories

3. **Production Security**:
   - Use `npm ci` for consistent installs
   - Use `--omit=dev` in production
   - Keep Node.js LTS updated

## Dependency Management

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update patch and minor versions
npm update

# Update specific package
npm update package-name

# Update to latest (including major versions)
npm install package-name@latest
```

### Version Pinning Strategy

The project uses:
- **Caret ranges** (`^x.y.z`) for most dependencies - allows minor and patch updates
- **Exact versions** for critical packages (Next.js, React)
- **Tilde ranges** (`~x.y.z`) for packages requiring stricter control

### Adding New Dependencies

Before adding a new dependency:

1. **Check if it's necessary** - Can existing packages solve the problem?
2. **Review package health**:
   - npm downloads and stars
   - Recent updates and maintenance
   - Bundle size impact
   - Security vulnerabilities
3. **Run security check**:
   ```bash
   npm audit
   ```
4. **Document in this file** if it's a core dependency

### Removing Dependencies

To safely remove a dependency:

```bash
# Remove from package.json and node_modules
npm uninstall package-name

# Verify application still works
npm run type-check
npm run build
npm test
```

## Bundle Size Management

### Analyzing Bundle Size

```bash
# Build with bundle analysis
npm run build

# Check .next/build-manifest.json for sizes
```

### Optimization Strategies

- **Code splitting** - Automatic per Next.js routes
- **Tree shaking** - Enabled by default in production
- **Dynamic imports** - Use for heavy components
- **Image optimization** - Via Next.js Image component

### Heavy Packages

Packages with significant bundle impact:
- `@radix-ui/*` - ~200KB combined (necessary for UI)
- `framer-motion` - ~60KB (animation library)
- `chart.js` + `d3` - ~150KB combined (data visualization)

## External Service Dependencies

These services are required at runtime but are not npm packages:

### Required (Phase 1)

1. **Supabase**
   - PostgreSQL database with pgvector extension
   - Authentication service
   - File storage
   - Row Level Security

2. **Stripe**
   - Payment processing
   - Webhook handling
   - Customer management

### Optional (Phase 2)

3. **OpenAI API**
   - Text embeddings (ada-002 model)
   - Recommendation engine

4. **Resend**
   - Transactional emails
   - Email templates

## Build Output

### Production Build

```bash
npm run build
```

Generates:
- `.next/` directory (~50-100MB)
- Optimized JavaScript bundles
- Static pages (where applicable)
- API routes

### Standalone Output

For Docker/containerized deployments:

```javascript
// next.config.js
output: 'standalone'
```

Generates:
- `.next/standalone/` - Self-contained build
- Includes only production dependencies
- ~500MB total (including node_modules)

## Troubleshooting

### npm install fails

**Solution**: Clear cache and reinstall
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Peer dependency warnings

**Expected**: Some packages have peer dependency warnings for React/Next.js versions. These are generally safe to ignore if the application builds and runs correctly.

### Postinstall script errors

If postinstall scripts fail:
```bash
npm install --ignore-scripts
```

### Out of memory during build

Increase Node.js memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

## License Compliance

### License Summary

- **MIT**: Majority of dependencies (permissive)
- **Apache-2.0**: Some Google/Firebase packages
- **BSD**: React, Next.js, and related packages
- **ISC**: Alternative permissive license

### Generating License Report

```bash
npx license-checker --summary
```

All dependencies use permissive licenses compatible with commercial use.

## Contributing

When contributing, ensure:

1. Run `npm install` after pulling changes
2. Commit `package-lock.json` changes
3. Document new dependencies in this file
4. Run `npm audit` before submitting PRs
5. Update versions in this document when upgrading major dependencies

## Support

For dependency-related issues:

1. Check this document first
2. Search [npm documentation](https://docs.npmjs.com/)
3. Check package GitHub repositories
4. Open an issue with details of the dependency problem
