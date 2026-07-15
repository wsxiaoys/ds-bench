import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

const port = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: '/home/user/myproject',
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
try {
  await new Promise((resolve) => {
    server.stdout.on('data', (d) => {
      const s = d.toString();
      process.stdout.write('[server] ' + s);
      if (s.includes('Local:')) resolve();
    });
    server.stderr.on('data', (d) => process.stderr.write('[server-err] ' + d));
  });
  await new Promise((r) => setTimeout(r, 800));

  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });

  // Give the dynamic import for addListener a moment to resolve
  await new Promise((r) => setTimeout(r, 300));

  // Verify window globals exist
  const hasGlobals = await page.evaluate(() => {
    return typeof window.MetricsAnalyzer === 'object' &&
      Array.isArray(window.__analysisEvents);
  });
  console.log('1. Globals present:', hasGlobals);

  // Test analyze with empty array
  const emptyResult = await page.evaluate(async () => {
    return await window.MetricsAnalyzer.analyze({ values: [] });
  });
  console.log('2. Empty analyze:', JSON.stringify(emptyResult));
  const emptyOk = JSON.stringify(emptyResult) === JSON.stringify({count:0,sum:0,mean:0,min:0,max:0,stdDev:0});
  console.log('   Empty correct:', emptyOk);

  // Test analyze with known values
  const result = await page.evaluate(async () => {
    return await window.MetricsAnalyzer.analyze({ values: [2,4,4,4,5,5,7,9] });
  });
  console.log('3. Known analyze:', JSON.stringify(result));
  const resultOk = result.count===8 && result.sum===40 && result.mean===5 && result.min===2 && result.max===9 && result.stdDev===2;
  console.log('   Known correct:', resultOk);

  // Test getRunningTotal (should be 2: empty + known)
  const total = await page.evaluate(async () => {
    return await window.MetricsAnalyzer.getRunningTotal();
  });
  console.log('4. Running total:', JSON.stringify(total));
  const totalOk = total.total === 2;
  console.log('   Total correct:', totalOk);

  // Test events array
  const events = await page.evaluate(() => window.__analysisEvents);
  console.log('5. Events:', JSON.stringify(events));
  const eventsOk = events.length === 2 &&
    events[0].sequence === 1 && events[0].mean === 0 &&
    events[1].sequence === 2 && events[1].mean === 5;
  console.log('   Events correct:', eventsOk);

  // Test another analyze to check sequence increments
  await page.evaluate(async () => {
    await window.MetricsAnalyzer.analyze({ values: [10, 20, 30] });
  });
  const events2 = await page.evaluate(() => window.__analysisEvents);
  const total2 = await page.evaluate(async () => await window.MetricsAnalyzer.getRunningTotal());
  console.log('6. After 3rd analyze - events:', events2.length, 'total:', total2.total);
  const thirdOk = events2.length === 3 && events2[2].sequence === 3 && total2.total === 3;
  console.log('   Third correct:', thirdOk);

  // Test DOM rendering
  const domResult = await page.evaluate(() => document.getElementById('result')?.textContent);
  const domEventCount = await page.evaluate(() => document.getElementById('event-count')?.textContent);
  console.log('7. DOM result:', domResult);
  console.log('   DOM event-count:', domEventCount);
  const domOk = domEventCount === '3' && domResult && JSON.parse(domResult).count === 3;
  console.log('   DOM correct:', domOk);

  // Verify event payload keys are exactly sequence and mean
  const eventKeysOk = events2.every(e => {
    const keys = Object.keys(e).sort();
    return keys.length === 2 && keys[0] === 'mean' && keys[1] === 'sequence';
  });
  console.log('8. Event payload keys correct:', eventKeysOk);

  // Verify result keys are exactly count, sum, mean, min, max, stdDev
  const resultKeysOk = (() => {
    const keys = Object.keys(result).sort();
    return keys.length === 6 && keys.join(',') === 'count,max,mean,min,stdDev,sum';
  })();
  console.log('9. Result keys correct:', resultKeysOk);

  console.log('\nPage errors:', errors.length ? errors : 'none');

  const allOk = hasGlobals && emptyOk && resultOk && totalOk && eventsOk && thirdOk && domOk && eventKeysOk && resultKeysOk && errors.length === 0;
  console.log('\n=== ALL TESTS PASSED:', allOk, '===');
  if (!allOk) process.exitCode = 1;
} catch (e) {
  console.error('Test failed:', e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}