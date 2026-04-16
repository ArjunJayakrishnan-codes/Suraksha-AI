import fs from 'fs';
import { chromium } from 'playwright';

(async () => {
  const logs = { console: [], network: [], responses: [], error: null };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', (msg) => {
    try {
      logs.console.push({ type: msg.type(), text: msg.text() });
    } catch (e) {
      logs.console.push({ type: 'error', text: String(e) });
    }
  });

  page.on('request', (req) => {
    logs.network.push({ type: 'request', url: req.url(), method: req.method() });
  });

  page.on('response', (res) => {
    logs.responses.push({ url: res.url(), status: res.status(), statusText: res.statusText() });
  });

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle', timeout: 30000 });
    // Give some time for dynamic imports to fail and console to populate
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'playwright_frontend_screenshot.png', fullPage: true });
  } catch (err) {
    logs.error = String(err);
  }

  await browser.close();

  fs.writeFileSync('playwright_logs.json', JSON.stringify(logs, null, 2));
  console.log('WROTE playwright_logs.json');
})();
