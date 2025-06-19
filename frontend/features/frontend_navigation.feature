@e2e @navigation
Feature: Frontend Navigation and UI Elements
  Basic navigation and UI element testing without API dependencies

  Background:
    Given the backend and frontend servers are running
    And the test database is clean

  @critical @ui
  Scenario: Basic Application Navigation
    Given I open the VectorSpace application
    When I navigate to the register page
    Then I should see the registration form
    When I navigate to the login page
    Then I should see the login form
    When I navigate back to home
    Then I should see the welcome message

  @critical @forms
  Scenario: Form Field Validation
    Given I open the VectorSpace application
    When I navigate to the register page
    And I fill in the username field with "testuser123"
    And I fill in the display name field with "Test User"
    And I fill in the email field with "test@example.com"
    Then the form fields should contain the entered values