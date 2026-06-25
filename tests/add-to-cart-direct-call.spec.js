const { test, expect } = require('@playwright/test');

/**
 * Direct Function Call Test
 * Calls addToCart directly from browser console
 */

const BASE_URL = 'http://localhost:3000';

test('Add to Cart - Direct Function Call', async ({ page }) => {
  console.log('\n=== DIRECT FUNCTION CALL TEST ===\n');
  
  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({
      type: msg.type(),
      text: text
    });
    console.log(`[${msg.type().toUpperCase()}] ${text}`);
  });
  
  // Navigate to page
  await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle' });
  
  // Call addToCart directly from page context
  console.log('\n=== CALLING app.addToCart(1) DIRECTLY ===\n');
  const callResult = await page.evaluate(async () => {
    try {
      await window.app.addToCart(1);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message, stack: error.stack };
    }
  });
  
  console.log(`Call result: ${JSON.stringify(callResult)}`);
  
  // Wait for logs
  await page.waitForTimeout(3000);
  
  // Filter debug logs
  console.log('\n=== DEBUG LOG SEQUENCE ===\n');
  const debugLogs = consoleMessages.filter(m => m.text.includes('[DEBUG addToCart]'));
  
  if (debugLogs.length === 0) {
    console.log('NO DEBUG LOGS FOUND');
  } else {
    debugLogs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.text}`);
    });
  }
  
  // Check for error logs
  console.log('\n=== ERROR LOGS ===\n');
  const errorLogs = consoleMessages.filter(m => m.type === 'error');
  errorLogs.forEach(log => {
    console.log(`- ${log.text}`);
  });
  
  console.log('\n=== ANALYSIS ===\n');
  console.log(`Total debug logs: ${debugLogs.length}`);
  if (debugLogs.length > 0) {
    console.log(`Last debug log: ${debugLogs[debugLogs.length - 1].text}`);
  }
});
