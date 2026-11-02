// INLINE (embedded) mode, 1.0.2 — the BUILT bundle in the plain-html inline demo (examples/plain-html/inline.html) against
// the MOCK assistant (test/e2e/mockServer.mjs). Floating behaviour is covered by widget.spec.ts, which is unchanged.
import { expect, test, type Page } from '@playwright/test';

const ASSIST_PORT = process.env.ASSIST_PORT;
const ASSIST = `http://localhost:${ASSIST_PORT || 4802}`;
if (ASSIST_PORT && ASSIST_PORT !== '4802') {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:4802/**', (r) => r.continue({ url: r.request().url().replace('localhost:4802', `localhost:${ASSIST_PORT}`) }));
  });
}
const mockState = async (page: Page) => (await page.request.get(`${ASSIST}/__state`)).json();
const host = (page: Page) => page.locator('[data-sail-assistant]');
const panel = (page: Page) => page.locator('[data-sail-assistant] .sa-panel');
const input = (page: Page) => page.locator('[data-sail-assistant] textarea');
const botMessages = (page: Page) => page.locator('[data-sail-assistant] .sa-msg.sa-bot:not([aria-label])');
const box = (page: Page) => page.locator('#assistant');
async function ask(page: Page, q: string) {
  await input(page).fill(q);
  await input(page).press('Enter');
}

test.describe('plain-html inline (embedded) mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post(`${ASSIST}/__control`, { data: { reset: true } });
    await page.goto('/plain/inline.html');
    await expect(panel(page)).toBeVisible();
  });

  test('fills the container, is open at once without launcher or close button, answers; host styles stay out', async ({ page }) => {
    await expect(host(page)).toHaveCount(1);
    await expect(host(page)).toHaveAttribute('data-mode', 'inline');
    expect(await host(page).evaluate((h) => h.parentElement?.id)).toBe('assistant');
    await expect(page.locator('[data-sail-assistant] .sa-launcher')).toHaveCount(0);
    await expect(page.locator('[data-sail-assistant] [aria-label="Close assistant"]')).toHaveCount(0);
    await expect(page.locator('[data-sail-assistant] [role="region"]')).toHaveAttribute('aria-labelledby', /.+/);

    // geometry: the panel takes the whole box (which the host sized), and nothing is fixed-positioned
    const b = (await box(page).boundingBox())!;
    const p = (await panel(page).boundingBox())!;
    expect(Math.abs(p.width - b.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(p.height - b.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(p.x - b.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(p.y - b.y)).toBeLessThanOrEqual(2);
    expect(await page.locator('[data-sail-assistant] .sa-root').evaluate((e) => getComputedStyle(e).position)).toBe('static');
    expect(await panel(page).evaluate((e) => getComputedStyle(e).position)).toBe('static');
    await expect(input(page)).not.toBeFocused(); // never steals the host page's focus

    // starter questions were requested at once (panel open from the start)
    const chips = page.locator('[data-sail-assistant] .sa-chip');
    await expect(chips.first()).toHaveText('How do I create a new crew record?');
    expect((await mockState(page)).suggestionCalls.map((c: { module: string }) => c.module)).toEqual(['crewing']);

    // the host's hostile styles stay out (checked while the chips are still shown — they go once a conversation starts)
    const widgetFont = await page.locator('[data-sail-assistant] .sa-root').evaluate((e) => getComputedStyle(e).fontFamily);
    expect(widgetFont).toContain('system-ui');
    expect(await chips.first().evaluate((el) => getComputedStyle(el).letterSpacing)).toBe('normal');

    // a real answer with sources, then a follow-up with history
    await chips.first().click();
    await expect(botMessages(page).first()).toContainText('MOCK answer to "How do I create a new crew record?"');
    await expect(botMessages(page).first().locator('.sa-cite li')).toHaveCount(1);
    await ask(page, 'and then?');
    await expect(botMessages(page).nth(1)).toContainText('history had 2 messages');
  });

  test('open()/close() and Escape never hide it; context change clears history; sign-out empties the box; sign-in re-opens', async ({ page }) => {
    await page.evaluate(() => (window as unknown as { __widget: { close(): void } }).__widget.close());
    await expect(panel(page)).toBeVisible();
    await input(page).focus();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeVisible();

    await ask(page, 'hello');
    await expect(botMessages(page).first()).toContainText('MOCK answer to "hello"');
    await page.locator('#module').selectOption('audit');
    await expect(botMessages(page)).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
    await expect(page.locator('[data-sail-assistant] .sa-chip').first()).toHaveText('How do I create a new preparation?');

    const mintsBefore = (await mockState(page)).tokenMints.length;
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(host(page)).toHaveCount(1); // still mounted in the box, rendering nothing
    expect(await box(page).evaluate((b) => b.getBoundingClientRect().width)).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    expect((await mockState(page)).tokenMints.length).toBe(mintsBefore);

    await page.getByRole('button', { name: /user B/ }).click();
    await expect(panel(page)).toBeVisible();
    await expect(botMessages(page)).toHaveCount(0);
    await ask(page, 'after login');
    await expect(botMessages(page).first()).toContainText('after login');
    const calls = (await mockState(page)).chatCalls;
    expect(calls.at(-1).user).toBe('202');
    expect(calls.at(-1).context.module).toBe('audit');
    expect(calls.at(-1).historyLength).toBe(0);
  });

  test('unmount empties the container; mount again works; inline without a container is refused', async ({ page }) => {
    await page.getByRole('button', { name: 'Unmount widget' }).click();
    await expect(host(page)).toHaveCount(0);
    expect(await box(page).evaluate((b) => b.childElementCount)).toBe(0);
    await page.getByRole('button', { name: 'Mount widget', exact: true }).click();
    await expect(panel(page)).toBeVisible();
    await expect(host(page)).toHaveCount(1);

    const errs = await page.evaluate(() => {
      const w = (window as unknown as { SailAssistant: { init(c: unknown): unknown } }).SailAssistant;
      const out: string[] = [];
      for (const c of [
        { assistantUrl: 'http://localhost:4802', module: 'crewing', getToken: async () => 'x.y', mode: 'inline' },
        { assistantUrl: 'http://localhost:4802', module: 'crewing', getToken: async () => 'x.y', mode: 'popup', container: document.body },
      ]) { try { w.init(c); out.push('accepted'); } catch (e) { out.push((e as Error).message); } }
      return out;
    });
    expect(errs[0]).toContain('container');
    expect(errs[1]).toContain('mode');
    await expect(host(page)).toHaveCount(1); // the refused inits touched nothing
    await expect(panel(page)).toBeVisible();
  });
});
