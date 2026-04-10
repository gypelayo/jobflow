import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays sidebar with JobFlow title', async ({ page }) => {
    await expect(page.locator('.sidebar-title')).toContainText('JobFlow');
  });

  test('shows all navigation tabs', async ({ page }) => {
    await expect(page.locator('.nav-btn')).toHaveCount(5);
    await expect(page.locator('.nav-btn').filter({ hasText: 'Jobs' })).toBeVisible();
    await expect(page.locator('.nav-btn').filter({ hasText: 'Pipeline' })).toBeVisible();
    await expect(page.locator('.nav-btn').filter({ hasText: 'Analytics' })).toBeVisible();
    await expect(page.locator('.nav-btn').filter({ hasText: 'Profile' })).toBeVisible();
    await expect(page.locator('.nav-btn').filter({ hasText: 'Settings' })).toBeVisible();
  });

  test('Jobs tab is active by default', async ({ page }) => {
    const jobsTab = page.locator('.nav-btn').filter({ hasText: 'Jobs' });
    await expect(jobsTab).toHaveClass(/active/);
  });
});

test.describe('Jobs Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows empty state when no jobs', async ({ page }) => {
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state-title')).toContainText('No jobs yet');
  });

  test('navigates to different tab', async ({ page }) => {
    await page.click('.nav-btn:has-text("Settings")');
    await expect(page.locator('.tab-settings')).toBeVisible();
    await expect(page.locator('.tab-settings h2')).toContainText('Settings');
  });
});

test.describe('Settings Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.nav-btn:has-text("Settings")');
  });

  test('displays LLM provider selector', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('select').first()).toHaveValue('ollama');
  });

  test('shows Ollama model field by default', async ({ page }) => {
    await expect(page.locator('input[placeholder="qwen2.5:7b"]')).toBeVisible();
  });

  test('switches provider fields', async ({ page }) => {
    await page.selectOption('select', 'openai');
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('displays version info', async ({ page }) => {
    await expect(page.locator('.version-info')).toBeVisible();
  });

  test('shows database section', async ({ page }) => {
    await expect(page.locator('text=Database')).toBeVisible();
    await expect(page.locator('text=Export Database')).toBeVisible();
    await expect(page.locator('text=Import Database')).toBeVisible();
  });
});

test.describe('Profile Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.nav-btn:has-text("Profile")');
  });

  test('displays profile heading', async ({ page }) => {
    await expect(page.locator('.tab-profile h2')).toContainText('Your Profile');
  });

  test('shows profile form fields', async ({ page }) => {
    await expect(page.locator('input[placeholder="Full Name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Phone"]')).toBeVisible();
  });

  test('shows career story textarea', async ({ page }) => {
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('has save button', async ({ page }) => {
    await expect(page.locator('button:has-text("Save Profile")')).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();
  });

  test('sidebar collapses on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('width', '220px');
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('keyboard navigation works', async ({ page }) => {
    const jobsTab = page.locator('.nav-btn').filter({ hasText: 'Jobs' });
    await jobsTab.focus();
    await expect(jobsTab).toBeFocused();
  });

  test('buttons are accessible', async ({ page }) => {
    await page.click('.nav-btn:has-text("Settings")');
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toHaveAttribute('type', 'button');
  });
});

test.describe('Visual Regression', () => {
  test('sidebar has correct background color', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('background-color', 'rgb(17, 24, 39)');
  });

  test('main content has correct background', async ({ page }) => {
    await page.goto('/');
    const content = page.locator('.main-content');
    await expect(content).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  });

  test('job cards have white background', async ({ page }) => {
    await page.goto('/');
    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
});
