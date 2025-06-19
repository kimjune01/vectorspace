Feature: Semantic Conversation Search
  As a user
  I want to search for similar conversations
  So I can learn from others who had similar questions

  Background:
    Given the vector database contains embedded conversations

  Scenario: Search while chatting as logged-in user
    Given I am logged in
    And I am having a conversation about "Python decorators"
    When I click "Find Similar Conversations"
    Then I should see up to 20 conversations with similar topics
    And results should be ordered by similarity score
    And each result should show a preview of the conversation
    And I should be able to navigate to additional pages

  Scenario: Semantic search from discovery page
    Given I am on the discovery page
    When I search for "machine learning basics"
    Then I should see up to 20 relevant conversations per page
    And the results should be ordered by semantic similarity
    And I should see who started each conversation

  Scenario: Search results show context
    Given there are conversations about "React hooks"
    When I search for "useState React"
    Then I should see matching conversations
    And each result should highlight relevant parts
    And show the conversation title and summary

  Scenario: Anonymous user search - first page only
    Given I am not logged in
    When I search for "Python programming"
    Then I should see up to 20 relevant conversations
    And the results should be ordered by semantic similarity
    And I should NOT be able to navigate to additional pages
    And I should see a prompt to log in for more results

  Scenario: Logged-in user search - full pagination
    Given I am logged in
    When I search for "Python programming"
    And there are more than 20 matching conversations
    Then I should see up to 20 conversations on the first page
    And I should be able to navigate to page 2, 3, etc.
    And each page should show up to 20 results

  Scenario: Empty search results
    When I search for "extremely specific quantum physics topic"
    And no similar conversations exist
    Then I should see a message "No similar conversations found"
    And I should see suggestions to start a new conversation

  Scenario: Search respects PII filtering
    Given a conversation contains "contact john@email.com for help"
    When I search and this conversation appears in results
    Then the summary should show "contact [email] for help"
    And personal information should remain filtered