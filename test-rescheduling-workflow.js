// Test script to verify rescheduling workflow functionality
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

// Test the rescheduling workflow
async function testReschedulingWorkflow() {
  console.log('\n🧪 Testing rescheduling workflow...');

  try {
    // Test 1: Reschedule specific event by name
    console.log('\n📝 Test 1: Reschedule "hello" meeting to 3pm');
    const result1 = await runMainAgent(
      'Reschedule meeting "hello" to 3pm',
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 1:', result1);

    // Test 2: Reschedule with different time format
    console.log('\n📝 Test 2: Move hello meeting to 2:30pm');
    const result2 = await runMainAgent(
      'Move the hello meeting to 2:30pm',
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 2:', result2);

    // Test 3: Reschedule with 24-hour format
    console.log('\n📝 Test 3: Change meeting time to 15:00');
    const result3 = await runMainAgent(
      'Change the time of my meeting to 15:00',
      mockCreds,
      undefined,
      mockProgress
    );
    console.log('✅ Result 3:', result3);
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

// Test helper functions
function testHelperFunctions() {
  console.log('\n🧪 Testing helper functions...');

  // Test time extraction
  const testCases = [
    'reschedule to 3pm',
    'move to 2:30pm',
    'change to 15:00',
    'update to 10:45am',
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 Testing time extraction: "${testCase}"`);
    // Note: We can't directly test the helper functions since they're not exported
    // But we can test the logic through the main agent
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting rescheduling workflow tests...\n');

  testHelperFunctions();
  await testReschedulingWorkflow();

  console.log('\n✅ All rescheduling workflow tests completed!');
}

runTests().catch(console.error);
