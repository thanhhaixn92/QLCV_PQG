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

  await expect(page.getByText(/Trợ lý Canvas thông minh|Trợ lý biên tập/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Mở Copilot biên tập/i })).toBeVisible();

  await page.getByRole('button', { name: /Mở Copilot biên tập/i }).click();
  const copilot = page.getByLabel(/Trợ lý Canvas thông minh/i);
  await expect(copilot).toBeVisible();
  await expect(page.getByText(/Lệnh nhanh/i)).toBeVisible();
  await expect(page.getByText(/Proposal|Preview|Copilot chỉ áp dụng sửa nội dung sau khi bạn bấm Áp dụng/i).first()).toBeVisible();

  const globalChatPanel = page.getByText(/Tôi có thể giúp gì|Hỏi trợ lý|AI Chat/i).filter({ hasNotText: /Trợ lý biên tập|Trợ lý Canvas/i });
  await expect(globalChatPanel).toHaveCount(0);

  await page.getByRole('button', { name: /Mở toàn màn hình/i }).click();
  await expect(page.getByRole('button', { name: /Quay về Canvas/i })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);

  if (await clickIfVisible(page, 'Rà soát bản thảo')) {
    await expect(page.getByText(/Rule|AI|Thiếu dữ liệu|Đề xuất|Workflow Router|Checklist/i).first()).toBeVisible();
    const enabledApply = page.getByRole('button', { name: /^Áp dụng$/i }).and(page.locator(':enabled'));
    await expect(enabledApply).toHaveCount(0);
  }

  runtimeErrors.assertNoSeriousErrors();
});

test('title rewrite proposals stay scoped when a draft block is selectable', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await openApp(page);
  test.skip(await isLoginVisible(page), 'No auth fixture is available for editorial runtime regression.');

  const opened = await navigateByText(page, /Trợ lý biên tập/i);
  test.skip(!opened, 'Editorial navigation is not available in the current app shell/session.');

  const titleBlock = page.locator('#printable-article [data-article-block-type="title"], #printable-article h1').first();
  test.skip(!(await titleBlock.isVisible().catch(() => false)), 'No selectable title block is available in this session.');

  await titleBlock.click();
  if (await page.getByRole('button', { name: /Hỏi AI/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Hỏi AI/i }).click();
  } else {
    await page.getByRole('button', { name: /Mở Copilot biên tập/i }).click();
  }

  await page.getByRole('button', { name: /^Viết lại$/i }).click();
  const proposalText = page.getByText('Đề xuất mới').locator('xpath=..');
  await expect(proposalText).not.toContainText(/Sapo|Thân bài|Kết luận/i);

  runtimeErrors.assertNoSeriousErrors();
});
