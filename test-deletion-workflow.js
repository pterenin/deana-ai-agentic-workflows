// Test script to verify deletion workflow
const { calendarHandlers } = require('./src/agents/handlers/calendarHandlers');

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

// Test single event deletion
async function testSingleEventDeletion() {
  console.log('\n🧪 Testing single event deletion...');

  try {
    const result = await calendarHandlers.deleteEvent(
      {
        eventId: '6nfg7f9cfrplf5u5bko7s49nn9',
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );
    console.log('✅ Single event deletion result:', result);
  } catch (error) {
    console.log('❌ Single event deletion error:', error.message);
  }
}

// Test multiple events deletion
async function testMultipleEventsDeletion() {
  console.log('\n🧪 Testing multiple events deletion...');

  try {
    const result = await calendarHandlers.deleteMultipleEvents(
      {
        eventIds: ['6nfg7f9cfrplf5u5bko7s49nn9', 'rm1pc16ebuh6m3if0d77uea3e0'],
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );
    console.log('✅ Multiple events deletion result:', result);
  } catch (error) {
    console.log('❌ Multiple events deletion error:', error.message);
  }
}

// Test invalid event ID deletion
async function testInvalidEventDeletion() {
  console.log('\n🧪 Testing invalid event ID deletion...');

  try {
    const result = await calendarHandlers.deleteEvent(
      {
        eventId: 'invalid_id',
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );
    console.log('❌ Should have thrown error, got:', result);
  } catch (error) {
    console.log('✅ Correctly caught error:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting deletion workflow tests...\n');

  await testSingleEventDeletion();
  await testMultipleEventsDeletion();
  await testInvalidEventDeletion();

  console.log('\n✅ All deletion workflow tests completed!');
}

runTests().catch(console.error);
