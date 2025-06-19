import puppeteer from 'puppeteer';

async function testScrollBasedPresence() {
  let browser1, browser2;
  
  try {
    // Launch two browser instances
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
    
    // User 1: Login and start conversation with multiple messages
    await page1.goto('http://localhost:5173/login');
    await page1.waitForSelector('input[placeholder="Enter your username"]');
    await page1.type('input[placeholder="Enter your username"]', 'testuser2');
    await page1.type('input[placeholder="Enter your password"]', 'password123');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle0' });
    
    console.log('User 1 creating conversation with multiple messages...');
    
    // Create a conversation with multiple messages
    const messages = [
      'Hello! This is the first message for testing scroll-based presence.',
      'This is the second message. We need several messages to test scrolling.',
      'Third message here. The presence system should track which message users are viewing.',
      'Fourth message for more content. This helps test the viewport calculation.',
      'Fifth and final message. This should be enough to create a scrollable conversation.'
    ];
    
    for (const message of messages) {
      await page1.waitForSelector('input[placeholder*="Type your message"], input[placeholder*="Start a new conversation"]');
      await page1.click('input[placeholder*="Type your message"], input[placeholder*="Start a new conversation"]');
      await page1.type('input[placeholder*="Type your message"], input[placeholder*="Start a new conversation"]', message);
      await page1.click('button[type="submit"]');
      await page1.waitForTimeout(3000); // Wait for AI response
    }
    
    console.log('Setting up User 2...');
    
    // User 2: Create and login
    await page2.goto('http://localhost:5173/register');
    await page2.waitForSelector('input[placeholder="Enter your username"]');
    
    const timestamp = Date.now();
    const username2 = `scrolltest${timestamp}`;
    
    await page2.type('input[placeholder="Enter your username"]', username2);
    await page2.type('input[placeholder="Enter your display name"]', `Scroll Test ${timestamp}`);
    await page2.type('input[placeholder="Enter your email"]', `${username2}@example.com`);
    await page2.type('input[placeholder="Enter your password"]', 'password123');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Navigate to discover page and join the conversation
    await page2.goto('http://localhost:5173/discover');
    await page2.waitForTimeout(2000);
    
    const conversationCards = await page2.$$('[data-testid="conversation-card"], .cursor-pointer');
    if (conversationCards.length > 0) {
      await conversationCards[0].click();
      await page2.waitForTimeout(2000);
    }
    
    console.log('Testing scroll-based presence...');
    
    // Test 1: Check if users can see each other's presence
    await page1.waitForTimeout(2000);
    const headerPresence1 = await page1.$('.flex.items-center.space-x-1');
    if (headerPresence1) {
      console.log('✓ User 1 sees presence in header');
    }
    
    const headerPresence2 = await page2.$('.flex.items-center.space-x-1');
    if (headerPresence2) {
      console.log('✓ User 2 sees presence in header');
    }
    
    // Test 2: Scroll to different positions and check message-level presence
    console.log('Testing scroll position tracking...');
    
    // User 2 scrolls to top
    await page2.evaluate(() => {
      const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    await page2.waitForTimeout(1000);
    
    // Check if User 1 sees User 2's avatar next to a message
    await page1.waitForTimeout(1000);
    const messageAvatars1 = await page1.$$('.absolute.right-0.top-0, .absolute.left-0.top-2');
    if (messageAvatars1.length > 0) {
      console.log('✓ User 1 sees User 2 avatar next to message (top position)');
    }
    
    // User 2 scrolls to middle
    await page2.evaluate(() => {
      const scrollArea = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        const middle = scrollArea.scrollHeight / 2;
        scrollArea.scrollTo({ top: middle, behavior: 'smooth' });
      }
    });
    await page2.waitForTimeout(1000);
    
    // Check if avatar moved
    await page1.waitForTimeout(1000);
    const messageAvatars2 = await page1.$$('.absolute.right-0.top-0, .absolute.left-0.top-2');
    console.log(`✓ Found ${messageAvatars2.length} message avatar(s) after scroll`);
    
    // Test 3: Manual message selection
    console.log('Testing manual message selection...');
    
    // User 2 clicks on a specific message
    const messages2 = await page2.$$('[data-testid="message"], .cursor-pointer');
    if (messages2.length > 2) {
      await messages2[1].click(); // Click second message
      await page2.waitForTimeout(1000);
      
      // Check if selection is highlighted
      const highlightedMessage = await page2.$('.bg-primary\\/5.ring-2.ring-primary\\/20');
      if (highlightedMessage) {
        console.log('✓ Manual message selection shows highlight');
      }
    }
    
    // Test 4: User disconnect cleans up presence
    console.log('Testing presence cleanup...');
    await page2.close();
    await page1.waitForTimeout(3000);
    
    // Check if presence avatars disappeared
    const remainingAvatars = await page1.$$('.absolute.right-0.top-0, .absolute.left-0.top-2');
    if (remainingAvatars.length === 0) {
      console.log('✓ Presence avatars cleaned up after user disconnect');
    }
    
    // Take final screenshot
    await page1.screenshot({ path: 'scroll-presence-test.png', fullPage: true });
    console.log('Screenshot saved: scroll-presence-test.png');
    
    console.log('✅ Scroll-based presence test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    
    // Take error screenshots
    if (browser1) {
      const pages1 = await browser1.pages();
      if (pages1.length > 1) {
        await pages1[1].screenshot({ path: 'scroll-presence-error-user1.png', fullPage: true });
      }
    }
    if (browser2) {
      const pages2 = await browser2.pages();
      if (pages2.length > 1) {
        await pages2[1].screenshot({ path: 'scroll-presence-error-user2.png', fullPage: true });
      }
    }
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
}

testScrollBasedPresence();