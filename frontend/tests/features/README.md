# BDD Feature Tests

This directory contains Behavior Driven Development (BDD) test scenarios written in Gherkin syntax using Cucumber.

## Features

### Hacker News Recommendations (`hackernews-recommendations.feature`)

Tests the semantic synchronization between current conversations and Hacker News topic recommendations.

**Key Scenarios:**
- HN recommendations appear only after conversation summarization
- Topics are semantically related to conversation content
- Recommendations update when switching between conversations
- Graceful handling of service unavailability
- Privacy-aware recommendations for private conversations
- Functional topic badges with search integration

## Running BDD Tests

### Prerequisites

Make sure you have the dependencies installed:
```bash
pnpm install
```

### Run All BDD Tests
```bash
pnpm run test:bdd
```

### Run Specific Feature
```bash
pnpm run test:bdd:hn
```

### Watch Mode (reruns on file changes)
```bash
pnpm run test:bdd:watch
```

### With Custom Tags
```bash
npx cucumber-js --tags "@smoke"
npx cucumber-js --tags "not @skip"
```

## Test Structure

```
tests/
├── features/                    # Gherkin feature files
│   ├── hackernews-recommendations.feature
│   └── README.md               # This file
├── step-definitions/           # Step implementation files
│   └── hackernews-recommendations.steps.ts
└── support/                   # Test setup and utilities
    └── world.ts               # Test world and hooks
```

## Configuration

- **cucumber.config.js**: Main Cucumber configuration
- **tests/support/world.ts**: Test environment setup with Playwright
- **package.json**: NPM scripts for running tests

## Writing New Features

1. **Create Feature File**: Add `.feature` file in `tests/features/`
2. **Write Scenarios**: Use Gherkin syntax (Given, When, Then)
3. **Implement Steps**: Add step definitions in `tests/step-definitions/`
4. **Add Test Data**: Use background steps and data tables
5. **Run Tests**: Use `pnpm run test:bdd` to execute

## Best Practices

### Gherkin Writing
- Write scenarios from the user's perspective
- Use business language, not technical implementation details
- Keep scenarios focused and atomic
- Use data tables for multiple test cases
- Tag scenarios appropriately (@smoke, @integration, etc.)

### Step Definitions
- Keep steps reusable across features
- Use proper assertions with meaningful error messages
- Mock external dependencies appropriately
- Clean up test data in hooks

### Example Scenario Structure
```gherkin
Feature: Feature Name
  As a [user type]
  I want [functionality]
  So that [benefit]

  Background:
    Given common setup steps

  Scenario: Descriptive scenario name
    Given initial state
    When action performed
    Then expected outcome
```

## Debugging

### View Test Results
Test results are saved to:
- `test-results/cucumber-report.html` (HTML report)
- `test-results/cucumber-report.json` (JSON data)

### Debug Failed Tests
1. Check the HTML report for detailed failure information
2. Screenshots and videos are saved for failed tests
3. Use `--dry-run` to validate step definitions without execution
4. Add console.log statements in step definitions for debugging

### Common Issues
- **Step Definition Not Found**: Ensure step patterns match exactly
- **Element Not Found**: Check test-id attributes in components
- **Timing Issues**: Use proper waits instead of hard timeouts
- **Mock Failures**: Verify API route patterns and responses

## Integration with Existing Tests

This BDD suite complements the existing Playwright E2E tests:
- **E2E Tests**: Technical integration testing
- **BDD Tests**: Business behavior validation
- **Unit Tests**: Component-level testing

All test types can be run independently or together in CI/CD pipelines.