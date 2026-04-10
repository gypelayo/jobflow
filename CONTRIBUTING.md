# Contributing to JobFlow

Thanks for your interest!

## Setup

```bash
cd extension/dashboard
npm install
npm run dev        # dev server
npm test           # run all tests
npm run lint       # TypeScript check
```

Load the `extension/` folder as an unpacked extension in Chrome (`chrome://extensions/`) or Firefox (`about:debugging`).

## Making changes

1. Branch from `main`: `git checkout -b your-feature`
2. Make changes, add tests
3. `npm run lint && npm test` — both must pass
4. Open a PR with a clear description

## Code conventions

- TypeScript strict mode throughout
- Preact for UI — hooks, no class components
- CSS custom properties for theming (`styles/main.css`)
- All SQL goes through `sqlVal()` in `queries.ts` — no parameter binding (broken in Firefox WASM context)
- No inline comments unless the code is genuinely non-obvious

## Tests

- Unit tests live alongside source files as `*.test.ts` / `*.test.tsx`
- Use factories from `src/test/factories.ts`: `makeJob()`, `makeProfile()`, `makeSettings()`
- Mock the api layer with `vi.mock('@/lib/api', ...)`
- Mock `useLicense` as active when testing gated components

## Extension structure

```
extension/
├── background.js          # Background script (extraction, LLM calls)
├── content.js             # Content script (DOM scraping)
├── manifest.json          # Firefox MV3
├── manifest_chrome.json   # Chrome MV3
└── dashboard/src/
    ├── components/        # UI
    ├── lib/               # DB, queries, LLM, insights, license, storage
    ├── hooks/             # useJobs, useProfile, useLicense, useAgentSync
    ├── types/index.ts     # All shared types
    └── styles/main.css    # Single stylesheet
```

See [PROJECT_MAP.md](PROJECT_MAP.md) for the full architecture.

## Issues

- **Bugs:** include browser, version, steps to reproduce
- **Features:** explain the use case, not just the solution

## License

Contributions are MIT licensed.
