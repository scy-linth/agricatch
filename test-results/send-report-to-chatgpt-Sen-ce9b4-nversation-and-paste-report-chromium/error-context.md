# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: send-report-to-chatgpt.spec.js >> Send Report to ChatGPT >> Open ChatGPT conversation and paste report
- Location: tests\send-report-to-chatgpt.spec.js:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('textarea[placeholder*="Message"], textarea[placeholder*="message"], div[contenteditable="true"], textarea').first()
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 120000ms
  - waiting for locator('textarea[placeholder*="Message"], textarea[placeholder*="message"], div[contenteditable="true"], textarea').first()
    6 × locator resolved to <textarea inputmode="text" autocorrect="on" spellcheck="true" autocomplete="off" name="prompt-textarea" autocapitalize="sentences" placeholder="Ask anything" data-virtualkeyboard="true" aria-label="Chat with ChatGPT" class="wcDTda_fallbackTextarea"></textarea>
      - unexpected value "hidden"
    - waiting for" https://auth.openai.com/api/accounts/authorize?client_id=app_X8zY6vW2pQ9tR3dE7nK1jL5gH&scope=openid%20email%20profile%20offline_access%20model.request%20model.read%20organization.read%20organization.…" navigation to finish...
    - navigated to "https://accounts.google.com/v3/signin/identifier?opparams=%253Faudience%253D799222349882-ne3i0s9jdm5s0p7ll2d7tlsi1vc1halt.apps.googleusercontent.com&dsh=S1042330204%3A1783557616669584&client_id=79922…"
    - waiting for" https://accounts.google.com/signin/oauth?app_domain=https://auth.openai.com&client_id=799222349882-ne3i0s9jdm5s0p7ll2d7tlsi1vc1halt.apps.googleusercontent.com&continue=https://accounts.google.com/sig…" navigation to finish...
    - navigated to "https://accounts.google.com/v3/signin/identifier?opparams=%253Faudience%253D799222349882-ne3i0s9jdm5s0p7ll2d7tlsi1vc1halt.apps.googleusercontent.com&dsh=S-285098966%3A1783557629432843&app_domain=http…"

```

```yaml
- main:
  - text: Sign in with Google
  - img "OpenAI"
  - heading "Sign in" [level=1]
  - text: to continue to
  - button "OpenAI"
  - textbox "Email or phone"
  - button "Forgot email?"
  - text: Before using this app, you can review OpenAI’s
  - link "Privacy Policy":
    - /url: https://openai.com/policies/privacy-policy
  - text: and
  - link "Terms of Service":
    - /url: https://openai.com/policies/terms-of-use
  - text: .
  - button "Next"
  - button "Create account"
- contentinfo:
  - combobox "Change language English (United States)"
  - list:
    - listitem:
      - link "Open Google Account Help Center (external, opens in a new window)":
        - /url: https://support.google.com/accounts?hl=en-US&p=account_iph
        - text: Help
    - listitem:
      - link "Privacy Policy (external, opens in a new window)":
        - /url: https://accounts.google.com/TOS?loc=PH&hl=en-US&privacy=true
        - text: Privacy
    - listitem:
      - link "Google Terms of Service (external, opens in a new window)":
        - /url: https://accounts.google.com/TOS?loc=PH&hl=en-US
        - text: Terms
- iframe
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | const fs = require('fs');
  3  | const path = require('path');
  4  | 
  5  | test.describe('Send Report to ChatGPT', () => {
  6  |   test('Open ChatGPT conversation and paste report', async ({ page }) => {
  7  |     // Read the report content
  8  |     const reportPath = path.join(__dirname, '..', 'test-downloads', 'FINAL_VISUAL_QA_REPORT.md');
  9  |     const reportContent = fs.readFileSync(reportPath, 'utf-8');
  10 |     
  11 |     console.log('Report content loaded, length:', reportContent.length);
  12 |     
  13 |     // Navigate to ChatGPT conversation
  14 |     await page.goto('https://chatgpt.com/c/6a4ea569-1a7c-83ec-8082-041a401f1f52');
  15 |     await page.waitForLoadState('domcontentloaded');
  16 |     
  17 |     console.log('Page loaded, current URL:', page.url());
  18 |     
  19 |     // Check if user is logged in by looking for login button or message input
  20 |     const loginButton = page.locator('button:has-text("Log in"), button:has-text("Sign up"), a:has-text("Log in")').first();
  21 |     const messageInput = page.locator('textarea[placeholder*="Message"], textarea[placeholder*="message"], div[contenteditable="true"], textarea').first();
  22 |     
  23 |     // Wait a bit for page to settle
  24 |     await page.waitForTimeout(3000);
  25 |     
  26 |     // Check if login button is visible (user not logged in)
  27 |     const isLoginVisible = await loginButton.isVisible({ timeout: 2000 }).catch(() => false);
  28 |     
  29 |     if (isLoginVisible) {
  30 |       console.log('User is not logged in. Please login manually in the browser window.');
  31 |       console.log('Waiting for user to login...');
  32 |       
  33 |       // Wait for message input to appear (indicates user is logged in)
> 34 |       await expect(messageInput).toBeVisible({ timeout: 120000 }); // Wait up to 2 minutes for manual login
     |                                  ^ Error: expect(locator).toBeVisible() failed
  35 |       console.log('User logged in successfully!');
  36 |     } else {
  37 |       console.log('User appears to be logged in already.');
  38 |     }
  39 |     
  40 |     // Take screenshot to see current state
  41 |     await page.screenshot({ path: 'test-results/chatgpt-page-loaded.png' });
  42 |     
  43 |     // Wait for input to be visible
  44 |     await expect(messageInput).toBeVisible({ timeout: 10000 });
  45 |     console.log('Message input found');
  46 |     
  47 |     // Click on the input
  48 |     await messageInput.click();
  49 |     await page.waitForTimeout(1000);
  50 |     
  51 |     // Paste the report content
  52 |     await messageInput.fill(reportContent);
  53 |     console.log('Report content pasted');
  54 |     
  55 |     // Take screenshot after pasting
  56 |     await page.screenshot({ path: 'test-results/chatgpt-report-pasted.png' });
  57 |     
  58 |     // Press Enter to submit
  59 |     await page.keyboard.press('Enter');
  60 |     console.log('Enter pressed to submit');
  61 |     
  62 |     // Wait for message to be sent
  63 |     await page.waitForTimeout(3000);
  64 |     
  65 |     // Take final screenshot
  66 |     await page.screenshot({ path: 'test-results/chatgpt-message-sent.png' });
  67 |     
  68 |     console.log('✓ Report successfully sent to ChatGPT');
  69 |   });
  70 | });
  71 | 
```