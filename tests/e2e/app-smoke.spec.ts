import { expect, test } from '@playwright/test';
import { collectRuntimeErrors, expectAppNotBlank, isLoginVisible, openApp } from './runtimeQa';

test('app opens without a blank screen or fatal runtime errors', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await openApp(page);
  await expectAppNotBlank(page);

  if (await isLoginVisible(page)) {
    await expect(page.getByText(/Đăng nhập|Đăng nhập tài khoản|Email nội bộ|Mật khẩu/i).first()).toBeVisible();
  } else {
    await expect(
      page.getByRole('navigation').first().or(page.getByText(/Trang chủ|Quản lý công việc|Trợ lý biên tập/i).first()),
    ).toBeVisible();
  }

  runtimeErrors.assertNoSeriousErrors();
});
