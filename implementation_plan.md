# 🚀 VectorSpace Enhanced Discovery & Presence Implementation Plan

## 📋 **Implementation Strategy with Test-First Approach**

### **Phase Structure: Test-Driven Development**
Each phase follows strict TDD principles:
1. **Write tests** based on cucumber scenarios
2. **Run tests** (they should fail initially)
3. **Implement minimum** code to pass tests
4. **Refactor** while maintaining test coverage
5. **Integration testing** between phases

---

## 🔄 **Phase 1: Enhanced Sidebar Discovery (2-3 weeks)**

### **Test Structure**
```typescript
// Frontend Tests
describe('Enhanced Sidebar Discovery', () => {
  describe('Two-Tab Interface', () => {
    it('should show Neighboring Chats and My Chats tabs')
    it('should default to Neighboring Chats tab')
    it('should maintain Neighboring Chats as default after tab switches')
  })

  describe('Neighboring Chats Content', () => {
    it('should show up to 20 semantically similar conversations')
    it('should highlight recent conversations with colored border')
    it('should order by semantic similarity score')
    it('should update when current conversation summary changes')
  })

  describe('Summary Regeneration', () => {
    it('should trigger at every 1000 token milestone')
    it('should throttle polling to max once per 15 seconds')
    it('should update neighboring chats after summary regeneration')
  })

  describe('Empty States', () => {
    it('should show explanatory text when no summary exists')
    it('should explain 1000-token threshold for summarization')
  })
})
```

```python
# Backend Tests
class TestSidebarDiscovery:
    def test_semantic_similarity_endpoint(self):
        """Test /api/conversations/{id}/similar endpoint returns up to 20 results"""
        
    def test_summary_regeneration_at_token_milestones(self):
        """Test auto-summarization at 1000, 2000, 3000+ tokens"""
        
    def test_polling_throttle_implementation(self):
        """Test 15-second throttling for neighboring chats updates"""
        
    def test_chronological_my_chats_ordering(self):
        """Test My Chats ordered by creation date (newest first)"""
```

### **Implementation Tasks**
1. **Remove Discovery Page Route** ✅ Testable: Route should return 404
2. **Create Tabbed Sidebar Component** ✅ Testable: Tab switching behavior
3. **Implement Semantic Similarity API** ✅ Testable: Vector search results
4. **Add Summary Regeneration Logic** ✅ Testable: Token counting triggers
5. **Create Polling Throttle System** ✅ Testable: Rate limiting behavior

### **Key Test Scenarios**
- **Cucumber → Jest Integration**: Each cucumber scenario becomes integration test
- **API Contract Testing**: Ensure frontend/backend API compatibility
- **Performance Testing**: Semantic search response times
- **Edge Case Testing**: Empty results, network failures, concurrent updates

---

## 👁️ **Phase 2: Basic Presence System (3-4 weeks)**

### **Test Structure**
```typescript
// WebSocket Testing
describe('Presence WebSocket Protocol', () => {
  describe('Connection Management', () => {
    it('should establish WebSocket connection on conversation join')
    it('should handle connection drops gracefully')
    it('should send presence updates within 1-second max delay')
  })

  describe('Join/Leave Events', () => {
    it('should broadcast user join to all connected clients')
    it('should detect user disconnect after 30 seconds')
    it('should update viewer counts in real-time')
  })

  describe('Multi-User Scenarios', () => {
    it('should handle 50 concurrent users correctly')
    it('should show correct author vs viewer distinction')
    it('should maintain presence state across page refreshes')
  })
})
```

```python
# Backend WebSocket Tests
class TestPresenceWebSocket:
    @pytest.mark.asyncio
    async def test_user_join_broadcast(self):
        """Test joining conversation broadcasts to all connected users"""
        
    @pytest.mark.asyncio 
    async def test_30_second_disconnect_cleanup(self):
        """Test automatic removal of inactive users after 30 seconds"""
        
    @pytest.mark.asyncio
    async def test_concurrent_user_limit(self):
        """Test 50-user capacity with overflow handling"""
        
    def test_presence_state_persistence(self):
        """Test presence state survives database queries"""
```

### **Implementation Tasks**
1. **Extend WebSocket Protocol** ✅ Testable: Message format validation
2. **Create Presence Service** ✅ Testable: State management operations
3. **Implement Join/Leave Detection** ✅ Testable: Connection lifecycle events
4. **Add Header Presence UI** ✅ Testable: Avatar rendering and updates
5. **Build Real-time Broadcasting** ✅ Testable: Multi-client message delivery

### **Testing Approach**
- **WebSocket Testing Framework**: Use `pytest-asyncio` + `websocket-client`
- **Multi-Client Simulation**: Test with multiple WebSocket connections
- **Race Condition Testing**: Concurrent join/leave scenarios
- **Network Failure Simulation**: Test disconnect recovery

---

## 📍 **Phase 3: Scroll-Based Presence (3-4 weeks)**

### **Test Structure**
```typescript
// Scroll Position Testing
describe('Scroll-Based Presence', () => {
  describe('Position Detection', () => {
    it('should detect middle message of viewport by default')
    it('should prioritize manually selected message until off-screen')
    it('should clear manual selection when message goes off-screen')
  })

  describe('Debounced Updates', () => {
    it('should wait for scroll stop before updating position')
    it('should handle rapid scroll changes without intermediate updates')
    it('should send final position after 300ms debounce delay')
  })

  describe('Avatar Movement', () => {
    it('should smoothly slide avatars between message positions')
    it('should handle stacking when multiple users read same message')
    it('should show half-overlap when 4+ avatars present')
    it('should display "+N more" when 5+ users on same message')
  })
})
```

```python
# Scroll Position Backend Tests
class TestScrollPositionTracking:
    def test_viewport_middle_message_calculation(self):
        """Test algorithm for determining middle message of viewport"""
        
    def test_manual_selection_precedence(self):
        """Test manual selection overrides scroll position until off-screen"""
        
    def test_debounce_timing_accuracy(self):
        """Test 300ms debounce delay implementation"""
        
    def test_avatar_stacking_algorithm(self):
        """Test avatar stacking with half-overlap for 4+ users"""
```

### **Implementation Tasks**
1. **Viewport Position Calculation** ✅ Testable: Message-to-viewport mapping
2. **Debounced Scroll Handler** ✅ Testable: Timing behavior verification
3. **Manual Selection Logic** ✅ Testable: Precedence rules
4. **Avatar Animation System** ✅ Testable: CSS animation triggers
5. **Stacking Algorithm** ✅ Testable: Avatar positioning calculations

### **Complex Testing Scenarios**
- **Scroll Performance Testing**: Measure update frequency under rapid scrolling
- **Cross-Browser Testing**: Ensure scroll detection works across browsers
- **Mobile Touch Testing**: Verify touch scroll behavior
- **Animation Testing**: Test smooth avatar movement timing

---

## 🎭 **Phase 4: Presence States & Mobile (2-3 weeks)**

### **Test Structure**
```typescript
// State Management Testing
describe('Presence States', () => {
  describe('State Transitions', () => {
    it('should transition to idle after 30 seconds of inactivity')
    it('should instantly return to active on any user interaction')
    it('should show pulsing animation during typing')
  })

  describe('Activity Detection', () => {
    it('should detect scroll, click, type, and navigation activities')
    it('should reset idle timer on any detected activity')
    it('should use instant transitions without animations')
  })
})

describe('Mobile Experience', () => {
  describe('Responsive Design', () => {
    it('should use 20px avatars on mobile vs 24px desktop')
    it('should support tap-to-select messages')
    it('should expand header vertically for presence info')
  })

  describe('Mobile Sidebar', () => {
    it('should take full width when expanded on mobile')
    it('should show same presence data as desktop')
    it('should use 1.5em avatars in mobile sidebar')
  })
})
```

### **Implementation Tasks**
1. **Activity Detection System** ✅ Testable: Event listener verification
2. **State Transition Logic** ✅ Testable: Timer-based state changes
3. **Typing Indicator Animation** ✅ Testable: CSS animation triggers
4. **Mobile Responsive Design** ✅ Testable: Breakpoint behavior
5. **Mobile Sidebar Implementation** ✅ Testable: Full-width sheet behavior

---

## ⚡ **Phase 5: Performance & Integration (2-3 weeks)**

### **Test Structure**
```typescript
// Performance Testing
describe('Performance & Scalability', () => {
  describe('Throttling & Debouncing', () => {
    it('should throttle scroll events to 100ms maximum')
    it('should batch multiple updates for performance')
    it('should handle graceful degradation under load')
  })

  describe('Capacity Management', () => {
    it('should deny entry when at capacity')
    it('should allow simultaneous joins without hard limits')
    it('should dynamically reduce capacity under performance stress')
  })
})

// Integration Testing
describe('Full System Integration', () => {
  it('should maintain presence during sidebar navigation')
  it('should sync presence between header, messages, and sidebar')
  it('should handle user journey from discovery to conversation')
})
```

```python
# Load Testing
class TestPerformanceScaling:
    def test_50_concurrent_users_performance(self):
        """Test system performance with 50 concurrent users"""
        
    def test_dynamic_capacity_reduction(self):
        """Test automatic capacity reduction under load"""
        
    def test_websocket_message_throughput(self):
        """Test WebSocket message handling under high frequency"""
```

---

## 🧪 **Testing Infrastructure**

### **Frontend Testing Stack**
```typescript
// Testing Tools
- Jest: Unit testing
- React Testing Library: Component testing  
- Cypress: E2E testing
- WebSocket Mock: WebSocket testing
- MSW: API mocking

// Test Structure
tests/
├── unit/              # Component unit tests
├── integration/       # API integration tests
├── e2e/              # End-to-end scenarios
├── performance/       # Performance benchmarks
└── cucumber/         # Cucumber scenario implementations
```

### **Backend Testing Stack**
```python
# Testing Tools
- pytest: Test framework
- pytest-asyncio: Async testing
- websocket-client: WebSocket testing
- factory-boy: Test data factories
- freezegun: Time mocking for debounce testing

# Test Structure
tests/
├── unit/             # Service unit tests
├── integration/      # API integration tests
├── websocket/        # WebSocket protocol tests
├── performance/      # Load testing
└── cucumber/         # Cucumber step implementations
```

### **Continuous Testing Strategy**
```yaml
# CI/CD Pipeline Testing
stages:
  - unit_tests:        # Fast feedback (< 2 minutes)
  - integration_tests: # API contract verification (< 5 minutes)  
  - e2e_tests:         # Full user journey testing (< 10 minutes)
  - performance_tests: # Load testing (< 15 minutes)
  - cucumber_tests:    # Acceptance criteria verification
```

---

## 📊 **Test Coverage & Metrics**

### **Coverage Targets**
- **Unit Tests**: 95% code coverage
- **Integration Tests**: 100% API endpoint coverage
- **E2E Tests**: 100% cucumber scenario coverage
- **Performance Tests**: All scalability requirements verified

### **Quality Gates**
```typescript
// Automated Quality Checks
const qualityGates = {
  testCoverage: '>= 95%',
  websocketResponseTime: '< 100ms',
  scrollUpdateLatency: '< 1000ms',
  sidebarUpdateFrequency: '<= 5 seconds',
  concurrentUserSupport: '>= 50 users',
  mobilePerformance: 'parity with desktop'
}
```

### **Testing Pyramid**
```
    🔺 E2E Tests (20%)
       - Full user journeys
       - Cucumber scenarios
       
   🔺🔺 Integration Tests (30%) 
       - API contracts
       - WebSocket protocols
       
🔺🔺🔺🔺 Unit Tests (50%)
       - Component behavior  
       - Service logic
       - State management
```

---

## 🎯 **Implementation Success Criteria**

### **Testability Requirements**
1. **Every cucumber scenario** has corresponding automated test
2. **All WebSocket interactions** are unit testable
3. **Performance benchmarks** are continuously monitored
4. **Cross-browser compatibility** is automatically verified
5. **Mobile experience** matches desktop functionality

### **Deliverables per Phase**
- ✅ **Working feature** implementation
- ✅ **Comprehensive test suite** with high coverage
- ✅ **Performance benchmarks** meeting requirements  
- ✅ **Documentation** for future maintenance
- ✅ **Cucumber scenario** verification

---

## 📋 **Development Workflow**

### **Daily Development Cycle**
1. **Morning**: Review cucumber scenarios for current sprint
2. **Write Tests**: Create failing tests based on acceptance criteria
3. **Implement**: Write minimum code to pass tests
4. **Refactor**: Improve code while maintaining test coverage
5. **Integration**: Ensure new code works with existing features
6. **Documentation**: Update technical docs and API specs

### **Weekly Milestones**
- **Week 1**: Core infrastructure and basic test framework
- **Week 2**: Feature implementation with passing unit tests
- **Week 3**: Integration testing and performance optimization
- **Week 4**: E2E testing and cucumber scenario verification

### **Quality Assurance Process**
- **Pre-commit**: Automated linting, type checking, unit tests
- **Pull Request**: Code review, integration tests, performance checks
- **Staging Deploy**: Full E2E test suite, cucumber scenario validation
- **Production Deploy**: Monitoring, rollback procedures, health checks

---

## 🔧 **Technical Architecture Decisions**

### **WebSocket Protocol Design**
```typescript
// Presence Message Protocol
interface PresenceMessage {
  type: 'join' | 'leave' | 'scroll' | 'typing' | 'idle' | 'active'
  userId: string
  conversationId: string
  timestamp: number
  data?: {
    scrollPosition?: number
    messageIndex?: number
    viewportData?: ViewportInfo
  }
}
```

### **Database Schema Changes**
```sql
-- Presence tracking table
CREATE TABLE presence_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  conversation_id INTEGER REFERENCES conversations(id),
  current_message_index INTEGER,
  state VARCHAR(20) DEFAULT 'active',
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversation summary versioning
ALTER TABLE conversations 
ADD COLUMN summary_version INTEGER DEFAULT 1,
ADD COLUMN last_summarized_at TIMESTAMP;
```

### **Performance Optimization Strategy**
- **Frontend**: Debounced scroll events, throttled WebSocket updates
- **Backend**: Connection pooling, message batching, Redis for presence state
- **Database**: Indexed presence queries, cached similarity calculations
- **Network**: WebSocket compression, CDN for static assets

This test-first approach ensures every feature is robust, maintainable, and meets the exact specifications defined in our cucumber scenarios.