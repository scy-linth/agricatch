const { test, expect } = require('@playwright/test');

test.describe('Chat UI Consistency - farmer.html vs chat.html', () => {
  test('should have identical chat section structure', async ({ page }) => {
    // Navigate to farmer.html and switch to chat section
    await page.goto('http://localhost:3000/farmer.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Switch to chat section (if needed)
    const chatSection = page.locator('#chat');
    await expect(chatSection).toBeVisible();
    
    // Get farmer.html chat section HTML structure
    const farmerChatHTML = await chatSection.evaluate(el => el.outerHTML);
    
    // Navigate to chat.html
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    
    // Get chat.html chat section HTML structure
    const chatHTML = await page.locator('#chat').evaluate(el => el.outerHTML);
    
    // Compare key structural elements (ignore text content differences)
    const farmerElements = extractStructure(farmerChatHTML);
    const chatElements = extractStructure(chatHTML);
    
    console.log('Farmer chat elements:', farmerElements);
    console.log('Chat.html elements:', chatElements);
    
    // Verify all key elements exist in both
    expect(farmerElements).toEqual(chatElements);
  });

  test('should have identical CSS classes on chat elements', async ({ page }) => {
    // Test farmer.html
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    
    const farmerClasses = await page.evaluate(() => {
      const section = document.querySelector('#chat');
      if (!section) return {};
      
      return {
        section: section.className,
        hero: section.querySelector('.ac-section-hero')?.className,
        drawer: section.querySelector('#admin-chat-drawer')?.className,
        sidebar: section.querySelector('.chat-sidebar-panel')?.className,
        main: section.querySelector('.chat-main-panel')?.className,
        header: section.querySelector('.chat-thread-header')?.className,
        messages: section.querySelector('.chat-messages-feed')?.className,
        form: section.querySelector('.chat-compose-bar')?.className
      };
    });
    
    // Test chat.html
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    
    const chatClasses = await page.evaluate(() => {
      const section = document.querySelector('#chat');
      if (!section) return {};
      
      return {
        section: section.className,
        hero: section.querySelector('.ac-section-hero')?.className,
        drawer: section.querySelector('#admin-chat-drawer')?.className,
        sidebar: section.querySelector('.chat-sidebar-panel')?.className,
        main: section.querySelector('.chat-main-panel')?.className,
        header: section.querySelector('.chat-thread-header')?.className,
        messages: section.querySelector('.chat-messages-feed')?.className,
        form: section.querySelector('.chat-compose-bar')?.className
      };
    });
    
    console.log('Farmer CSS classes:', farmerClasses);
    console.log('Chat.html CSS classes:', chatClasses);
    
    expect(farmerClasses).toEqual(chatClasses);
  });

  test('should have identical element IDs', async ({ page }) => {
    const expectedIds = [
      'admin-chat-drawer',
      'conversation-list',
      'chat-empty-state',
      'chat-header',
      'chat-header-title',
      'chat-header-subtitle',
      'chat-messages',
      'chat-form',
      'chat-input',
      'chat-char-counter'
    ];
    
    // Test farmer.html
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    
    for (const id of expectedIds) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    
    // Test chat.html
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    
    for (const id of expectedIds) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('should have identical icon classes', async ({ page }) => {
    const expectedIcons = [
      { selector: '.ac-section-hero__icon i', class: 'bi-chat-dots' },
      { selector: '.chat-sidebar-title i', class: 'bi-chat-dots' },
      { selector: '.chat-thread-avatar i', class: 'bi-person' },
      { selector: '.chat-send-btn i', class: 'bi-send-fill' }
    ];
    
    // Test farmer.html
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    
    for (const { selector, class: expectedClass } of expectedIcons) {
      const icon = page.locator(selector);
      await expect(icon).toBeVisible();
      await expect(icon).toHaveClass(new RegExp(expectedClass));
    }
    
    // Test chat.html
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    
    for (const { selector, class: expectedClass } of expectedIcons) {
      const icon = page.locator(selector);
      await expect(icon).toBeVisible();
      await expect(icon).toHaveClass(new RegExp(expectedClass));
    }
  });

  test('should have identical form structure', async ({ page }) => {
    // Test farmer.html
    await page.goto('http://localhost:3000/farmer.html');
    await page.waitForLoadState('networkidle');
    
    const farmerForm = await page.evaluate(() => {
      const form = document.querySelector('#chat-form');
      if (!form) return null;
      
      const input = form.querySelector('#chat-input');
      const counter = form.querySelector('#chat-char-counter');
      const button = form.querySelector('.chat-send-btn');
      
      return {
        formClass: form.className,
        inputClass: input?.className,
        inputPlaceholder: input?.placeholder,
        inputMaxlength: input?.maxLength,
        counterClass: counter?.className,
        buttonClass: button?.className
      };
    });
    
    // Test chat.html
    await page.goto('http://localhost:3000/chat.html');
    await page.waitForLoadState('networkidle');
    
    const chatForm = await page.evaluate(() => {
      const form = document.querySelector('#chat-form');
      if (!form) return null;
      
      const input = form.querySelector('#chat-input');
      const counter = form.querySelector('#chat-char-counter');
      const button = form.querySelector('.chat-send-btn');
      
      return {
        formClass: form.className,
        inputClass: input?.className,
        inputPlaceholder: input?.placeholder,
        inputMaxlength: input?.maxLength,
        counterClass: counter?.className,
        buttonClass: button?.className
      };
    });
    
    console.log('Farmer form structure:', farmerForm);
    console.log('Chat.html form structure:', chatForm);
    
    expect(farmerForm).toEqual(chatForm);
  });
});

// Helper function to extract structure (ignoring text content)
function extractStructure(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const extract = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    
    const result = {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className ? el.className.split(' ').filter(c => c) : []
    };
    
    if (el.children.length > 0) {
      result.children = Array.from(el.children).map(extract).filter(c => c !== null);
    }
    
    return result;
  };
  
  return extract(doc.body.firstChild);
}
