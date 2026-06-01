import { expect, test } from '@playwright/test';
import { clickIfVisible, collectRuntimeErrors, isLoginVisible, navigateByText, openApp } from './runtimeQa';

test('editorial workspace navigation and non-AI create mode render', async ({ page }) => {
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

  await expect(page.getByText('Trợ lý biên tập').first()).toBeVisible();

  for (const label of [
    'Lịch sử văn bản',
    'Tạo văn bản mới',
    'Biên tập văn bản',
    'Rà soát nội dung',
    'Tóm tắt – tổng hợp',
    'Nguồn tư liệu',
  ]) {
    await expect(page.getByText(label).first()).toBeVisible();
  }

  if (await clickIfVisible(page, 'Tạo văn bản mới')) {
    await expect(page.getByText(/Tạo văn bản mới|Bài viết website/i).first()).toBeVisible();
  }

  runtimeErrors.assertNoSeriousErrors();
});
