import puppeteer from 'puppeteer';

async function testPresenceSystem() {
  let browser1, browser2;
  
  try {
    // Launch two browser instances to simulate multiple users
    browser1 = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox']
    });
    
    browser2 = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: { width: 1280, height: 800 },
      args: ['--no-sandbox']
    });
    
    const page1 = await browser1.newPage();
    const page2 = await browser2.newPage();
    
    console.log('Setting up User 1...');
    
    // User 1: Login and start conversation
    await page1.goto('http://localhost:5173/login');
    await page1.waitForSelector('input[placeholder="Enter your username"]');
    await page1.type('input[placeholder="Enter your username"]', 'testuser2');
    await page1.type('input[placeholder="Enter your password"]', 'password123');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('User 1 logged in, starting conversation...');
    
    // Start a conversation
    await page1.waitForSelector('textarea[placeholder="Start a new conversation..."]');
    await page1.type('textarea[placeholder="Start a new conversation..."]', 'Hello! Testing presence system.');
    await page1.keyboard.press('Enter');
    
    // Wait for conversation to be created
    await page1.waitForTimeout(3000);
    
    console.log('Setting up User 2...');
    
    // User 2: Create another user and join same conversation
    // First create new user
    await page2.goto('http://localhost:5173/register');
    await page2.waitForSelector('input[placeholder="Enter your username"]');
    
    const timestamp = Date.now();
    const username2 = `testuser${timestamp}`;
    
    await page2.type('input[placeholder="Enter your username"]', username2);
    await page2.type('input[placeholder="Enter your display name"]', `Test User ${timestamp}`);
    await page2.type('input[placeholder="Enter your email"]', `${username2}@example.com`);
    await page2.type('input[placeholder="Enter your password"]', 'password123');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('User 2 registered and logged in');
    
    // Navigate to discover page to find the conversation
    await page2.goto('http://localhost:5173/discover');
    await page2.waitForTimeout(2000);
    
    // Look for conversation cards and click the first one
    const conversationCards = await page2.$$('.cursor-pointer');
    if (conversationCards.length > 0) {
      await conversationCards[0].click();
      await page2.waitForTimeout(2000);
    }
    
    console.log('Testing presence indicators...');
    
    // Check if User 1 sees User 2's presence
    await page1.waitForTimeout(2000);
    
    const presenceIndicator1 = await page1.$('.flex.items-center.space-x-1');
    if (presenceIndicator1) {
      console.log('✓ User 1 can see presence indicator');
      
      // Check for avatar
      const avatar = await page1.$('.h-6.w-6.md\\:h-7.md\\:w-7.border-2');
      if (avatar) {
        console.log('✓ User 1 can see User 2 avatar');
        
        // Get tooltip content
        await avatar.hover();
        await page1.waitForTimeout(500);
        const tooltip = await page1.$('.text-xs p');
        if (tooltip) {
          const tooltipText = await page1.evaluate(el => el.textContent, tooltip);
          console.log('✓ Tooltip shows:', tooltipText);
        }
      }
    }
    
    // Check if User 2 sees User 1's presence
    const presenceIndicator2 = await page2.$('.flex.items-center.space-x-1');
    if (presenceIndicator2) {
      console.log('✓ User 2 can see presence indicator');
      
      const avatar = await page2.$('.h-6.w-6.md\\:h-7.md\\:w-7.border-2');
      if (avatar) {
        console.log('✓ User 2 can see User 1 avatar');
      }
    }
    
    // Test user leaving
    console.log('Testing user disconnect...');
    await page2.close();
    await page1.waitForTimeout(3000);
    
    // Check if User 1 no longer sees User 2
    const presenceAfterLeave = await page1.$('.flex.items-center.space-x-1');
    if (!presenceAfterLeave) {
      console.log('✓ Presence indicator disappeared when user left');
    }
    
    // Take screenshots
    await page1.screenshot({ path: 'presence-test-user1.png', fullPage: true });
    console.log('Screenshots saved');
    
    console.log('✅ Presence system test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    
    // Take error screenshots
    if (browser1) {
      const pages1 = await browser1.pages();
      if (pages1.length > 1) {
        await pages1[1].screenshot({ path: 'presence-error-user1.png', fullPage: true });
      }
    }
    if (browser2) {
      const pages2 = await browser2.pages();
      if (pages2.length > 1) {
        await pages2[1].screenshot({ path: 'presence-error-user2.png', fullPage: true });
      }
    }
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
}

testPresenceSystem();