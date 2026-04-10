# Project Map

## What is this

**JobFlow** is a browser extension (Chrome + Firefox) for tracking job applications. Users extract job postings with AI, manage them through a pipeline, and get data-driven insights from their search. All data is stored locally in the browser — no backend, no accounts.

---

## Repo layout

```
job-tool/
├── extension/                   # Extension source
│   ├── background.js            # Background script — extraction coordinator
│   ├── content.js               # Content script — DOM scraping
│   ├── manifest.json            # Firefox manifest (MV3)
│   ├── manifest_chrome.json     # Chrome manifest (MV3)
│   ├── options.html             # Options page
│   ├── icons/                   # Extension icons (PNG + SVG, 16/32/48/128px)
│   └── dashboard/               # Preact dashboard app (main UI)
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── contexts/
│       │   ├── types/
│       │   ├── styles/
│       │   └── test/
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       └── package.json
├── docs/                        # GitHub Pages site
├── scripts/                     # Build, version, release scripts
├── store-screenshots/           # Chrome Web Store submission screenshots
├── .github/                     # CI/CD workflows and issue templates
├── README.md
├── ROADMAP.md
└── PROJECT_MAP.md               # This file
```

---

## Extension architecture

### `background.js`
Runs as a background script/service worker. Triggered when the user clicks the extension icon.

1. Detects the job site (LinkedIn, Greenhouse, Wellfound, or generic)
2. Injects `content.js` and scrapes the page, or hits the Greenhouse API directly
3. Calls the configured LLM with the scraped text
4. Parses the structured JSON response
5. Queues the extracted job in `chrome.storage.local` for the dashboard to drain
6. Updates the browser badge (orange = in progress, green = done, red = error)

**LLM providers supported:** JobFlow hosted, Ollama (local), OpenAI, Anthropic, Google Gemini, Perplexity

### `content.js`
Content script injected into job pages. Extracts visible text using site-specific selectors (LinkedIn, Wellfound, Remote Rocketship) or a generic DOM walker. Sends text back to `background.js` via `chrome.runtime.sendMessage`.

---

## Dashboard source map

```
src/
├── App.tsx                      # Root — tab routing, ghosted count, agent sync
│
├── components/
│   ├── Sidebar.tsx              # Navigation with badge support
│   ├── JobsTab.tsx              # Job list with search/filter
│   ├── JobDetail.tsx            # Job detail panel + tabs
│   ├── CvSection.tsx            # CV generation (bundle-gated)
│   ├── PipelineTab.tsx          # Kanban drag-and-drop
│   ├── RejectedTab.tsx          # Rejected + ghosted jobs
│   ├── AnalyticsTab.tsx         # Charts + insights section
│   ├── InsightsSection.tsx      # Data-driven insights (bundle-gated)
│   ├── BundleGate.tsx           # Paywall wrapper + PaywallCard
│   ├── ProfileTab.tsx           # User profile form
│   ├── SettingsTab.tsx          # Provider config, license, ghosted threshold
│   ├── Onboarding.tsx           # First-run onboarding flow
│   └── Sidebar.tsx
│
├── lib/
│   ├── api.ts                   # Public API — thin wrapper over queries + llm
│   ├── db.ts                    # SQLite via sql.js WASM — init, persist, migrate
│   ├── queries.ts               # All SQL queries (no parameter binding — uses sqlVal)
│   ├── insights.ts              # Insights engine — SQL patterns, confidence scoring
│   ├── license.ts               # Bundle license — HMAC-SHA256 verify + generate
│   ├── llm.ts                   # LLM calls — all providers including hosted
│   ├── storage.ts               # chrome.storage.sync helpers + AppSettings defaults
│   ├── pdf.ts                   # CV → PDF via jsPDF
│   ├── markdown.ts              # Markdown → HTML renderer
│   ├── textutils.ts             # Text cleaning, truncation
│   └── seed.ts                  # Demo data seeder (?demo=true)
│
├── hooks/
│   ├── useJobs.ts               # Job list state + CRUD
│   ├── useProfile.ts            # Profile load/save
│   ├── useLicense.ts            # Active bundle license status
│   └── useAgentSync.ts          # File System Access API sync with ~/.jobflow/
│
├── contexts/
│   └── JobOpenContext.tsx        # Cross-component job open handler
│
├── types/
│   └── index.ts                 # All TypeScript types (JobSummary, AppSettings, Insight, etc.)
│
├── styles/
│   └── main.css                 # Single stylesheet — CSS custom properties, dark theme
│
└── test/
    ├── setup.ts                 # Vitest setup — chrome API mock, storage mock
    ├── factories.ts             # makeJob(), makeProfile(), makeSettings()
    └── integration/
        ├── background.test.ts
        └── content.test.ts
```

---

## Data model

All data lives in an in-browser SQLite database (sql.js WASM).

**`jobs` table** — one row per job posting:
- Identity: `source_url`, `extracted_at`
- Classification: `job_title`, `company_name`, `company_size`, `industry`, `seniority_level`, `job_function`
- Arrangement: `workplace_type`, `job_type`, `is_remote_friendly`
- Requirements: `years_experience_min/max`, `education_level`
- Compensation: `salary_min/max`, `salary_currency`, `has_equity`, etc.
- Tracking: `status`, `max_status`, `notes`, `rating`, `cv_markdown`, `updated_at`
- Raw: `raw_json` (full extracted blob)

**`job_skills` table** — normalised skills per job:
- `skill_name`, `skill_category` (programming_language, framework, database, cloud, devops, other)

**`profile` table** — single row (id=1):
- `full_name`, `email`, `current_role`, `years_experience`, `skills` (JSON array), `story_markdown`

---

## Agent integration

Export jobs to `~/.jobflow/db.json` from the Settings tab. The file schema:

```json
{
  "jobs": [
    {
      "id": 1,
      "sourceUrl": "https://...",
      "status": "applied",
      "notes": "...",
      "rating": 4,
      "extracted": { /* full JobExtracted object */ }
    }
  ],
  "profile": { /* Profile object */ },
  "exportedAt": "2026-04-10T00:00:00.000Z"
}
```

Valid `status` values: `saved → applied → interview-hr → interview-tech-intro → interview-tech-system → interview-tech-code → offer / rejected`

The extension auto-imports changes when opened (if connected via File System Access API).

---

## Pricing

**Free:** extraction (BYOK), pipeline, analytics, ghosted detection, agent export

**Bundle (€29 / 90 days):** CV generation, insights engine, hosted AI (no API key needed)

License keys are HMAC-SHA256 signed tokens. Verified client-side. Generate with:
```bash
node scripts/generate-license.js [days] [purchase-date]
```

---

## Development

```bash
cd extension/dashboard
npm install
npm run dev        # Dev server
npm test           # Run all tests (166 tests)
npm run lint       # TypeScript check
npm run build      # Production build → extension/dist/
```

Load `extension/` as unpacked extension in Chrome or Firefox.

See [TESTING.md](extension/dashboard/TESTING.md) for the full testing guide.
