Feature: Complete Round-Trip Integration
  As VectorSpace users
  We want the complete workflow from conversation creation to discovery to presence
  So that the platform provides seamless AI conversation discovery and real-time engagement

  Background:
    Given the application is running with full integration support
    And the vector database is initialized
    And real-time presence system is active

  @integration @round-trip @critical
  Scenario: Complete round-trip from typing to discovery to presence
    # Phase 1: User A creates and completes a conversation
    Given I am user "alice" with display name "Alice" and email "alice@vectorspace.com"
    When I start a new conversation with title "Python Machine Learning Tutorial"
    And I send the message "Can you explain how neural networks work in Python? I'm particularly interested in backpropagation and gradient descent."
    And I wait for the AI response
    And I send the message "That's helpful! Can you show me a simple implementation using numpy? I want to understand the math behind it."
    And I wait for the AI response
    And I send the message "Perfect! Now can you explain how to use TensorFlow for the same thing? What are the key differences?"
    And I wait for the AI response
    And I send the message "Thanks! This conversation has been really educational. I feel like I understand neural networks much better now."
    And I wait for the AI response
    Then the conversation should have at least 1500 tokens
    And the conversation should be automatically summarized
    And the summary should be PII-filtered
    And the conversation should be archived after completion
    And the conversation should be embedded in the vector database
    And the conversation should appear in the discovery feed

    # Phase 2: User B discovers the conversation through search
    Given I am user "bob" with display name "Bob" and email "bob@vectorspace.com"
    When I search for "neural networks Python machine learning"
    Then I should see Alice's conversation in the search results
    And the search result should show Alice's display name
    And the search result should show the filtered summary
    And the search result should have a high similarity score
    When I click on Alice's conversation from search results
    Then I should navigate to the conversation view
    And I should see the full conversation history
    And I should see "Alice" as the conversation author
    And Alice should be notified that Bob has joined as a viewer

    # Phase 3: Real-time presence and interaction
    When Bob scrolls through Alice's conversation
    Then Alice should see Bob's avatar moving next to the messages Bob is reading
    And Bob's scroll position should update in real-time
    And the presence indicator should show "1 viewer currently reading"
    When Bob scrolls to the message about TensorFlow
    Then Alice should see Bob's avatar next to the TensorFlow message
    And Alice should be able to see which specific part Bob is interested in
    When Alice clicks on Bob's presence avatar
    Then Alice's view should scroll to the same message Bob is reading
    And Alice should see a "Following Bob" indicator

    # Phase 4: Bob starts his own related conversation
    When Bob starts a new conversation inspired by Alice's
    And Bob sends the message "I just read Alice's great explanation of neural networks. I want to dive deeper into TensorFlow implementation. Can you help me build a CNN for image classification?"
    And Bob waits for the AI response
    And Bob sends the message "That's exactly what I needed! Can you explain how convolutional layers work compared to the dense layers Alice discussed?"
    And Bob waits for the AI response
    Then Bob's conversation should be related to Alice's conversation
    And Bob's conversation should appear in the "Similar Conversations" sidebar when viewing Alice's conversation
    And Alice should see Bob's new conversation in her "Related by Community" feed

    # Phase 5: Discovery sidebar integration
    When Alice views her original conversation
    Then the sidebar should show Bob's related conversation
    And the sidebar should indicate "1 viewer" for Bob's active conversation
    And Alice should see Bob's mini avatar in the sidebar next to his conversation
    When Alice clicks on Bob's conversation from the sidebar
    Then Alice should navigate to Bob's conversation
    And Bob should be notified that Alice has joined as a viewer
    And the presence system should show both users are now viewing Bob's conversation

    # Phase 6: Bidirectional discovery and community building
    Then both conversations should be cross-referenced in the vector database
    And searching for "neural networks" should return both conversations ranked by relevance
    And the community discovery feed should show both conversations as related
    And the trending topics should include "neural networks" and "TensorFlow"
    And both users should appear in each other's "Recently Interacted" lists
    And the semantic similarity between the conversations should be measurable

  @integration @performance
  Scenario: Round-trip performance benchmarks
    Given the performance monitoring is enabled
    When I execute the complete round-trip workflow
    Then conversation creation should complete within 2 seconds
    And AI responses should arrive within 10 seconds
    And summarization should complete within 5 seconds after archiving
    And vector embedding should complete within 3 seconds
    And search results should return within 1 second
    And presence updates should propagate within 500ms
    And sidebar updates should appear within 2 seconds
    And cross-user notifications should arrive within 1 second

  @integration @data-integrity
  Scenario: Data consistency throughout round-trip
    Given data integrity monitoring is enabled
    When I execute the complete round-trip workflow
    Then all conversation data should remain consistent across the database
    And vector embeddings should accurately represent conversation content
    And PII filtering should be consistent between summary and search results
    And presence data should be accurately maintained and cleaned up
    And user activity metrics should be correctly updated
    And conversation relationships should be properly established
    And no data should be lost during any phase of the workflow

  @integration @error-handling
  Scenario: Round-trip resilience and error recovery
    Given error injection capabilities are enabled
    When I execute the round-trip workflow with simulated failures
    And the AI service temporarily fails during conversation
    Then the conversation should gracefully handle the failure
    And users should receive appropriate error messages
    And the conversation state should be preserved
    When the AI service recovers
    Then users should be able to continue the conversation
    And the summarization and indexing should complete normally
    When the vector database is temporarily unavailable
    Then search should gracefully degrade
    And conversations should still be discoverable through other means
    When presence WebSocket connections are disrupted
    Then users should automatically reconnect
    And presence state should be restored accurately