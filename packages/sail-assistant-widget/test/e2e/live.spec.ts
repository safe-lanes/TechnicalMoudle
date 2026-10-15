// LIVE PILOT run (15-Oct-2026): the BUILT widget in all three example hosts against a REAL central assistant PILOT.
// Runs only when WIDGET_LIVE_ASSISTANT is set (e.g. http://127.0.0.1:18061 — SSH tunnel to the widget test container),
// and the mock host must be started with LIVE_SIGNING_KEY_FILE so its token endpoints sign tokens the pilot accepts.
// What this proves: real CORS, real /suggestions, real /chat answers with citations, follow-up, and the bounded token
// refresh against the real assistant. What it does NOT prove: any module's real login (the identity is still MOCK).
import { expect, test, type Page } from '@playwright/test';

const LIVE = process.env.WIDGET_LIVE_ASSISTANT;
test.skip(!LIVE, 'WIDGET_LIVE_ASSISTANT not set — live pilot run skipped');
test.setTimeout(180_000);

const HOSTS = [
  { name: 'plain-html', url: '/plain/', module: 'crewing', firstSuggestion: 'How do I create a new crew record?' },
  { name: 'crewing-react', url: '/crewing/crew-list', module: 'crewing', firstSuggestion: 'How do I create a new crew record?' },
  { name: 'audit-angular', url: '/audit-app/audit', module: 'audit', firstSuggestion: 'How do I create a new preparation?' },
] as const;

const launcher = (page: Page) => page.locator('[data-sail-assistant] .sa-launcher');
const panel = (page: Page) => page.locator('[data-sail-assistant] .sa-panel');
const input = (page: Page) => page.locator('[data-sail-assistant] textarea');
const botMessages = (page: Page) => page.locator('[data-sail-assistant] .sa-msg.sa-bot:not([aria-label])');
const hostControl = async (page: Page, body: Record<string, unknown>) =>
  (await page.request.post('/__host-control', { data: body })).json();

async function ask(page: Page, q: string) {
  await input(page).fill(q);
  await input(page).press('Enter');
}

test.beforeAll(async ({ request }) => {
  const st = await (await request.post('/__host-control', { data: {} })).json();
  expect(st.live, 'mock host must run in LIVE PILOT MODE (LIVE_SIGNING_KEY_FILE)').toBe(true);
});

for (const h of HOSTS) {
  test(`${h.name}: real suggestions, real answer with citation, follow-up`, async ({ page }) => {
    await page.goto(`${h.url}?assistant=${encodeURIComponent(LIVE!)}`);
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    const chips = page.locator('[data-sail-assistant] .sa-chip');
    await expect(chips.first()).toHaveText(h.firstSuggestion, { timeout: 30_000 });

    await chips.first().click();
    const first = botMessages(page).first();
    await expect(first.locator('.sa-cite').first()).toBeVisible({ timeout: 120_000 });
    await expect(first.locator('.sa-err')).toHaveCount(0);
    expect((await first.locator('.sa-cite-manual').first().innerText()).toLowerCase()).toContain(h.module);

    await ask(page, 'And what happens after I save it?');
    await expect(botMessages(page)).toHaveCount(2, { timeout: 120_000 });
    await expect(botMessages(page).nth(1).locator('.sa-err')).toHaveCount(0);
  });
}

test('rejected token: exactly one forced refresh, then the real suggestions and answer (no error shown)', async ({ page }) => {
  await page.goto('/plain/'); // host only — no assistant call yet
  const before = (await hostControl(page, {})).mints;
  await hostControl(page, { badNextMints: 1 }); // the FIRST token the widget gets is wrongly signed → real 401
  await page.goto(`/plain/?assistant=${encodeURIComponent(LIVE!)}`);
  await launcher(page).click();
  await expect(page.locator('[data-sail-assistant] .sa-chip').first()).toBeVisible({ timeout: 30_000 });
  const after = await hostControl(page, {});
  expect(after.badNextMints).toBe(0);           // the bad token was used
  expect(after.mints - before).toBe(2);         // bad one + exactly one forced refresh
  await ask(page, 'How do I approve or reject a rotation plan?');
  const msg = botMessages(page).first();
  await expect(msg.locator('.sa-cite').first()).toBeVisible({ timeout: 120_000 });
  await expect(msg.locator('.sa-err')).toHaveCount(0);
});
