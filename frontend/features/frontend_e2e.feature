Feature: Frontend End-to-End Integration
  As a VectorSpace user
  I want the frontend application to work correctly in a real browser
  So that I can use all features through the actual user interface

  Background:
    Given the backend and frontend servers are running
    And the test database is clean

  @e2e @critical @auth
  Scenario: User Authentication Flow
    Given I open the VectorSpace application
    When I click on "Sign Up"
    And I fill in the registration form with valid data
    And I submit the registration form
    Then I should see a success message
    And I should be redirected to the main dashboard
    When I logout
    And I login with the same credentials
    Then I should be successfully logged in
    And I should see my profile in the navigation

  @e2e @critical @conversation
  Scenario: Create and View Conversation
    Given I am logged in as a test user
    When I click "New Conversation"
    And I enter the title "Frontend Test Conversation"
    And I send the message "Hello, can you help me with React testing?"
    Then I should see my message in the conversation
    And I should see a typing indicator for the AI response
    When the AI responds
    Then I should see the AI response in the conversation
    And the conversation should be saved
    When I refresh the page
    Then I should still see the conversation in my list

  @e2e @critical @search
  Scenario: Search and Discovery
    Given there are public conversations in the database
    And I am logged in as a test user
    When I navigate to the Discovery page
    And I enter "machine learning" in the search box
    And I click the search button
    Then I should see search results
    And each result should show a title and summary
    When I click on a search result
    Then I should navigate to that conversation
    And I should see the full conversation content

  @e2e @high @realtime-presence
  Scenario: Real-time Presence System
    Given I am logged in as "Alice" in one browser
    And another user "Bob" is logged in in a second browser
    When Alice opens a public conversation
    And Bob navigates to the same conversation
    Then Alice should see a presence indicator showing "1 viewer"
    And Alice should see Bob's avatar in the presence area
    When Bob scrolls down in the conversation
    Then Alice should see Bob's avatar move with his scroll position
    When Alice clicks on Bob's avatar
    Then Alice's view should scroll to Bob's position

  @e2e @high @messaging
  Scenario: Multi-turn Conversation Flow
    Given I am logged in as a test user
    When I start a new conversation about "JavaScript promises"
    And I send multiple messages building on the topic
    Then each message should appear immediately
    And AI responses should stream in character by character
    And the conversation should maintain context across messages
    When the conversation reaches 1500+ tokens
    Then I should see an auto-archive notification
    And the conversation should appear in my archived conversations

  @e2e @high @sidebar-integration
  Scenario: Sidebar and Related Conversations
    Given I have an active conversation about "React hooks"
    And there are related conversations in the database
    When I view my conversation
    Then I should see a sidebar with related conversations
    And related conversations should show similarity scores
    When I click on a related conversation
    Then I should navigate to that conversation
    And I should see it marked as "related to your previous conversation"

  @e2e @medium @responsive
  Scenario: Mobile Responsive Interface
    Given I open the application on a mobile device
    When I navigate through different pages
    Then all content should be properly sized for mobile
    And navigation should work with touch interactions
    When I create a conversation on mobile
    Then the chat interface should be optimized for mobile
    And I should be able to scroll through long conversations smoothly

  @e2e @medium @profile-management
  Scenario: User Profile and Settings
    Given I am logged in as a test user
    When I click on my profile avatar
    And I select "Profile Settings"
    Then I should see my profile information
    When I upload a new profile image
    And I update my display name
    And I save the changes
    Then I should see the updated information
    And other users should see my new display name in conversations

  @e2e @medium @conversation-management
  Scenario: Conversation Organization
    Given I have multiple conversations
    When I go to my conversations list
    Then I should see all my conversations organized by date
    And I should be able to filter by "Active" and "Archived"
    When I archive a conversation manually
    Then it should move to the archived section
    When I search within my conversations
    Then I should see filtered results based on my query

  @e2e @low @error-handling
  Scenario: Frontend Error Handling
    Given I am using the application
    When the backend becomes temporarily unavailable
    Then I should see appropriate error messages
    And the UI should gracefully degrade
    When the backend comes back online
    Then the application should automatically reconnect
    And I should be able to continue my work

  @e2e @low @notifications
  Scenario: Real-time Notifications
    Given I am logged in as "Alice"
    And another user "Bob" is in the system
    When Bob joins one of my public conversations
    Then I should see a notification "Bob joined your conversation"
    When Bob likes one of my messages
    Then I should see a notification about the interaction
    And notifications should disappear after a reasonable time

  @e2e @low @performance
  Scenario: Frontend Performance
    Given I have a conversation with 50+ messages
    When I scroll through the entire conversation
    Then scrolling should be smooth without lag
    And images should load progressively
    When I switch between conversations quickly
    Then page transitions should be responsive
    And there should be no memory leaks or performance degradation