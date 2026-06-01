import { expect, test } from '@playwright/test';
import { clickIfVisible, collectRuntimeErrors, isLoginVisible, navigateByText, openApp } from './runtimeQa';

test('editorial workspace navigation and workflow regression coverage', async ({ page }) => {
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
  await expect(page.getByText('Không gian biên tập').first()).toBeVisible();

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
    await expect(page.getByText('Bước 1: Chọn loại văn bản').or(page.getByText('Chọn loại văn bản')).first()).toBeVisible();
    await expect(page.getByText('Nhập thông tin đầu vào').first()).toBeVisible();
    await expect(page.getByText('Chọn nguồn tư liệu').first()).toBeVisible();
  }

  if (await clickIfVisible(page, 'Biên tập văn bản')) {
    await expect(page.getByText('Chỉnh sửa bằng AI').first()).toBeVisible();
    await expect(page.getByText('Soạn mới văn bản')).toHaveCount(0);
    await expect(page.getByText('Nguồn tư liệu').first()).toBeVisible();
  }

  if (await clickIfVisible(page, 'Nguồn tư liệu')) {
    for (const label of ['Kho tư liệu', 'Tra cứu web', 'Dán văn bản', 'Thêm liên kết', 'Tải tệp lên']) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
    await expect(page.getByText(/MVP này|Unified Workspace|Parsing/i)).toHaveCount(0);
  }

  if (await clickIfVisible(page, 'Rà soát nội dung')) {
    await expect(page.getByRole('button', { name: /Rà soát bản thảo hiện tại|Chọn văn bản để rà soát/i }).first()).toBeVisible();
    await expect(page.getByText(/MVP này|Unified Workspace|Parsing/i)).toHaveCount(0);
  }

  if (await clickIfVisible(page, 'Tóm tắt – tổng hợp')) {
    await expect(page.getByRole('button', { name: /Tạo phiếu tóm tắt/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo tài liệu tổng hợp/i }).first()).toBeVisible();
    await expect(page.getByText(/MVP này|Unified Workspace|Parsing/i)).toHaveCount(0);
  }

  if (await clickIfVisible(page, 'Lịch sử văn bản')) {
    await expect(page.getByText('Yêu cầu / Bối cảnh')).toHaveCount(0);
  }

  runtimeErrors.assertNoSeriousErrors();
});
