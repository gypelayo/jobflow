# Testing Guide

## Overview

This project uses **Vitest** for unit testing with **jsdom** for DOM simulation and **@testing-library/preact** for component testing.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Open Vitest UI
npm run test:ui

# Type check
npm run lint
```

## Test Structure

```
src/
├── components/
│   ├── *.test.tsx    # Component tests
│   └── *.tsx         # Component source
├── lib/
│   ├── *.test.ts     # Utility/function tests
│   └── *.ts          # Utility source
├── test/
│   ├── setup.ts      # Global test setup & Chrome mocks
│   ├── factories.ts  # Test data factories
│   └── integration/  # Integration tests
└── types/
    └── index.ts      # TypeScript types
```

## Test Utilities

### Factories (`src/test/factories.ts`)

Pre-built factory functions for creating test data:

```typescript
import { makeJobSummary, makeProfile, makeSettings } from '@/test/factories';

// Create a job with default values
const job = makeJobSummary();

// Create a job with custom values
const job = makeJobSummary({
  status: 'applied',
  company: 'Custom Corp',
  skills: ['Go', 'Rust'],
});

// Create multiple jobs
const jobs = makeManyJobs(5);

// Create jobs with different statuses
const allJobs = makeJobsWithStatuses();
```

Available factories:
- `makeJobSummary()` - Creates a `JobSummary` object
- `makeJobFull()` - Creates a `JobFull` object
- `makeJobExtracted()` - Creates a `JobExtracted` object
- `makeProfile()` - Creates a `Profile` object
- `makeSettings()` - Creates `AppSettings` with defaults
- `makeAnalytics()` - Creates `AnalyticsData`
- `makeManyJobs(count)` - Creates multiple jobs
- `makeJobsWithStatuses()` - Creates jobs for all statuses

### Chrome Mock Utilities (`src/test/setup.ts`)

Utilities for mocking Chrome extension APIs:

```typescript
import { triggerChromeMessage, setChromeStorage, resetChromeStorage } from '@/test/setup';

// Simulate a message from background script
triggerChromeMessage('jobExtracted', { job: extractedJob });

// Set storage data
setChromeStorage('sync', 'settings', newSettings);

// Reset storage between tests
resetChromeStorage();
```

### Message Triggering (`src/test/setup.ts`)

Simulate chrome.runtime.onMessage events:

```typescript
import { triggerChromeMessage } from '@/test/setup';

// Simulate extraction started
triggerChromeMessage('extractionStarted');

// Simulate job extracted
triggerChromeMessage('jobExtracted', { job: extractedJob });
```

## Testing Components

### Basic Component Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/preact';
import { MyComponent } from '@/components/MyComponent';
import { makeJobSummary } from '@/test/factories';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders job title', () => {
    const job = makeJobSummary({ title: 'Software Engineer' });
    const { getByText } = render(<MyComponent job={job} />);
    expect(getByText('Software Engineer')).toBeTruthy();
  });
});
```

### Testing User Interactions

Prefer `userEvent` over `fireEvent` for more realistic interaction testing:

```typescript
import { userEvent } from '@testing-library/user-event';
import { render, screen } from '@testing-library/preact';

// Setup user event
const user = userEvent.setup();

await user.click(screen.getByRole('button', { name: 'Save' }));
await user.type(screen.getByLabelText('Name'), 'John');
await user.selectOptions(screen.getByRole('combobox'), 'remote');
```

### Testing Async Operations

```typescript
import { render, waitFor } from '@testing-library/preact';

it('loads jobs asynchronously', async () => {
  const { getByText } = render(<JobsList />);
  
  await waitFor(() => {
    expect(getByText('Software Engineer')).toBeTruthy();
  });
});
```

### Mocking API Calls

```typescript
vi.mock('@/lib/api', () => ({
  listJobs: vi.fn().mockResolvedValue([makeJobSummary()]),
  getJob: vi.fn().mockResolvedValue(makeJobFull()),
}));

// Access mocked functions
const api = await import('@/lib/api');
vi.mocked(api.listJobs).mockResolvedValue([newJob]);
```

### Mocking Storage

```typescript
vi.mock('@/lib/storage', () => ({
  loadSettings: vi.fn().mockResolvedValue(makeSettings()),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));
```

## Best Practices

1. **Use factories** - Always use factory functions from `factories.ts` instead of inline objects
2. **Reset mocks** - Call `vi.clearAllMocks()` in `beforeEach`
3. **Use semantic queries** - Prefer `getByRole`, `getByLabelText` over `getByText`
4. **Test behavior, not implementation** - Focus on what the UI does, not how
5. **Keep tests isolated** - Each test should be independent
6. **Use `async`/`await`** - For tests involving promises
7. **Test edge cases** - Empty states, loading, errors

## Coverage

Generate coverage reports to identify untested code:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory:
- `index.html` - HTML report (open in browser)
- `lcov.info` - LCOV format for CI tools
- `coverage.json` - JSON format for tooling

## Common Patterns

### Testing Empty States

```typescript
it('shows empty state when no jobs', () => {
  const { getByText } = render(<JobsTab jobs={[]} />);
  expect(getByText('No jobs yet')).toBeTruthy();
});
```

### Testing Error States

```typescript
it('shows error message', () => {
  const { getByText } = render(<JobsTab error="Failed to load" />);
  expect(getByText('Failed to load')).toBeTruthy();
});
```

### Testing Loading States

```typescript
it('shows loading spinner', () => {
  const { container } = render(<JobsTab loading={true} />);
  expect(container.querySelector('.spinner')).toBeTruthy();
});
```

### Testing Form Submissions

```typescript
import { screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();

it('submits form with entered values', async () => {
  render(<ProfileForm onSubmit={handleSubmit} />);
  
  await user.type(screen.getByLabelText('Full Name'), 'John Doe');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  
  expect(handleSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ fullName: 'John Doe' })
  );
});
```

## Debugging Tests

### Print rendered HTML

```typescript
const { container } = render(<MyComponent />);
console.log(container.innerHTML);
```

### Print current mocks

```typescript
console.log(vi.mocked(api.listJobs).mock.calls);
```

### Run single test

```typescript
it.only('specific test', () => { ... });
it.skip('skipped test', () => { ... });
```
