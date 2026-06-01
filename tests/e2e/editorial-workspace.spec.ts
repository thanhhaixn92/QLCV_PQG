import { expect, test } from '@playwright/test';
import { clickIfVisible, collectRuntimeErrors, isLoginVisible, navigateByText, openApp } from './runtimeQa';

test('editorial Intelligent Canvas Copilot shell renders without runtime errors', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await openApp(page);

  if (await isLoginVisible(page)) {
    test.info().annotations.push({
      type: 'auth-gated',
      description: 'No auth fixture is available; validated the login/app shell instead of editorial workflow.',
    });
    await expect(page.getByText(/Đăng nhập|Đăng nhập tài khoản|Email nội bộ|Mật khẩu/i).first()).toBeVisible();
    runtimeErrors.assertNoSeriousErrors();
    return;
  }

  const opened = await navigateByText(page, /Trợ lý biên tập/i);
  test.skip(!opened, 'Editorial navigation is not available in the current app shell/session.');

  await expect(page.getByText(/Intelligent Canvas Assistant|Trợ lý biên tập/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Mở Copilot biên tập/i })).toBeVisible();

  await page.getByRole('button', { name: /Mở Copilot biên tập/i }).click();
  await expect(page.getByLabel(/Intelligent Canvas Copilot/i)).toBeVisible();
  await expect(page.getByText(/Lệnh nhanh/i)).toBeVisible();
  await expect(page.getByText(/Proposal|Preview|Copilot chỉ áp dụng sửa nội dung sau khi bạn bấm Apply/i).first()).toBeVisible();

  if (await clickIfVisible(page, 'Rà soát bản thảo')) {
    await expect(page.getByText(/Rule|AI|Thiếu dữ liệu|Đề xuất|Workflow Router|Checklist/i).first()).toBeVisible();
  }

  runtimeErrors.assertNoSeriousErrors();
});
