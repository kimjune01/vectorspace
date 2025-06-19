Feature: User Authentication
  As a user
  I want to sign up and log in
  So that my conversations are associated with my account

  Background:
    Given the application is running

  Scenario: User signup with display name and email
    Given I am on the signup endpoint
    When I provide username "alice123", display name "Alice", email "alice@example.com", and password "securepass123"
    Then I should receive a success response
    And I should receive a JWT token that does not expire
    And my profile should show display name "Alice"
    And my username "alice123" should be used for login only
    And email verification should not be required

  Scenario: User login
    Given I have an account with username "alice123" and password "securepass123"
    When I provide my credentials to the login endpoint
    Then I should receive a success response
    And I should receive a JWT token that does not expire
    And the token should remain valid until logout

  Scenario: Username uniqueness
    Given a user exists with username "alice123"
    When I try to sign up with username "alice123"
    Then I should receive an error "Username already taken"

  Scenario: Password requirements
    Given I am on the signup endpoint
    When I provide a password with less than 8 characters
    Then I should receive an error "Password must be at least 8 characters"
    And I should NOT receive any other password complexity requirements

  Scenario: Email required during signup
    Given I am on the signup endpoint
    When I provide username "bob456", display name "Bob", password "securepass123" but no email
    Then I should receive an error "Email is required"

  Scenario: User logout
    Given I am logged in with a JWT token
    When I logout
    Then my JWT token should be invalidated
    And I should need to login again to access protected resources

  Scenario: Password reset with email verification
    Given I have an account with email "alice@example.com"
    When I request a password reset for "alice@example.com"
    Then I should receive a verification email
    And the email should contain a secure reset link
    When I click the reset link and provide a new password
    Then my password should be updated
    And I should be able to login with the new password

  Scenario: Get current user
    Given I am logged in as "alice123"
    When I request my profile information
    Then I should see my display name "Alice"
    And I should see my conversation count
    And I should see my email "alice@example.com"
    And I should NOT see my password