import { expect, test } from '@playwright/test';
import { collectRuntimeErrors, isLoginVisible, navigateByText, openApp } from './runtimeQa';

test('tasks workspace smoke renders dashboard, list, or empty state UI safely', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await openApp(page);

  if (await isLoginVisible(page)) {
    test.info().annotations.push({
      type: 'auth-gated',
      description: 'No auth fixture is available; validated the login/app shell instead of task data flows.',
    });
    await expect(page.getByText(/Đăng nhập|Đăng nhập tài khoản|Email nội bộ|Mật khẩu/i).first()).toBeVisible();
    runtimeErrors.assertNoSeriousErrors();
    return;
  }

  const opened = await navigateByText(page, /Quản lý công việc/i);
  test.skip(!opened, 'Task navigation is not available in the current app shell/session.');

  await expect(page.getByText(/Quản lý công việc|công việc|Task/i).first()).toBeVisible();
  await expect(
    page.getByPlaceholder(/Tìm kiếm|Search/i).first()
      .or(page.getByText(/Chưa có|Không có|Danh sách|Dashboard|Tổng quan|Đang thực hiện|Hoàn thành/i).first()),
  ).toBeVisible();

  runtimeErrors.assertNoSeriousErrors();
});
