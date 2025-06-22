# VectorSpace Social Features Testing

This directory contains comprehensive Playwright tests that verify all social features of the VectorSpace platform, matching and exceeding the coverage provided by the Cucumber feature files.

## Test Structure

### Core Social Features Tests
- **`social-features.spec.ts`** - Basic social functionality (notifications, discovery, bookmarks)
- **`user-profiles.spec.ts`** - User profiles, follow system, profile management
- **`semantic-search.spec.ts`** - Search functionality, filters, trending topics
- **`auth-enhanced.spec.ts`** - Authentication workflows, session management, navigation
- **`saved-conversations.spec.ts`** - Saved conversations management, filtering, editing
- **`collections.spec.ts`** - Collections creation, organization, sharing

### Advanced Social Features Tests
- **`presence-system.spec.ts`** - Real-time presence, scroll tracking, multi-user interactions
- **`human-connections.spec.ts`** - Follow system, collaboration, human chat, collections
- **`multi-user-scenarios.spec.ts`** - Concurrent user testing, stress testing
- **`integration-workflows.spec.ts`** - Complete user journeys from creation to discovery
- **`performance-benchmarks.spec.ts`** - Performance testing and optimization validation

## Test Categories

### 🔴 Critical Tests (Must Pass)
```bash
pnpm run test:e2e:social      # Core social features
pnpm run test:e2e:auth        # Authentication flows
pnpm run test:e2e:profiles    # User profile functionality
```

### 🟡 High Priority Tests  
```bash
pnpm run test:e2e:search      # Search and discovery
pnpm run test:e2e:presence    # Real-time presence system
pnpm run test:e2e:connections # Human connections and follow system
```

### 🟢 Performance & Integration Tests
```bash
pnpm run test:e2e:performance # Performance benchmarks
pnpm run test:e2e:integration # End-to-end workflows
pnpm run test:e2e:multi-user  # Concurrent user scenarios
```

## Running Tests

### Quick Test Commands

```bash
# Run all social features tests
pnpm run test:e2e

# Run specific test suites
pnpm run test:e2e:social
pnpm run test:e2e:profiles
pnpm run test:e2e:search
pnpm run test:e2e:auth

# Advanced multi-user tests
pnpm run test:e2e:presence
pnpm run test:e2e:connections
pnpm run test:e2e:multi-user

# Performance and integration
pnpm run test:e2e:performance
pnpm run test:e2e:integration

# Cross-browser testing
pnpm run test:e2e:all-browsers

# Mobile testing
pnpm run test:e2e:mobile

# Debug mode (visual)
pnpm run test:e2e:headed
pnpm run test:e2e:debug
```

### Test Projects Configuration

The tests are organized into different Playwright projects for optimal execution:

- **`chromium`** - Standard social features tests
- **`chromium-multi-user`** - Multi-browser concurrent user tests
- **`chromium-performance`** - Performance and benchmark tests
- **`firefox`** - Cross-browser compatibility tests
- **`webkit`** - Safari compatibility tests  
- **`Mobile Chrome`** - Mobile responsiveness tests

## Feature Coverage Comparison

### ✅ **Full Coverage** (Playwright matches/exceeds Cucumber features)

| Feature Area | Cucumber Coverage | Playwright Coverage | Status |
|--------------|------------------|-------------------|---------|
| **Authentication** | Comprehensive | Enhanced + Navigation | ✅ Complete |
| **User Profiles** | Complete | Complete + Image Upload | ✅ Complete |
| **Search & Discovery** | Complete | Complete + Performance | ✅ Complete |
| **Real-time Presence** | Comprehensive | Multi-user + Performance | ✅ Complete |
| **Human Connections** | Complete | Complete + Collections | ✅ Complete |
| **Conversation Discovery** | Complete | Complete + Integration | ✅ Complete |
| **Curation System** | Not Covered | Complete E2E Testing | ✅ Enhanced |
| **Multi-user Interactions** | Basic | Comprehensive + Stress | ✅ Enhanced |
| **Performance Testing** | Benchmarks | Detailed Metrics | ✅ Enhanced |
| **Integration Workflows** | Round-trip | Complete Journeys | ✅ Enhanced |

### 🎯 **Enhanced Features** (Playwright provides additional coverage)

1. **Multi-browser Concurrent Testing** - Tests with 4+ simultaneous users
2. **Performance Benchmarking** - Detailed timing and memory metrics  
3. **Stress Testing** - 6+ concurrent users with failure analysis
4. **Mobile Responsiveness** - Touch interactions and viewport testing
5. **Accessibility Testing** - Keyboard navigation and screen reader support
6. **Error Resilience** - Network failures and recovery testing
7. **Browser History** - Navigation state and back/forward testing

## Test Data and Setup

### Test Users
The tests use predefined test users:
- **Alice** (`testuser` / `testpass`) - Primary test user
- **Bob** (`testuser2` / `testpass`) - Secondary user for interactions
- **Carol** (`testuser3` / `testpass`) - Third user for multi-user scenarios
- **Dave** (`testuser4` / `testpass`) - Fourth user for stress testing

### Prerequisites
- Backend server running on `http://localhost:8000`
- Frontend server running on `http://localhost:5173`
- Test database with seeded users
- Auto-login enabled (`VITE_AUTO_LOGIN=true`)

### Setup Commands
```bash
# Install Playwright browsers
pnpm exec playwright install

# Seed test database (backend)
cd ../backend && uv run python seed_database.py

# Start servers (automated by Playwright config)
# Backend: cd ../backend && uv run python main.py
# Frontend: pnpm run dev
```

## Test Implementation Details

### Multi-User Testing Strategy
- **Browser Contexts**: Each user gets isolated browser context
- **Concurrent Actions**: Parallel execution with Promise.all()
- **Presence Tracking**: Real-time scroll position and avatar testing
- **Cleanup**: Automatic context cleanup in finally blocks

### Performance Testing Metrics
- **Conversation Creation**: < 3 seconds
- **AI Response Time**: < 12 seconds  
- **Search Performance**: < 2 seconds
- **Presence Updates**: < 1 second
- **Page Load Times**: < 3 seconds
- **Memory Usage**: < 100MB

### Error Handling & Resilience
- **Network Failures**: Offline simulation and recovery
- **Timeout Handling**: Graceful degradation testing
- **Invalid Input**: Edge case and boundary testing
- **Concurrent Load**: System stability under stress

## Debugging and Troubleshooting

### Common Issues

1. **Test Timeouts**
   ```bash
   # Increase timeout for slow operations
   pnpm run test:e2e:headed  # Visual debugging
   ```

2. **Authentication Failures**
   ```bash
   # Check auto-login configuration
   cat .env | grep VITE_AUTO_LOGIN
   ```

3. **Multi-user Test Failures**
   ```bash
   # Run with fewer concurrent users
   pnpm run test:e2e:presence --workers=1
   ```

4. **Performance Test Variability**
   ```bash
   # Run performance tests in isolation
   pnpm run test:e2e:performance --project=chromium-performance
   ```

### Debug Mode
```bash
# Step-through debugging
pnpm run test:e2e:debug

# Visual test execution  
pnpm run test:e2e:headed

# Generate test report
pnpm exec playwright show-report
```

### Screenshots and Videos
- **Failure Screenshots**: Automatic capture in `test-results/`
- **Failure Videos**: Recorded for multi-user test failures
- **Debug Screenshots**: Manual capture for investigation

## Continuous Integration

### CI Test Strategy
1. **Critical Tests** - Run on every PR
2. **Full Suite** - Run on main branch
3. **Performance Tests** - Run nightly
4. **Cross-browser** - Run weekly

### Test Reports
- **HTML Report**: `playwright-report/index.html`
- **JUnit XML**: For CI integration
- **Coverage Metrics**: Performance benchmarks
- **Failure Analysis**: Screenshots and video evidence

## Contributing

### Adding New Tests
1. Follow existing test patterns and helper functions
2. Use proper test isolation and cleanup
3. Add comprehensive error handling
4. Update this README with new test descriptions

### Test Naming Convention
- **File names**: `feature-area.spec.ts`
- **Test names**: `feature description with context`
- **Helper functions**: `camelCase` with descriptive names

### Best Practices
- ✅ Use `test.describe()` for logical grouping
- ✅ Implement proper `beforeEach()` setup
- ✅ Clean up resources in `finally` blocks
- ✅ Add meaningful assertions and error messages
- ✅ Test both positive and negative scenarios
- ✅ Include performance expectations where relevant

## Coverage Metrics

**Total Test Scenarios**: 100+ test cases
**Feature Coverage**: 100% of Cucumber scenarios + enhancements
**Browser Coverage**: Chromium, Firefox, WebKit, Mobile
**Performance Benchmarks**: 9 key metrics
**Multi-user Scenarios**: Up to 6 concurrent users
**Error Conditions**: Network, timeout, invalid input testing

The Playwright test suite provides **comprehensive verification** of all VectorSpace social features with enhanced coverage beyond the original Cucumber specifications.