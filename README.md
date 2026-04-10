# JobFlow

**The dashboard for agentic job hunting — manual or fully automated via AI agents.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

JobFlow is an open-source browser extension for tracking job applications. Use it manually — click to extract any job posting with AI — or export your job database so AI agents can read and update your pipeline. All data stays in your browser — no servers, no tracking.

## Features

- **Smart Extraction** — AI extracts job requirements, skills, salary, and company info from any job posting
- **Agent Export** — Export your job database as `~/.jobflow/db.json` so AI agents can read, update, and add jobs; includes an `AGENTS.md` guide so agents understand the file format
- **Pipeline & Analytics** — Drag-and-drop Kanban board, skill trend charts, and rejection tracking
- **Tailored CVs** — Generate customized resumes for each application using AI
- **Cloud Sync** — Sync across devices via a private GitHub Gist (no servers)
- **Privacy-First** — All data in your browser, works with local AI (Ollama) or cloud providers; fully offline-capable

**Supported sites:** LinkedIn, Greenhouse, Wellfound, and any job posting.

**Supported AI providers:** OpenAI, Anthropic, Google Gemini, Perplexity, Ollama (local).

## AI Agent Integration

Connect AI agents (Claude, Cursor, OpenCode, etc.) to your JobFlow data:

1. **Export your data** — In Settings, export your database as `db.json`
2. **Share with your AI** — Point your AI agent to `~/.jobflow/db.json`
3. **Use the prompt** — Copy the prompt from `.jobflow.md` to guide the AI

### Agent integration

Allow AI agents to read and update the job pipeline by reading/writing `~/.jobflow/db.json`.

#### How it works

1. **Export for Agents** — Click "Export for Agents" in Settings. Two files are downloaded:
   - `db.json` — your jobs and profile in a structured JSON format
   - `AGENTS.md` — a guide for AI agents explaining the file structure

2. **Save to `~/.jobflow/`** — Move both files to `~/.jobflow/`. Any agent with access to your filesystem can now read and modify your job pipeline.

3. **Agent modifies the file** — The agent reads `db.json`, updates job statuses, adds notes, scores jobs, or adds new opportunities, then writes the file back.

4. **Import back** — In Settings → Agent Export, click "Import db.json" to pull the agent's changes back into the extension.

The `AGENTS.md` file explains the full schema so any agent can understand the file without needing additional context.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what's shipped, what's being worked on, and what's planned.

## Chrome Web Store — Pre-submission Checklist

Before submitting to the Chrome Web Store, the following must be resolved:

### Blockers (will cause rejection)

- [x] **Convert icons to PNG** — Converted SVG icons to PNG at 16, 48, and 128px using ImageMagick. Updated both manifests and build config.
- [x] **Fix build to copy icons into dist** — Updated `vite.config.ts` to copy PNG icons (`icon.png`) at 16, 48, and 128px into dist. Verified build output.
- [x] **Add a privacy policy page** — Created `docs/privacy-policy.html` with dark theme matching the extension. This page needs to be hosted (e.g., on GitHub Pages at `https://gypelayo.github.io/jobflow/privacy-policy.html`) and linked in the Chrome Web Store listing.
- [x] **Prepare `<all_urls>` justification** — The extension needs `<all_urls>` to read job posting content from any site (LinkedIn, Greenhouse, Wellfound, company career pages, etc.) and extract structured job data via AI. Without this permission, the content script cannot scrape job details on arbitrary URLs. No user data is collected or transmitted beyond the user's chosen AI provider endpoint.

**Copy-paste for Chrome Web Store review form:**
```
JobFlow is a job application tracker that works on any job posting website. The extension needs <all_urls> permission because job postings appear on thousands of different domains (LinkedIn, Greenhouse, Lever, Wellfound, company career pages, etc.). The content script reads the visible text on the current tab's job posting page so the AI can extract structured data (title, company, requirements, skills). No data is collected, tracked, or sent anywhere except the user's own configured AI provider (OpenAI, Anthropic, Google, Ollama local). The user explicitly triggers extraction via the extension popup — no background scraping occurs.
```

### High priority (will hurt conversions)

- [x] **Onboarding / empty state** — Added a 4-step onboarding modal that appears on first run, guiding users through: welcome, AI provider configuration, job extraction, and getting started. After completion, users are redirected to Settings to configure their AI provider.
- [x] **Store screenshots** — Captured 9 screenshots (1280x640) covering: Onboarding (4), Pipeline, Jobs List, Job Detail, Profile, and Generate CV. Stored in `store-screenshots/` directory.

### Polish

- [x] **Fix version number consistency** — Updated all version numbers from `0.3.6` to `0.4.0` to match the latest git tag. Updated manifest files, package.json, options.html, and test files.
- [x] **Fix `options.html` theme** — Updated options page to use dark theme matching the dashboard (dark background #0d1117, surface #161b22, accent gradient cyan to purple). Also updated favicon references to PNG.

---

## Install

See the [Install Guide](docs/install.html) for step-by-step instructions.

**Chrome:** Download the zip from [Releases](https://github.com/gypelayo/jobflow/releases), unzip, go to `chrome://extensions/`, enable Developer mode, click "Load unpacked".

**Firefox:** Download the Firefox zip from [Releases](https://github.com/gypelayo/jobflow/releases), unzip, go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on".

## Development

```bash
cd extension/dashboard
npm install
npm run dev        # Development server
npm test           # Run tests
npm run build      # Production build
npm run lint       # Type check
```

See [TESTING.md](extension/dashboard/TESTING.md) for the full testing guide.

## Version Management

Version numbers are maintained across multiple files. Use the provided scripts to ensure consistency:

```bash
# Check if all versions are in sync
./scripts/check-versions.sh

# Bump version (major/minor/patch or specific version)
./scripts/bump-version.sh patch    # 0.4.0 -> 0.4.1
./scripts/bump-version.sh minor    # 0.4.0 -> 0.5.0
./scripts/bump-version.sh major    # 0.4.0 -> 1.0.0
./scripts/bump-version.sh 1.2.3    # -> 1.2.3
```

**Files that must stay in sync:**
- `extension/dashboard/package.json`
- `extension/manifest.json`
- `extension/manifest_chrome.json`
- `extension/options.html`
- `extension/dashboard/src/test/setup.ts`
- `docs/privacy-policy.html`

On each release, the CI workflow automatically updates all version references when a new tag is created.

## Contributing

Contributions are welcome! Please:

1. Check [existing issues](https://github.com/gypelayo/jobflow/issues) first
2. Open an issue before large PRs
3. Follow the existing code style
4. Add tests for new features
5. Run `npm run lint && npm test` before submitting

## Analytics

Download and page visit stats are tracked via [GoatCounter](https://jobflow.goatcounter.com/) — a privacy-friendly, open-source analytics service. You can view public download counts and visit trends there.

## License

[MIT](LICENSE)