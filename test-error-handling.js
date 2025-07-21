// Test script to verify error handling improvements
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

// Test invalid event ID deletion
async function testInvalidEventDeletion() {
  console.log('\n🧪 Testing invalid event ID deletion...');

  try {
    const result = await calendarHandlers.deleteEvent(
      { eventId: 'test', calendarId: 'test@example.com' },
      mockCreds,
      mockProgress
    );
    console.log('❌ Should have thrown error, got:', result);
  } catch (error) {
    console.log('✅ Correctly caught error:', error.message);
  }
}

// Test missing event ID deletion
async function testMissingEventId() {
  console.log('\n🧪 Testing missing event ID deletion...');

  try {
    const result = await calendarHandlers.deleteEvent(
      { calendarId: 'test@example.com' },
      mockCreds,
      mockProgress
    );
    console.log('❌ Should have thrown error, got:', result);
  } catch (error) {
    console.log('✅ Correctly caught error:', error.message);
  }
}

// Test short event ID deletion
async function testShortEventId() {
  console.log('\n🧪 Testing short event ID deletion...');

  try {
    const result = await calendarHandlers.deleteEvent(
      { eventId: 'ab', calendarId: 'test@example.com' },
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
  console.log('🚀 Starting error handling tests...\n');

  await testInvalidEventDeletion();
  await testMissingEventId();
  await testShortEventId();

  console.log('\n✅ All error handling tests completed!');
}

runTests().catch(console.error);
