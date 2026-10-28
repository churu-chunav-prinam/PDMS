import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Credentials come from the environment (never committed): ADMIN_USER/ADMIN_PASS, OFFICER_USER/OFFICER_PASS.
const env = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

const adminLogin = (page: Page, user: string, pass: string) => roleLogin(page, '/login/admin', user, pass, '.stat');

/** Username + password, the same form for both roles. Waits for that role's home screen. */
async function roleLogin(page: Page, card: '/login/admin' | '/login/officer', user: string, pass: string, home: string): Promise<void> {
  await page.goto(`/#${card}`);
  await page.getByLabel(/यूज़रनेम/).fill(user);
  await page.getByLabel(/पासवर्ड/).fill(pass);
  await page.getByRole('button', { name: 'लॉगिन करें' }).click();
  await expect(page.locator(home).first()).toBeVisible();
}
const officerLogin = (page: Page) => roleLogin(page, '/login/officer', env('OFFICER_USER'), env('OFFICER_PASS'), '.facts');

/** No horizontal page scroll; every visible element (buttons included) lies fully inside the viewport width. */
async function checkLayout(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Inside a deliberately scrollable box (the wide turnout table) is fine.
      if (el.closest('.table-wrap')) continue;
      const label = `${el.tagName.toLowerCase()}.${el.className || ''} "${(el.textContent ?? '').trim().slice(0, 30)}"`;
      if (r.left < -1 || r.right > vw + 1) out.push(`outside viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${vw}): ${label}`);
      const style = getComputedStyle(el);
      const clips = style.overflowX === 'hidden' || style.textOverflow === 'ellipsis';
      if (!clips && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && style.overflowX !== 'auto') {
        out.push(`text cut off (${el.scrollWidth} > ${el.clientWidth}): ${label}`);
      }
      if (el.matches('button, a.btn, .btn') && r.height < 44) out.push(`button too small (${Math.round(r.height)}px): ${label}`);
    }
    return [...new Set(out)].slice(0, 25);
  });
  await page.screenshot({ path: `test-results/${test.info().project.name}-${name}.png`, fullPage: true });
  expect.soft(problems, `${name}:\n${problems.join('\n')}`).toEqual([]);
}

test('public entry: landing and both login pages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-card')).toHaveCount(3);
  await expect(page.locator('.landing-card-off')).toHaveAttribute('aria-disabled', 'true');
  await checkLayout(page, 'landing');
  await page.goto('/#/login'); // an old URL falls back to the landing page
  await expect(page.locator('.landing-cards')).toBeVisible();
  await page.locator('.landing-card', { hasText: 'जिला प्रशासन लॉगिन' }).click();
  await checkLayout(page, 'admin-login');
  await page.goto('/');
  await page.locator('.landing-card', { hasText: 'मतदान अधिकारी लॉगिन' }).click();
  await expect(page.getByLabel(/यूज़रनेम/)).toBeVisible(); // plain username + password, no booth dropdowns
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await checkLayout(page, 'officer-login');
  await officerLogin(page);
  await page.getByRole('button', { name: 'लॉग आउट' }).click();
  await expect(page.locator('.landing-cards')).toBeVisible(); // logout returns to the landing page
});

test('officer screens', async ({ page }) => {
  await officerLogin(page);
  await checkLayout(page, 'officer-home');
  for (const phase of ['PRE_POLL', 'POLL_DAY', 'POST_POLL']) {
    await page.goto(`/#/phase/${phase}`);
    await checkLayout(page, `officer-phase-${phase}`);
  }
  await page.goto('/#/phase/POLL_DAY');
  await page.locator('.step-card', { hasText: 'मतदान 11 बजे तक' }).click();
  await page.getByRole('button', { name: /संशोधन करें/ }).click();
  await checkLayout(page, 'officer-turnout-form');
  for (const [path, name] of [['/#/issues', 'issues'], ['/#/issue/new', 'issue-new'], ['/#/history', 'history']] as const) {
    await page.goto(path);
    await checkLayout(page, `officer-${name}`);
  }
});

test('district screens', async ({ page }) => {
  await adminLogin(page, env('ADMIN_USER'), env('ADMIN_PASS'));
  await checkLayout(page, 'dashboard');
  await page.locator('.issue-bar').click();
  await checkLayout(page, 'open-issues');
  await page.locator('.link-card').first().click();
  await checkLayout(page, 'booth-page');
  await page.goto('/');
  await page.locator('.step-row').nth(7).click();
  await checkLayout(page, 'pending-booths');
  await page.goto('/#/admin/officers');
  await checkLayout(page, 'officers');
  await page.getByRole('button', { name: /नया अधिकारी जोड़ें/ }).click();
  await checkLayout(page, 'add-officer-form');
  // Choose a booth so every field (name, mobile, username, password x2) is on screen.
  await page.getByLabel(/पंचायत समिति/).first().selectOption({ index: 1 }); // the panel's picker comes first
  await page.getByLabel(/^वार्ड/).selectOption({ index: 1 });
  await page.getByLabel(/^बूथ/).selectOption({ index: 1 });
  await expect(page.getByLabel(/^पासवर्ड दोबारा/)).toBeVisible();
  await checkLayout(page, 'add-officer-full-form');
  await page.goto('/#/admin/officers');
  await page.getByRole('button', { name: /अधिकारी सूची Excel/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await checkLayout(page, 'credentials-dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /नया पासवर्ड सेट करें/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await checkLayout(page, 'set-password-dialog');
  await page.getByRole('dialog').getByRole('button', { name: 'रद्द करें' }).click();
  await page.goto('/#/admin/steps');
  await page.getByRole('button', { name: 'बदलें' }).first().click();
  await checkLayout(page, 'step-master-edit');
  for (const [path, name] of [
    ['/#/admin/steps', 'step-master'],
    ['/#/admin/settings', 'settings'],
    ['/#/admin/audit', 'audit'],
    ['/#/admin/bulk', 'bulk'],
    ['/#/admin/profile', 'profile'],
  ] as const) {
    await page.goto(path);
    await checkLayout(page, name);
  }
  await page.goto('/#/admin/settings');
  await page.getByRole('switch', { name: 'समय सीमा लागू करें' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await checkLayout(page, 'settings-time-confirm');
  await page.getByRole('dialog').getByRole('button', { name: 'रद्द करें' }).click();
});
