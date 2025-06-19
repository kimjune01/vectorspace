Feature: Public Conversation Discovery
  As a logged-in user
  I want all my conversations to be public by default
  So others can discover and learn from them

  Background:
    Given I am logged in as user "alice" with display name "Alice"

  Scenario: Start a public conversation
    When I start a new conversation
    Then the conversation should be marked as public
    And it should have a unique ID
    And it should be associated with my user account

  Scenario: Send messages in conversation
    Given I have an active conversation
    When I send the message "What is machine learning?"
    Then the message should be stored with role "user"
    And I should receive an AI response
    And the AI response should be stored with role "assistant"

  Scenario: Auto-generate summary after conversation reaches 1000 tokens
    Given I have a conversation with 1000 tokens of content
    When the conversation reaches the token limit
    Then a summary should be generated automatically
    And the summary should be approximately 500 tokens
    And the summary should have PII filtered out
    And the raw summary should be stored separately

  Scenario: Conversation appears in discovery feed
    Given I completed a conversation about "Python decorators"
    When another user views the discovery feed
    Then they should see my conversation
    And they should see my display name "Alice"
    And they should see the filtered summary
    And they should see when it was created

  Scenario: Browse recent conversations
    Given there are 30 public conversations
    When I request the discovery feed
    Then I should see the 20 nearest conversations
    And each conversation should show the author's display name
    And there should be no pagination

  Scenario: Archive conversation after 24 hours of inactivity
    Given I have an active conversation
    When 24 hours pass without any new messages
    Then the conversation should be automatically archived
    And a summary should be generated if it reached 1000 tokens
    And the conversation should appear in the discovery feed

  Scenario: Manually archive conversation
    Given I have an active conversation
    When I manually archive the conversation
    Then the conversation should be marked as archived
    And a summary should be generated if it reached 1000 tokens
    And the conversation should appear in the discovery feed