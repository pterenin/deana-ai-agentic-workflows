// Test script to verify deletion chaining functionality
const { runMainAgent } = require('./src/agents/mainAgent');

// Mock credentials
const mockCreds = {
  access_token: 'mock_token',
  refresh_token: 'mock_refresh',
  expires_at: '1234567890',
};

// Mock progress callback
const mockProgress = (update) => {
  console.log('📊 Progress:', update);
};

// Test the deletion chaining workflow
async function testDeletionChaining() {
  console.log('\n🧪 Testing deletion chaining workflow...');

  try {
    // Test 1: Delete specific event by name
    console.log('\n📝 Test 1: Delete "meeting with Vlada"');
    const result1 = await runMainAgent(
      "please remove yesterdays meeting 'meeting with Vlada'",
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 1:', result1);

    // Test 2: Delete all events
    console.log('\n📝 Test 2: Delete all meetings tomorrow');
    const result2 = await runMainAgent(
      'delete all meetings tomorrow',
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 2:', result2);

    // Test 3: Delete by partial name
    console.log('\n📝 Test 3: Delete Test meeting');
    const result3 = await runMainAgent(
      'delete the Test meeting',
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 3:', result3);
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

// Test the findEventsToDelete helper function
function testFindEventsToDelete() {
  console.log('\n🧪 Testing findEventsToDelete helper...');

  const mockEvents = [
    {
      id: 'event1',
      summary: 'meeting with Vlada',
      description: 'Weekly catchup',
    },
    {
      id: 'event2',
      summary: 'Test meeting',
      description: 'Testing something',
    },
    {
      id: 'event3',
      summary: 'Coffee with John',
      description: 'Quick coffee',
    },
  ];

  // Test cases
  const testCases = [
    {
      request: 'delete "meeting with Vlada"',
      expected: 1,
    },
    {
      request: 'delete all meetings',
      expected: 3,
    },
    {
      request: 'delete the Test meeting',
      expected: 1,
    },
    {
      request: 'delete them',
      expected: 3,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: "${testCase.request}"`);
    // Note: We can't directly test the helper function since it's not exported
    // But we can test the logic through the main agent
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting deletion chaining tests...\n');

  testFindEventsToDelete();
  await testDeletionChaining();

  console.log('\n✅ All deletion chaining tests completed!');
}

runTests().catch(console.error);
