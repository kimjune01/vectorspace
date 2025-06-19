import puppeteer from 'puppeteer';

async function testEnhancedSidebar() {
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 10000 });
    
    // Login with test user
    console.log('Logging in...');
    await page.type('input[placeholder="Enter your username"]', 'testuser2');
    await page.type('input[placeholder="Enter your password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to home page
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('Current URL:', page.url());
    await page.waitForSelector('h1', { timeout: 10000 });
    
    console.log('Testing Enhanced Sidebar...');
    
    // Check if the sidebar has two tabs
    const tabs = await page.$$('button[role="tab"]');
    console.log('Found tabs:', tabs.length);
    
    if (tabs.length >= 2) {
      console.log('✓ Two-tab sidebar found');
      
      // Check if Neighboring Chats tab is active by default
      // Check tab states
      const neighboringTabText = await page.$eval(
        'button[role="tab"]:first-child', 
        el => el.textContent
      );
      const neighboringTabActive = await page.$eval(
        'button[role="tab"]:first-child', 
        el => el.getAttribute('aria-selected') === 'true'
      );
      console.log('✓ Neighboring Chats tab:', neighboringTabText);
      console.log('✓ Neighboring Chats tab is active by default:', neighboringTabActive);
      
      // Start a new conversation to trigger similar conversations
      console.log('Starting a conversation...');
      const inputSelector = 'textarea[placeholder="Start a new conversation..."]';
      await page.waitForSelector(inputSelector);
      await page.type(inputSelector, 'Tell me about machine learning and neural networks');
      await page.keyboard.press('Enter');
      
      // Wait for AI response
      await page.waitForTimeout(3000);
      
      // Check if similar conversations appear
      console.log('Checking for similar conversations...');
      const similarConvText = await page.waitForSelector('text/Similar Conversations', { timeout: 15000 });
      if (similarConvText) {
        console.log('✓ Similar conversations section appeared');
        
        // Check for similarity scores
        const similarityScores = await page.$$eval('span:has-text("%")', 
          elements => elements.map(el => el.textContent)
        );
        console.log('✓ Found similarity scores:', similarityScores);
      }
      
      // Test My Chats tab
      console.log('Testing My Chats tab...');
      await page.click('button[role="tab"][aria-selected="false"]');
      await page.waitForTimeout(1000);
      
      const myChatsActive = await page.$eval(
        'button[role="tab"]:last-child', 
        el => el.getAttribute('aria-selected') === 'true'
      );
      console.log('✓ My Chats tab is now active:', myChatsActive);
      
    } else {
      console.log('✗ Two-tab sidebar not found');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'enhanced-sidebar-test.png', fullPage: true });
    console.log('Screenshot saved as enhanced-sidebar-test.png');
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'enhanced-sidebar-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testEnhancedSidebar();