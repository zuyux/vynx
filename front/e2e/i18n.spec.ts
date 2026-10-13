import { test, expect } from '@playwright/test';

test.describe('Spanish localization', () => {
  test.use({ locale: 'es-PE' });

  test('device detection, localized navigation, and saved English override', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { name: /TU ESPACIO/ })).toBeVisible();
    await expect(page.locator('footer').getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('footer').getByRole('link', { name: 'Documentación', exact: true }).click();
    await expect(page).toHaveURL(/\/es\/docs$/);
    await expect(page.getByRole('heading', { name: /VYNX/ }).first()).toBeVisible();
    await page.goto('/es/help/terms?source=footer#legal');
    await expect(page.getByRole('heading', { name: 'Términos de uso' })).toBeVisible();
    await page.locator('footer').getByRole('button', { name: 'English', exact: true }).click();
    await expect(page).toHaveURL(/\/help\/terms\?source=footer#legal$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/es$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(errors).toEqual([]);
  });

  test('Spanish deep links translate dashboard access and legal content', async ({ page }) => {
    await page.goto('/es/dashboard/card');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { name: 'Desbloquea tu panel' })).toBeVisible();
    await page.goto('/es/help/privacy');
    await expect(page.getByRole('heading', { name: 'Aviso de privacidad' })).toBeVisible();
    await expect(page.locator('footer').getByRole('link', { name: 'Términos', exact: true })).toHaveAttribute('href', '/es/help/terms');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es\/help\/privacy$/);
  });
});

test('English devices can select and persist Spanish from the footer', async ({ page, context }) => {
  await context.addCookies([{ name: 'VYNX_LOCALE', value: 'en', domain: 'localhost', path: '/' }]);
  await page.goto('/help/fees');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('footer').getByRole('button', { name: 'Español' }).click();
  await expect(page).toHaveURL(/\/es\/help\/fees$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.goto('/support');
  await expect(page).toHaveURL(/\/es\/support$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
