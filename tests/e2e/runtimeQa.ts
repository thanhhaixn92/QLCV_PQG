import { expect, type ConsoleMessage, type Page } from '@playwright/test';

const FATAL_RUNTIME_ERROR_PATTERNS = [
  /Cannot access .* before initialization/i,
  /ReferenceError/i,
  /TypeError/i,
  /Uncaught Error/i,
  /Uncaught \(in promise\)/i,
];

const CONSOLE_ERROR_ALLOWLIST = [
  // Browser/extensions or local preview noise that is not an application runtime crash.
  /favicon\.ico/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /ResizeObserver loop limit exceeded/i,
];

export type RuntimeErrorCollector = {
  assertNoSeriousErrors: () => void;
};

function messageText(message: ConsoleMessage): string {
  return [message.text(), message.location().url, String(message.location().lineNumber || '')]
    .filter(Boolean)
    .join(' ');
}

function isAllowedConsoleError(text: string): boolean {
  return CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(text));
}

function isFatalRuntimeError(text: string): boolean {
  return FATAL_RUNTIME_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function collectRuntimeErrors(page: Page): RuntimeErrorCollector {
  const failures: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = messageText(message);
    if (isFatalRuntimeError(text) || !isAllowedConsoleError(text)) {
      failures.push(`console.error: ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    const text = error.stack || error.message || String(error);
    if (isFatalRuntimeError(text) || !isAllowedConsoleError(text)) {
      failures.push(`pageerror: ${text}`);
    }
  });

  return {
    assertNoSeriousErrors: () => {
      expect(failures, failures.join('\n')).toEqual([]);
    },
  };
}

export async function openApp(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).not.toBeEmpty();
  await page.waitForLoadState('networkidle').catch(() => undefined);
}

export async function expectAppNotBlank(page: Page): Promise<void> {
  const visibleText = (await page.locator('body').innerText()).trim();
  expect(visibleText.length).toBeGreaterThan(0);
  await expect(page.locator('#root')).toBeVisible();
}

export async function isLoginVisible(page: Page): Promise<boolean> {
  const loginSignals = page.getByText(/Đăng nhập|Đăng nhập tài khoản|Email nội bộ|Mật khẩu/i);
  return (await loginSignals.count()) > 0 && (await loginSignals.first().isVisible().catch(() => false));
}

export async function clickIfVisible(page: Page, label: string | RegExp): Promise<boolean> {
  const target = page.getByRole('button', { name: label }).first();
  if ((await target.count()) === 0 || !(await target.isVisible().catch(() => false))) return false;

  await target.click();
  return true;
}

export async function navigateByText(page: Page, label: string | RegExp): Promise<boolean> {
  const exactButton = page.getByRole('button', { name: label }).first();
  if ((await exactButton.count()) > 0 && (await exactButton.isVisible().catch(() => false))) {
    await exactButton.click();
    return true;
  }

  const textTarget = page.getByText(label).first();
  if ((await textTarget.count()) > 0 && (await textTarget.isVisible().catch(() => false))) {
    await textTarget.click();
    return true;
  }

  return false;
}
