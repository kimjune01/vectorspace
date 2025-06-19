Feature: Enhanced Discovery and Real-Time Presence
  As a user
  I want to discover conversations in a sidebar while viewing real-time presence
  So that I can engage with the community and see who's reading what

  Background:
    Given the application is running with WebSocket support
    And user "alice" exists with display name "Alice" and profile image
    And user "bob" exists with display name "Bob" and profile image
    And user "charlie" exists with display name "Charlie" and profile image

  # ===== ENHANCED SIDEBAR DISCOVERY =====

  Scenario: Sidebar shows mixed discovery content instead of separate page
    Given I am logged in as "alice"
    And there are 10 recent conversations from other users
    And there are 5 conversations similar to my current chat topic
    And there are 3 trending conversation topics
    When I view any conversation page
    Then I should see a sidebar with discovery sections
    And I should NOT see a separate discovery page link
    And the sidebar should contain:
      | Section                    | Count | Description                           |
      | Similar to Current Chat    | 3-5   | Conversations related to current topic|
      | Recent from Community      | 5-8   | Latest public conversations           |
      | Trending Topics            | 3-5   | Popular conversation themes           |
      | Your Recent Chats          | 5     | User's own recent conversations       |

  Scenario: Smart content mixing in sidebar
    Given I am viewing a conversation about "Python decorators"
    When the sidebar loads discovery content
    Then "Similar to Current Chat" should show Python/programming conversations first
    And "Recent from Community" should show the 5-8 most recent public conversations
    And "Trending Topics" should show conversation topics with high recent activity
    And each section should update in real-time as new conversations are created

  Scenario: Sidebar search filters all discovery content
    Given I am viewing the sidebar with mixed discovery content
    When I type "machine learning" in the sidebar search box
    Then all sidebar sections should filter to show only ML-related conversations
    And the search should work across titles, summaries, and topics
    And I should see real-time results as I type

  # ===== BASIC PRESENCE SYSTEM =====

  Scenario: Users can see who is currently viewing a conversation
    Given conversation "Python Tips" exists created by "alice"
    And I am logged in as "bob"
    When I navigate to the "Python Tips" conversation
    Then "alice" should see that "bob" has joined the conversation
    And I should see a presence indicator showing "alice" (author) and "bob" (me)
    And the author "alice" should be visually distinct from viewers

  Scenario: Multiple users viewing the same conversation
    Given conversation "React Hooks" exists created by "alice"
    And "bob" is currently viewing the conversation
    And "charlie" is currently viewing the conversation
    When I log in as "david" and view the same conversation
    Then I should see presence indicators for:
      | User     | Role   | Visual State |
      | alice    | author | distinct     |
      | bob      | viewer | normal       |
      | charlie  | viewer | normal       |
      | david    | viewer | me (self)    |
    And all users should see the updated presence list
    And the total viewer count should show "3 viewing"

  Scenario: Real-time join and leave notifications
    Given I am viewing conversation "JavaScript Promises"
    And "bob" is also viewing the conversation
    When "charlie" joins the conversation
    Then I should see "charlie" appear in the presence indicators
    And I should see a subtle notification "Charlie joined"
    When "bob" leaves the conversation (closes tab/navigates away)
    Then I should see "bob" disappear from presence indicators
    And I should see a subtle notification "Bob left"
    And the viewer count should update accordingly

  # ===== SCROLL-BASED PRESENCE =====

  Scenario: Show user avatars next to messages they are currently reading
    Given conversation "Deep Learning Guide" has 10 messages
    And I am logged in as "alice" viewing the conversation
    And "bob" is also viewing the conversation
    When "bob" scrolls to message #5
    Then I should see "bob's" mini avatar (24px) next to message #5
    And the avatar should be positioned on the right side of the message
    When "bob" scrolls to message #7
    Then "bob's" avatar should smoothly move from message #5 to message #7
    And the transition should take approximately 200ms

  Scenario: Multiple users reading different parts of the same conversation
    Given conversation "AI Ethics Discussion" has 15 messages
    And I am logged in as "alice" at message #3
    And "bob" is reading message #8
    And "charlie" is reading message #12
    When I view the conversation
    Then I should see:
      | Message | Avatars Present  | Position    |
      | #3      | alice (me)       | highlighted |
      | #8      | bob              | right side  |
      | #12     | charlie          | right side  |
    And each user's reading position should update in real-time as they scroll

  Scenario: Avatar stacking when multiple users read the same message
    Given conversation "Python Best Practices" has 8 messages
    And "bob", "charlie", and "david" are all reading message #4
    When I view the conversation
    Then I should see all three avatars next to message #4
    And the avatars should be stacked horizontally with slight overlap
    And the stack should not exceed 3 avatars wide
    And if more than 3 users read the same message, show "+N more" indicator

  # ===== PRESENCE STATES AND TRANSITIONS =====

  Scenario: Presence states - Active, Idle, and Typing
    Given I am viewing a conversation with "bob"
    When "bob" is actively scrolling through messages
    Then "bob's" avatar should show in "active" state (full opacity)
    When "bob" stops scrolling for 30 seconds
    Then "bob's" avatar should transition to "idle" state (50% opacity)
    When "bob" starts typing a response
    Then "bob's" avatar should show a typing indicator
    And the typing state should override the reading position temporarily

  Scenario: Auto-cleanup of inactive presence
    Given "bob" is viewing a conversation
    When "bob" closes the browser tab without properly leaving
    And 30 seconds pass without any activity from "bob"
    Then "bob's" presence should be automatically removed
    And other users should see "Bob left" notification
    And the viewer count should decrease by 1

  # ===== CONVERSATION AUTHOR EXPERIENCE =====

  Scenario: Authors see enhanced engagement metrics
    Given I am logged in as "alice"
    And I created conversation "Machine Learning Basics"
    And "bob" and "charlie" are currently viewing my conversation
    When I view my own conversation
    Then I should see "2 viewers currently reading"
    And I should see which specific messages have active readers
    And I should be visually distinguished as the author in presence indicators
    And I should see real-time engagement as users scroll through my content

  Scenario: Author can follow a reader's position
    Given I created conversation "React Tutorial"
    And "bob" is reading message #6 of my conversation
    When I click on "bob's" presence avatar
    Then my view should smoothly scroll to message #6
    And I should see a temporary highlight around message #6
    And I should see "Following Bob" indicator for 3 seconds

  # ===== PERFORMANCE AND SCALABILITY =====

  Scenario: Scroll position updates are throttled for performance
    Given I am viewing a conversation with presence enabled
    When I scroll rapidly through multiple messages
    Then my scroll position should be sent to other users at most once every 100ms
    And the updates should be batched to prevent flooding
    And other users should see smooth avatar movement despite throttling

  Scenario: Presence is limited to prevent performance issues
    Given conversation "Popular Discussion" has 60 users trying to view it
    When I try to join the conversation
    Then I should be allowed to join if under 50 concurrent viewers
    And if at capacity, I should see "This conversation is at maximum capacity"
    And I should be added to a waiting queue
    And I should be notified when a slot becomes available

  # ===== SIDEBAR PRESENCE INTEGRATION =====

  Scenario: Sidebar shows live viewer counts for discovered conversations
    Given I am viewing the discovery sidebar
    And conversation "Vue.js Tips" has 3 active viewers
    And conversation "CSS Grid Layout" has 1 active viewer
    When the sidebar displays these conversations
    Then I should see "👁️ 3 viewing" next to "Vue.js Tips"
    And I should see "👁️ 1 viewing" next to "CSS Grid Layout"
    And the viewer counts should update in real-time
    And I should see mini avatars of current viewers (max 3 shown + "+N more")

  Scenario: Clicking on a conversation with active viewers
    Given the sidebar shows "JavaScript Async" with "👁️ 2 viewing"
    When I click on that conversation
    Then I should navigate to the conversation
    And I should immediately see the 2 active viewers' presence
    And I should be added as the 3rd viewer
    And my presence should be visible to the existing viewers

  # ===== MOBILE AND ACCESSIBILITY =====

  Scenario: Presence works on mobile devices
    Given I am using a mobile device
    And I am viewing a conversation with other active users
    When other users scroll through the conversation
    Then I should see their presence avatars next to messages
    And the avatars should be appropriately sized for mobile (20px instead of 24px)
    And touch scrolling should properly update my presence position
    And presence indicators should not interfere with mobile reading experience

  Scenario: Presence is accessible to screen readers
    Given I am using a screen reader
    And I am viewing a conversation with 2 other active users
    When I navigate through the conversation
    Then I should hear announcements like "Bob is reading message 5"
    And viewer join/leave events should be announced
    And I should be able to tab through presence indicators
    And each presence indicator should have descriptive alt text

  # ===== PRIVACY AND PERMISSIONS =====

  Scenario: Users can disable their presence visibility
    Given I am logged in with presence enabled by default
    When I go to my profile settings
    And I toggle "Show my reading presence to others" to OFF
    Then other users should not see my reading position
    But I should still be able to see others' presence
    And conversation authors should still see me in viewer count (anonymously)

  Scenario: Private conversations have restricted presence
    Given conversation "Private Discussion" is marked as private
    And only invited users can view it
    When invited user "bob" and "charlie" are viewing it
    Then only "bob" and "charlie" should see each other's presence
    And the conversation should not appear in any discovery sidebar
    And presence should work normally among authorized viewers