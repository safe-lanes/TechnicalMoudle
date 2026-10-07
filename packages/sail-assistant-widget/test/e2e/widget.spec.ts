// MOCK identity + MOCK assistant (test/e2e/mockServer.mjs). These prove the widget's behaviour in each host stack; they do
// NOT prove any module's real login or the real assistant (see live.spec.ts for the pilot run).
import { expect, test, type Page } from '@playwright/test';

const ASSIST = 'http://localhost:4802';
const HOSTS = [
  { name: 'plain-html', url: '/plain/', module: 'crewing', firstSuggestion: 'How do I create a new crew record?' },
  { name: 'crewing-react', url: '/crewing/crew-list', module: 'crewing', firstSuggestion: 'How do I create a new crew record?' },
  { name: 'audit-angular', url: '/audit-app/audit', module: 'audit', firstSuggestion: 'How do I create a new preparation?' },
] as const;

async function control(page: Page, body: Record<string, unknown>) {
  const r = await page.request.post(`${ASSIST}/__control`, { data: body });
  return r.json();
}
const mockState = async (page: Page) => (await page.request.get(`${ASSIST}/__state`)).json();
const launcher = (page: Page) => page.locator('[data-sail-assistant] .sa-launcher');
const panel = (page: Page) => page.locator('[data-sail-assistant] .sa-panel');
const input = (page: Page) => page.locator('[data-sail-assistant] textarea');
const botMessages = (page: Page) => page.locator('[data-sail-assistant] .sa-msg.sa-bot:not([aria-label])');

async function ask(page: Page, q: string) {
  await input(page).fill(q);
  await input(page).press('Enter');
}

/** Count window/document listeners that stay registered (installed before any page script). */
async function trackListeners(page: Page) {
  await page.addInitScript(() => {
    const live = new Map<EventTarget, number>();
    const add = EventTarget.prototype.addEventListener;
    const rem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (this: EventTarget, ...a: Parameters<EventTarget['addEventListener']>) {
      if (this === window || this === document) live.set(this, (live.get(this) ?? 0) + 1);
      return add.apply(this, a);
    };
    EventTarget.prototype.removeEventListener = function (this: EventTarget, ...a: Parameters<EventTarget['removeEventListener']>) {
      if (this === window || this === document) live.set(this, (live.get(this) ?? 0) - 1);
      return rem.apply(this, a);
    };
    (window as unknown as { __listeners: () => number }).__listeners = () => (live.get(window) ?? 0) + (live.get(document) ?? 0);
  });
}

for (const h of HOSTS) {
  test.describe(h.name, () => {
    test.beforeEach(async ({ page }) => {
      await control(page, { reset: true });
      await page.goto(h.url);
      await expect(launcher(page)).toBeVisible();
    });

    test('one widget, module-specific suggestions, answers with citations, follow-up, table', async ({ page }) => {
      await expect(page.locator('[data-sail-assistant]')).toHaveCount(1);
      await launcher(page).click();
      await expect(panel(page)).toBeVisible();
      const chips = page.locator('[data-sail-assistant] .sa-chip');
      await expect(chips.first()).toHaveText(h.firstSuggestion);
      const st = await mockState(page);
      expect(st.suggestionCalls.map((c: { module: string }) => c.module)).toEqual([h.module]);

      await chips.first().click();
      await expect(botMessages(page).first()).toContainText(`MOCK answer to "${h.firstSuggestion}"`);
      await expect(botMessages(page).first()).toContainText(`module ${h.module}`);
      await expect(botMessages(page).first().locator('.sa-cite li')).toHaveCount(1); // duplicate citations collapsed

      await ask(page, 'and then?');
      await expect(botMessages(page).nth(1)).toContainText(`earlier question "${h.firstSuggestion}"`);
      await expect(botMessages(page).nth(1)).toContainText('history had 2 messages');

      await ask(page, 'show it as a table');
      await expect(botMessages(page).nth(2).locator('table tr')).toHaveCount(4);
      const calls = (await mockState(page)).chatCalls;
      expect(calls.every((c: { context: { module: string } }) => c.context.module === h.module)).toBe(true);
      expect(new Set(calls.map((c: { conversationId: string }) => c.conversationId)).size).toBe(1);
    });

    test('host styles stay out, widget styles stay in', async ({ page }) => {
      const hostBodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      const hostButton = page.locator('body > * button, main button, p button').first();
      const before = await hostButton.evaluate((b) => { const s = getComputedStyle(b); return [s.backgroundColor, s.fontFamily, s.textTransform, s.letterSpacing].join('|'); });
      await launcher(page).click();
      const widgetFont = await page.locator('[data-sail-assistant] .sa-root').evaluate((e) => getComputedStyle(e).fontFamily);
      expect(widgetFont).toContain('system-ui');
      expect(widgetFont).not.toBe(hostBodyFont);
      const chip = page.locator('[data-sail-assistant] .sa-chip').first();
      const chipStyle = await chip.evaluate((b) => { const s = getComputedStyle(b); return { tt: s.textTransform, ls: s.letterSpacing, bg: s.backgroundColor }; });
      expect(chipStyle.tt).toBe('none');          // Crewing-like host uppercases every button with !important
      expect(chipStyle.ls).toBe('normal');        // plain host sets letter-spacing on * with !important
      const after = await hostButton.evaluate((b) => { const s = getComputedStyle(b); return [s.backgroundColor, s.fontFamily, s.textTransform, s.letterSpacing].join('|'); });
      expect(after).toBe(before);
    });

    test('keyboard: open with Enter, focus in the question box, Escape closes and returns focus', async ({ page }) => {
      await launcher(page).focus();
      await page.keyboard.press('Enter');
      await expect(panel(page)).toBeVisible();
      await expect(input(page)).toBeFocused();
      await expect(launcher(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-sail-assistant] [role="dialog"]')).toHaveAttribute('aria-labelledby', /.+/);
      await page.keyboard.press('Escape');
      await expect(panel(page)).toBeHidden();
      await expect(launcher(page)).toBeFocused();
      await expect(launcher(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('narrow screen: panel fills the viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 700 });
      const hostScrollW = await page.evaluate(() => document.documentElement.scrollWidth); // the host's own layout
      await launcher(page).click();
      const box = await panel(page).boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.width)).toBe(375);
      expect(Math.round(box!.height)).toBe(700);
      await expect(page.locator('[data-sail-assistant] .sa-icon-btn[aria-label="Close assistant"]')).toBeVisible();
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollW).toBe(hostScrollW); // the widget adds no horizontal overflow
    });

    test('expired token: one refresh + one retry succeeds; two rejections stop with "sign in again"', async ({ page }) => {
      await launcher(page).click();
      await control(page, { rejectNextTokens: 1 });
      await ask(page, 'first question');
      await expect(botMessages(page).first()).toContainText('MOCK answer to "first question"');
      let st = await mockState(page);
      expect(st.chatCalls.filter((c: { message: string }) => c.message === 'first question')).toHaveLength(2);

      await control(page, { rejectNextTokens: 2 });
      await ask(page, 'second question');
      await expect(botMessages(page).nth(1)).toContainText('could not be verified');
      st = await mockState(page);
      expect(st.chatCalls.filter((c: { message: string }) => c.message === 'second question')).toHaveLength(2); // bounded
    });

    test('assistant unavailable → error with Try again; retry answers', async ({ page }) => {
      await launcher(page).click();
      await control(page, { failNext: 1 });
      await ask(page, 'will fail once');
      await expect(botMessages(page).first()).toContainText('temporarily unavailable');
      await page.locator('[data-sail-assistant] .sa-link', { hasText: 'Try again' }).click();
      await expect(botMessages(page).first()).toContainText('MOCK answer to "will fail once"');
      await expect(botMessages(page)).toHaveCount(1);
    });
  });
}

test.describe('context changes and logout', () => {
  test.beforeEach(async ({ page }) => { await control(page, { reset: true }); });

  test('crewing-react: no vessel on Crew list; vessel on Rest hours starts a new conversation', async ({ page }) => {
    await page.goto('/crewing/crew-list');
    await launcher(page).click();
    await ask(page, 'hello');
    await expect(botMessages(page).first()).toContainText('no vessel');
    await page.getByRole('link', { name: 'Rest hours' }).click();
    await page.getByTestId('vessel').selectOption('v-202');
    await expect(botMessages(page)).toHaveCount(0); // vessel change cleared the history
    await expect(page.locator('[data-sail-assistant] .sa-sub')).toContainText('MV Bravo');
    await ask(page, 'hello again');
    await expect(botMessages(page).first()).toContainText('vessel MV Bravo');
    const calls = (await mockState(page)).chatCalls;
    expect(calls[0].context).toEqual({ module: 'crewing', currentPage: '/crew-list' });
    expect(calls[1].context).toMatchObject({ module: 'crewing', vesselId: 'v-202', vesselName: 'MV Bravo' });
    expect(calls[1].historyLength).toBe(0);
    expect(calls[0].conversationId).not.toBe(calls[1].conversationId);
  });

  test('audit-angular: section change switches module and refreshes suggestions; none published → hidden', async ({ page }) => {
    await page.goto('/audit-app/audit');
    await launcher(page).click();
    const chips = page.locator('[data-sail-assistant] .sa-chip');
    await expect(chips.first()).toHaveText('How do I create a new preparation?');
    await page.getByTestId('nav-safety').click();
    await expect(chips.first()).toHaveText('How do I create a new MOC?');
    await expect(chips).not.toContainText(['How do I create a new preparation?']);
    await page.getByTestId('nav-incident').click();
    await expect(page.locator('[data-sail-assistant] .sa-empty')).toBeVisible();
    await expect(page.locator('[data-sail-assistant] .sa-sugg')).toHaveCount(0); // hidden, not generic
    const st = await mockState(page);
    expect(st.suggestionCalls.map((c: { module: string }) => c.module)).toEqual(['audit', 'safety', 'incident']);
    await ask(page, 'how?');
    await expect(botMessages(page).first()).toContainText('module incident');
  });

  test('audit-angular: modules without vessel work; vessel filter is optional', async ({ page }) => {
    await page.goto('/audit-app/audit');
    await launcher(page).click();
    await ask(page, 'q1');
    await expect(botMessages(page).first()).toContainText('no vessel');
    await page.getByTestId('vessel').selectOption('v-12');
    await ask(page, 'q2');
    await expect(botMessages(page).first()).toContainText('vessel MT Delta');
  });

  for (const h of [{ url: '/crewing/crew-list', logout: 'Logout' }, { url: '/audit-app/audit', logout: 'Logout' }, { url: '/plain/', logout: 'Sign out' }]) {
    test(`logout hides the widget, clears history and never mints again (${h.url})`, async ({ page }) => {
      await page.goto(h.url);
      await launcher(page).click();
      await ask(page, 'before logout');
      await expect(botMessages(page).first()).toContainText('before logout');
      const mintsBefore = (await mockState(page)).tokenMints.length;
      await page.getByRole('button', { name: h.logout }).click();
      await expect(launcher(page)).toHaveCount(0);
      await expect(panel(page)).toHaveCount(0);
      await page.waitForTimeout(500);
      expect((await mockState(page)).tokenMints.length).toBe(mintsBefore);
      // sign back in as another user → empty conversation
      await page.getByRole('button', { name: /User B|user B/ }).click();
      await launcher(page).click();
      await expect(botMessages(page)).toHaveCount(0);
      await ask(page, 'after login');
      await expect(botMessages(page).first()).toContainText('after login');
      const calls = (await mockState(page)).chatCalls;
      expect(calls.at(-1).user).toBe(h.url.startsWith('/audit') ? '402' : '202');
      expect(calls.at(-1).historyLength).toBe(0);
    });
  }

  test('user switch during a slow answer: request cancelled, late answer never shown', async ({ page }) => {
    await page.goto('/crewing/crew-list');
    await launcher(page).click();
    await ask(page, 'slow question');
    await expect(page.locator('[data-sail-assistant] .sa-typing')).toBeVisible();
    await page.getByRole('button', { name: 'User B' }).click();
    await expect(page.locator('[data-sail-assistant] .sa-typing')).toHaveCount(0);
    await page.waitForTimeout(3200); // the mock answers "slow" after 2.5 s
    await expect(page.locator('[data-sail-assistant] .sa-msg')).toHaveCount(0);
  });
});

test.describe('mount / unmount', () => {
  test('plain-html: repeated mount/unmount and double init leave one widget and no leftover listeners', async ({ page }) => {
    await trackListeners(page);
    await control(page, { reset: true });
    await page.goto('/plain/');
    await expect(launcher(page)).toBeVisible();
    await page.getByRole('button', { name: 'Unmount widget' }).click();
    await expect(page.locator('[data-sail-assistant]')).toHaveCount(0);
    const baseline = await page.evaluate(() => (window as unknown as { __listeners: () => number }).__listeners());
    // instrument self-check: a deliberately leaked listener IS counted
    const leaked = await page.evaluate(() => { window.addEventListener('resize', () => {}); return (window as unknown as { __listeners: () => number }).__listeners(); });
    expect(leaked).toBe(baseline + 1);
    const base2 = leaked;
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Mount widget', exact: true }).click();
      await launcher(page).click();
      await page.getByRole('button', { name: 'Unmount widget' }).click();
    }
    await expect(page.locator('[data-sail-assistant]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __listeners: () => number }).__listeners())).toBe(base2);

    // a second init() without destroy replaces the first (React StrictMode / re-created Angular component)
    await page.evaluate(() => {
      const cfg = { assistantUrl: 'http://localhost:4802', module: 'crewing', getToken: async () => 'x.y', context: { userKey: 'u', tenantKey: 't' } };
      const w = (window as unknown as { SailAssistant: { init(c: unknown): { destroy(): void } } }).SailAssistant;
      w.init(cfg);
      w.init(cfg);
    });
    await expect(page.locator('[data-sail-assistant]')).toHaveCount(1);
    const v = await page.evaluate(() => (window as unknown as { SailAssistant: { VERSION: string } }).SailAssistant.VERSION);
    expect(v).toBe('1.0.0');
  });

  test('invalid config is refused (no http assistant, module id required, token provider required)', async ({ page }) => {
    await page.goto('/plain/');
    const errs = await page.evaluate(() => {
      const w = (window as unknown as { SailAssistant: { init(c: unknown): unknown } }).SailAssistant;
      const out: string[] = [];
      for (const c of [
        { assistantUrl: 'http://evil.example', module: 'crewing', getToken: async () => 'x.y' },
        { assistantUrl: 'https://assistant.sl-sail.com', module: '', getToken: async () => 'x.y' },
        { assistantUrl: 'https://assistant.sl-sail.com', module: 'crewing' },
      ]) { try { w.init(c); out.push('accepted'); } catch (e) { out.push((e as Error).message); } }
      return out;
    });
    expect(errs[0]).toContain('https');
    expect(errs[1]).toContain('module');
    expect(errs[2]).toContain('getToken');
  });
});
