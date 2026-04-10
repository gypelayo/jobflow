# Release Process

## Overview

This project uses a **single unified workflow** that handles everything on merge to `main`:

1. Runs tests and type checking
2. Auto-bumps version based on commits
3. Builds the dashboard
4. Packages Chrome and Firefox extensions
5. Creates a GitHub release
6. Deploys docs to GitHub Pages

## Automated Releases

**Trigger**: Every push to `main` branch

**What happens**:
1. CI job runs tests (`npm test` and `npm run lint`)
2. If CI passes, release job:
   - Determines version bump from commit messages
   - Updates version in `package.json` and manifests
   - Builds dashboard
   - Creates extension packages (Chrome + Firefox)
   - Creates git tag and GitHub release
   - Deploys `docs/` folder to GitHub Pages

## Version Bumping

| Commit Type | Bump |
|-------------|------|
| `feat:` or `:sparkles:` | minor |
| `fix:` or regular commits | patch |
| `BREAKING CHANGE:` or `:boom:` | major |

## Manual Control

To override auto-detection, trigger the workflow manually:

1. Go to **Actions** → **CI/CD**
2. Click **Run workflow**
3. Select bump type: `auto`, `patch`, `minor`, or `major`

## Version Files

All synchronized automatically:
- `extension/dashboard/package.json`
- `extension/manifest.json`
- `extension/manifest_chrome.json`

## Best Practices

### Commit Messages

Use conventional commits for automatic version detection:

```bash
feat: add new feature        # minor bump
fix: fix bug                 # patch bump
feat!: breaking change       # major bump
docs: update readme          # patch bump (no change)
refactor: reorganize code    # patch bump (no change)
```

### Version Format

Semantic versioning: `MAJOR.MINOR.PATCH` (e.g., `0.3.6`)

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

## GitHub Pages

The `docs/` folder is deployed to: https://gypelayo.github.io/jobflow

This includes:
- Landing page (`docs/index.html`)
- Installation guide (`docs/install.html`)
- Documentation files

## Quick Reference

```bash
# Regular development - just merge to main
git checkout -b feature/my-feature
git commit -m "feat: add new feature"
git push origin feature/my-feature
# Create PR and merge to main → auto-release
```
