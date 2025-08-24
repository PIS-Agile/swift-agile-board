import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  
  console.log('Navigating to app...');
  await page.goto('http://localhost:8080');
  
  // Wait for the app to load
  await page.waitForTimeout(3000);
  
  // Check if we're on the auth page
  const isAuthPage = await page.url().includes('/auth');
  if (isAuthPage) {
    console.log('On auth page, need to login first');
    await browser.close();
    return;
  } else {
    console.log('Already logged in or on main page');
  }
  
  // Wait for kanban board to load
  try {
    await page.waitForSelector('.kanban-column', { timeout: 5000 });
    console.log('Found kanban columns');
  } catch {
    console.log('No kanban columns found');
  }
  
  // Try to hover over the first item to show the dropdown button
  const firstItem = await page.locator('.kanban-item').first();
  if (await firstItem.count() > 0) {
    console.log('Found kanban item, hovering...');
    await firstItem.hover();
    await page.waitForTimeout(500);
    
    // Look for the dropdown trigger
    const dropdownTriggers = await page.locator('.kanban-item button');
    console.log('Found dropdown triggers:', await dropdownTriggers.count());
    
    // Get the HTML of the button area
    const buttonArea = await page.locator('.kanban-item >> css=div.relative').first();
    if (await buttonArea.count() > 0) {
      const html = await buttonArea.innerHTML();
      console.log('Button area HTML:', html);
    }
    
    // Try different selectors
    const moreButton = await page.locator('button:has(svg)').first();
    if (await moreButton.isVisible()) {
      console.log('Found more button, clicking...');
      await moreButton.click({ force: true });
      await page.waitForTimeout(1000);
      
      // Check if dropdown menu appeared
      const dropdownContent = await page.locator('[role="menu"]');
      console.log('Dropdown menu found:', await dropdownContent.count());
      
      // Also check for any element with "Edit Item" text
      const editItem = await page.locator('text="Edit Item"');
      console.log('Edit Item option found:', await editItem.count());
    }
  } else {
    console.log('No kanban items found');
  }
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'dropdown-test.png' });
  console.log('Screenshot saved as dropdown-test.png');
  
  await browser.close();
})();