/**
 * Standalone-boot runner (design v3 §A5 proof): the engine as its own process with the demo
 * card, against a pilot DB. Run:
 *   AE_DATABASE_URL="postgres://postgres:admin123@localhost:5432/pms_arch" npx tsx server/approval-demo/standaloneDemo.ts
 * Serves: GET /health · /approval-engine/registry · /approval-engine/workflows … (full API).
 */
import { startStandalone } from '../modules/approval-engine';
import { makeDemoCard } from './demoCard';

(async () => {
  const { card } = makeDemoCard();
  const handle = await startStandalone({
    cards: [card],
    onEvent: (evt) => console.log('[demo onEvent]', JSON.stringify(evt)),
  });
  console.log(`[demo] approval-engine standalone up on :${handle.port} (Ctrl+C to stop)`);
})().catch((e) => { console.error('standalone demo failed:', e); process.exit(1); });
