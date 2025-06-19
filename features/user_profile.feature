Feature: Public User Profiles
  As a user
  I want to have a public profile showing my conversations
  So others can see my AI interaction style without revealing personal information

  Background:
    Given user "alice123" exists with display name "Alice"
    And user "alice123" has completed 10 conversations

  Scenario: View user profile
    When I visit the profile for "alice123"
    Then I should see the display name "Alice"
    And I should see up to 10 recent conversations
    And I should see the user's bio if provided
    And I should see the user's total conversation count
    And I should see how many conversations they had in the last 24 hours
    And I should see their profile image or generated stripe pattern
    And I should NOT see the username "alice123" displayed
    And there should be no pagination for conversations

  Scenario: Profile shows filtered summaries
    Given user "alice123" has a conversation containing "email me at alice@example.com"
    When I view the profile for "alice123"
    Then I should see the conversation summary
    And the summary should show "[email]" instead of the actual email
    And the conversation meaning should be preserved

  Scenario: Update my profile
    Given I am logged in as "alice123"
    When I update my bio to "AI enthusiast and Python developer"
    Then my profile should show the new bio
    And the bio should be limited to 200 characters

  Scenario: Upload profile image
    Given I am logged in as "alice123"
    When I upload a profile image
    Then my profile should display the uploaded image
    And the image should be properly sized and cropped

  Scenario: Generated stripe pattern for users without profile image
    Given user "bob456" exists without a profile image
    When I visit the profile for "bob456"
    Then I should see a generated image with horizontal stripes
    And the stripes should be solid colors
    And the pattern should be consistent for this user

  Scenario: Hide conversations from profile
    Given I am logged in as "alice123"
    And I have 5 public conversations
    When I hide 2 conversations from my profile
    Then my profile should show only 3 conversations
    And the hidden conversations should not be visible to others
    And the hidden conversations should still appear in search results

  Scenario: Profile statistics
    Given user "alice123" has 15 total conversations
    And user "alice123" had 3 conversations in the last 24 hours
    When I visit the profile for "alice123"
    Then I should see "15 total conversations"
    And I should see "3 conversations in the last 24 hours"

  Scenario: Profile conversation ordering
    Given user "alice123" has conversations from different dates
    When I view the profile
    Then conversations should be ordered by most recent first
    And each conversation should show a relative timestamp

  Scenario: Privacy protection in profiles
    Given a conversation contains personal information
    Including phone numbers, addresses, and emails
    When the conversation appears on a profile
    Then all personal information should be filtered
    And show [phone], [address], and [email] placeholders instead