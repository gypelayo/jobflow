# JobFlow Roadmap

## What's shipped (v0.4.0)

- One-click AI job extraction from any page (LinkedIn, Greenhouse, Wellfound, any site)
- Pipeline management (Kanban drag-and-drop)
- Analytics dashboard (skills by category, skills by pipeline stage, top job titles)
- Ghosted job detection — flags applications with no response after N days
- Agent export — dump jobs to `~/.jobflow/db.json` for AI agents to read and update
- Onboarding flow
- Cross-browser: Chrome and Firefox
- Fully local — no servers, no tracking

## Active

- **Bundle licensing** — license key infrastructure for the Job Search Bundle ✅
- **CV generation gate** — CV generation gated behind active bundle ✅
- **Paywall UI** — inline locked-state component for gated features ✅

## Backlog

- **Insights engine** — surface patterns from the user's own data: response rate by company size, skill correlation, seniority mismatch warnings ([#1](https://github.com/gypelayo/jobflow/issues/1))
- **Multiple profiles** — separate pipelines and analytics per search strategy ([#2](https://github.com/gypelayo/jobflow/issues/2))
- **Hosted AI** — no API key required for extractions, bundle-only ([#3](https://github.com/gypelayo/jobflow/issues/3))
- **Demo mode** — seeded data so users see analytics before entering any jobs ([#4](https://github.com/gypelayo/jobflow/issues/4))

## Pricing

**Free forever:**
- Unlimited job tracking and extraction (bring your own API key)
- Pipeline, analytics, ghosted detection, agent export

**Job Search Bundle — €29 one-time (90 days):**
- CV generation (tailored resume per job)
- Insights engine (when shipped)
- Hosted AI — no API key needed (when shipped)
- Multiple profiles (when shipped)
- Extend for €10/90 days if still searching
