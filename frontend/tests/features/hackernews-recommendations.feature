Feature: Hacker News Recommendations Sync with Current Chat
  As a user engaging in AI conversations
  I want to see relevant Hacker News topics that relate to my current discussion
  So that I can discover related content and expand my knowledge on the topic

  Background:
    Given I am logged in as a user
    And I am on the chat interface

  Scenario: HN recommendations appear after conversation is summarized
    Given I start a new conversation
    When I send my first message about "machine learning applications"
    And the AI responds with detailed information
    And the conversation gets automatically summarized
    Then I should see a "From Hacker News" section in the discovery sidebar
    And the HN topics should be semantically related to machine learning
    And the topics should include terms like "AI", "Machine Learning", or "Neural Networks"

  Scenario: HN recommendations are not shown for unsummarized conversations
    Given I start a new conversation
    When I send my first message about "programming languages"
    But the AI has not yet responded
    Then I should not see a "From Hacker News" section in the discovery sidebar
    And the discovery sidebar should not show any HN-related content

  Scenario: HN recommendations update when switching between conversations
    Given I have two conversations:
      | conversation | topic | summary_status |
      | Chat A | artificial intelligence | summarized |
      | Chat B | web development | summarized |
    When I view "Chat A" about artificial intelligence
    Then the "From Hacker News" section should show AI-related topics
    When I switch to "Chat B" about web development
    Then the "From Hacker News" section should update to show web development topics
    And the topics should be different from the AI conversation topics

  Scenario: HN recommendations handle various conversation topics
    Given I have a conversation about "blockchain technology"
    And the conversation has been summarized
    When I view the conversation
    Then the "From Hacker News" section should appear
    And the recommended topics should include blockchain-related terms
    And clicking on a topic should search for that term in the discover page

  Scenario: HN section gracefully handles service unavailability
    Given I have a summarized conversation about "cybersecurity"
    And the corpus service is unavailable
    When I view the conversation
    Then the "From Hacker News" section should not appear
    And no error messages should be visible to the user
    And the rest of the discovery sidebar should function normally

  Scenario: HN recommendations respect conversation privacy
    Given I have a private conversation about "startup strategies"
    And the conversation has been summarized
    When I view the conversation
    Then the "From Hacker News" section should still appear
    And the topics should be based on the conversation summary
    And the recommendations should not expose private conversation details

  Scenario: HN topics are clickable and functional
    Given I have a summarized conversation about "React development"
    And the "From Hacker News" section shows relevant topics
    When I click on a topic like "React Hooks"
    Then I should be redirected to the discover page
    And the search should be populated with "React Hooks"
    And I should see search results related to that topic

  Scenario: Multiple HN topics are displayed appropriately
    Given I have a summarized conversation covering "AI, Python, and data science"
    When I view the conversation
    Then the "From Hacker News" section should show multiple relevant topics
    And I should see at least 3 but no more than 5 topic badges
    And each topic should be clickable
    And the topics should cover the breadth of the conversation themes

  Scenario: HN recommendations work with conversation updates
    Given I have an ongoing conversation about "machine learning"
    And the conversation has been summarized once
    When I continue the conversation by discussing "deep learning frameworks"
    And the conversation gets re-summarized with the new content
    Then the "From Hacker News" section should update
    And the topics should reflect both machine learning and deep learning themes
    And the recommendations should be more specific to the expanded discussion

  Scenario: Empty HN results are handled gracefully
    Given I have a conversation about a very niche technical topic
    And the conversation has been summarized
    When the HN semantic search returns no relevant results
    Then the "From Hacker News" section should not appear
    And no empty or placeholder content should be shown
    And the discovery sidebar should display other sections normally