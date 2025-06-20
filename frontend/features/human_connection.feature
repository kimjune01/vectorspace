Feature: Human Connection Features
  As a user discovering interesting conversations and minds
  I want to connect and collaborate with other users
  So that I can build meaningful relationships around shared thoughts and ideas

  Background:
    Given the application is running
    And I am logged in as "alice"
    And there is another user "bob" with public conversations
    And there is a third user "carol" with public conversations

  @follow-system
  Scenario: Follow a user after discovering their interesting conversation
    Given I am on the discover page
    When I find a conversation by "bob" about "machine learning ethics"
    And I click on bob's profile from the conversation
    Then I should see bob's profile page with their conversation history
    And I should see a "Follow" button
    When I click "Follow"
    Then the button should change to "Following"
    And bob should appear in my following list
    And I should appear in bob's followers list
    And bob should receive a notification about the new follower

  @follow-system
  Scenario: View followers and following lists
    Given I am following "bob" and "carol"
    And "dave" and "eve" are following me
    When I go to my profile page
    Then I should see "Following: 2" and "Followers: 2"
    When I click on "Following: 2"
    Then I should see a list containing "bob" and "carol"
    When I click on "Followers: 2"
    Then I should see a list containing "dave" and "eve"

  @follow-system
  Scenario: Unfollow a user
    Given I am following "bob"
    When I go to bob's profile page
    Then I should see a "Following" button
    When I click "Following"
    Then the button should change to "Follow"
    And bob should not appear in my following list
    And I should not appear in bob's followers list

  @human-chat
  Scenario: Join an existing AI conversation for human discussion
    Given bob has an active AI conversation about "climate change solutions"
    And the conversation is public
    And I am following bob
    When I discover bob's conversation
    And I click "Join Discussion"
    Then I should be taken to the conversation room
    And I should see the AI conversation history
    And I should see a human chat section alongside the AI chat
    And I should see bob is online in the human chat
    And I should be able to send messages in the human chat

  @human-chat
  Scenario: Real-time human chat in conversation room
    Given I am in bob's conversation room about "climate change solutions"
    And I am following bob
    And bob is also in the conversation room
    When I type "Great points about renewable energy!" in the human chat
    And I press Enter
    Then bob should immediately see my message with timestamp
    When bob types "Thanks! What do you think about nuclear power?"
    Then I should immediately see bob's message with timestamp
    And the message should show bob's profile picture and name
    And these messages will be retained for 30 days
    And if the AI conversation auto-archives after 24h inactivity
    Then the human chat remains accessible for the full 30 days

  @human-chat
  Scenario: Multiple users chatting in same conversation room
    Given bob has a conversation about "AI consciousness"
    And I am following bob and have joined the conversation room
    And carol is following bob and has also joined the conversation room
    When I send a message "Fascinating topic!"
    And carol sends a message "I disagree with the premise"
    And bob sends a message "Let me continue the AI conversation to explore this"
    Then all three messages should be visible to everyone with timestamps
    And we should see online indicators for all participants
    When bob continues chatting with the AI about consciousness
    Then the AI responses should be visible to all participants
    And the AI can see and reference bob's human chat messages
    And bob can toggle whether AI sees messages from me and carol

  @human-chat
  Scenario: Gradual permissions for conversation participation
    Given bob has a public conversation about "philosophy of mind"
    And I am NOT following bob
    When I visit bob's conversation room
    Then I should be able to view the AI conversation
    And I should be able to see human chat messages
    But I should see "Follow bob to join the discussion" instead of a chat input
    When I click "Follow bob to join the discussion"
    And I follow bob
    Then the chat input should become available
    And I should be able to participate in the human chat

  @curation
  Scenario: Save interesting conversations to personal collection
    Given I am browsing bob's conversation about "quantum computing basics"
    When I click the bookmark icon on the conversation
    Then the conversation should be added to my saved conversations
    And I should see a confirmation "Conversation saved"
    When I go to my profile and click "Saved Conversations"
    Then I should see bob's quantum computing conversation in my public collection
    And it should show the original author and conversation summary
    And bob will NOT be notified that I saved his conversation

  @curation
  Scenario: Organize saved conversations with tags
    Given I have saved several conversations about different topics
    When I go to my "Saved Conversations" section
    And I click "Add Tags" on a conversation about machine learning
    And I add tags "AI", "Education", "Technical"
    Then the conversation should show these tags
    When I filter by tag "AI"
    Then I should only see conversations tagged with "AI"
    And I should be able to search within my saved conversations

  @curation
  Scenario: Create and share conversation collections
    Given I have saved multiple conversations about "productivity tips"
    When I go to my saved conversations
    And I select 3 conversations about productivity
    And I click "Create Collection"
    And I name it "Best Productivity Insights" with description "Top conversations that changed how I work"
    Then I should have a new public collection by default
    When other users visit my profile
    Then they should see my "Best Productivity Insights" collection
    And they should be able to browse the conversations in it
    But they cannot add conversations to my collection
    And they must visit my profile to discover this collection

  @collaboration
  Scenario: Invite others to collaborate on a conversation
    Given I have an ongoing AI conversation about "space exploration ethics"
    When I click "Invite Collaborators"
    And I search for and select "bob" and "carol"
    And I add a message "Would love your thoughts on this ethical framework"
    Then bob and carol should receive notifications with the invitation
    When bob accepts the invitation
    Then bob should be able to join the conversation room
    And bob should see all AI conversation history
    And bob can participate in human chat
    But bob cannot directly chat with the AI
    And bob can suggest prompts for me to send to the AI
    And the conversation shows "alice's conversation (with bob)"

  @collaboration
  Scenario: Collaborative conversation with owner-controlled AI
    Given I have invited bob to collaborate on my AI conversation about "ethical AI development"
    And bob has accepted the invitation
    When bob suggests a prompt "Ask about transparency in AI decision-making"
    Then I should see bob's suggestion in the human chat
    And I should see an option to "Send bob's suggestion to AI"
    When I click "Send bob's suggestion to AI"
    Then the AI receives "How do we ensure transparency in AI decision-making?"
    And both bob and I see the AI's response in real-time
    When I directly ask the AI "What are the main challenges in AI alignment?"
    Then bob sees my question and the AI response immediately
    And the AI maintains context from our entire collaborative session
    And bob can leave the collaboration but his contributions remain visible

  @collaboration
  Scenario: Collaboration requires following
    Given I have an ongoing AI conversation about "quantum computing"
    And "dave" is not following me
    When I invite "dave" to collaborate
    And dave receives the collaboration invitation
    Then dave sees "Follow alice to accept collaboration invitation"
    When dave follows me and accepts the invitation
    Then dave can join my conversation room as a collaborator

  @notifications
  Scenario: Receive smart notifications based on topic interests
    Given I have engaged with conversations about "AI ethics" and "machine learning"
    And I am following "bob" who talks about various topics
    When bob starts a new conversation about "AI safety"
    Then I should receive a notification "bob started a new conversation about AI safety"
    When bob starts a new conversation about "cooking recipes"
    Then I should NOT receive a notification
    When someone invites me to collaborate
    Then I should receive a notification "alice invited you to collaborate on space exploration ethics"

  @discovery-enhanced
  Scenario: Discover users through conversation patterns
    Given I frequently engage with conversations about "climate science"
    When I go to the discover page and click "Discover People"
    Then I should see recommended users who also engage with climate science topics
    And I should see "Recommended based on your interests in climate science"
    When I click on a recommended user "eve"
    Then I should see eve's profile with highlighted conversations matching my interests
    And I should see "Common interests: Climate Science, Renewable Energy"
    And I should see a "Follow" button to connect with eve

  @discovery-enhanced
  Scenario: Find conversations through social connections
    Given I am following "bob" and "carol"
    When I go to the discover page
    Then I should see a "From People You Follow" section
    And I should see recent conversations from bob and carol
    When I click "Show More from Following"
    Then I should see a feed of recent activity from all people I follow
    And I should see when they start new conversations or save interesting content
    And I should be able to jump into their conversation rooms or save their discoveries