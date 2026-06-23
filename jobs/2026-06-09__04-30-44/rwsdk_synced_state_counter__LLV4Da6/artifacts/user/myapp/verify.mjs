import { chromium } from 'playwright-core';

async function verify() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/counter');
  await page.waitForSelector('[data-testid="reset-btn"]');
  
  await page.click('[data-testid="reset-btn"]');
  await page.waitForTimeout(500); // Wait for sync
  
  await page.click('[data-testid="inc-btn"]');
  await page.click('[data-testid="inc-btn"]');
  await page.click('[data-testid="inc-btn"]');
  await page.waitForTimeout(1000); // Wait for sync
  
  const countText = await page.textContent('[data-testid="counter-value"]');
  console.log('After 3 increments:', countText);
  
  await page.click('[data-testid="reset-btn"]');
  await page.waitForTimeout(500); // Wait for sync
  
  const resetText = await page.textContent('[data-testid="counter-value"]');
  console.log('After reset:', resetText);
  
  await browser.close();
}

verify().catch(console.error);
