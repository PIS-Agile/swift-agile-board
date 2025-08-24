const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
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
    // You'll need to add login logic here
  } else {
    console.log('Already logged in');
  }
  
  // Wait for kanban board to load
  await page.waitForSelector('.kanban-column', { timeout: 10000 }).catch(() => {
    console.log('No kanban columns found');
  });
  
  // Try to hover over the first item to show the dropdown button
  const firstItem = await page.locator('.kanban-item').first();
  if (await firstItem.count() > 0) {
    console.log('Found kanban item, hovering...');
    await firstItem.hover();
    await page.waitForTimeout(500);
    
    // Look for the dropdown trigger
    const dropdownTrigger = await page.locator('.kanban-item button').first();
    const triggerVisible = await dropdownTrigger.isVisible().catch(() => false);
    console.log('Dropdown trigger visible:', triggerVisible);
    
    if (triggerVisible) {
      console.log('Clicking dropdown trigger...');
      await dropdownTrigger.click();
      await page.waitForTimeout(500);
      
      // Check if dropdown menu appeared
      const dropdownContent = await page.locator('[role="menu"]').first();
      const menuVisible = await dropdownContent.isVisible().catch(() => false);
      console.log('Dropdown menu visible:', menuVisible);
      
      if (!menuVisible) {
        console.log('Dropdown menu did not appear!');
        // Try to find any dropdown content
        const anyDropdown = await page.locator('div').filter({ hasText: 'Edit Item' });
        console.log('Found "Edit Item" text:', await anyDropdown.count());
      }
    }
  } else {
    console.log('No kanban items found');
  }
  
  // Keep browser open for inspection
  console.log('Test complete. Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();