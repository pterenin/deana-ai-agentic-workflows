// Test script to verify broader time range search functionality
const { getCurrentDateContext } = require('./src/agents/utils/dateUtils');
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

// Test the broader time range search
async function testBroaderTimeRangeSearch() {
  console.log('\n🧪 Testing broader time range search...');

  try {
    // Get current date context
    const dateContext = getCurrentDateContext();
    console.log('📅 Date context:', dateContext);

    // Test 1: Search for "Test" meeting with broader time range
    console.log('\n📝 Test 1: Search for "Test" meeting (no time specified)');
    const result1 = await calendarHandlers.getEvents(
      {
        timeMin: `${dateContext.today}T00:00:00-07:00`,
        timeMax: `${dateContext.nextWeekEnd}T23:59:59-07:00`,
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );

    console.log('✅ Broader search result:', result1);

    // Test 2: Search for specific day (today)
    console.log('\n📝 Test 2: Search for today only');
    const result2 = await calendarHandlers.getEvents(
      {
        timeMin: `${dateContext.today}T00:00:00-07:00`,
        timeMax: `${dateContext.today}T23:59:59-07:00`,
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );

    console.log('✅ Today search result:', result2);

    // Test 3: Search for tomorrow
    console.log('\n📝 Test 3: Search for tomorrow only');
    const result3 = await calendarHandlers.getEvents(
      {
        timeMin: `${dateContext.tomorrow}T00:00:00-07:00`,
        timeMax: `${dateContext.tomorrow}T23:59:59-07:00`,
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );

    console.log('✅ Tomorrow search result:', result3);
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
}

// Test date context calculation
function testDateContext() {
  console.log('\n🧪 Testing date context calculation...');

  const dateContext = getCurrentDateContext();

  console.log('📅 Full date context:', dateContext);

  // Calculate the time ranges
  const broaderRange = {
    timeMin: `${dateContext.today}T00:00:00-07:00`,
    timeMax: `${dateContext.nextWeekEnd}T23:59:59-07:00`,
  };

  const todayRange = {
    timeMin: `${dateContext.today}T00:00:00-07:00`,
    timeMax: `${dateContext.today}T23:59:59-07:00`,
  };

  const tomorrowRange = {
    timeMin: `${dateContext.tomorrow}T00:00:00-07:00`,
    timeMax: `${dateContext.tomorrow}T23:59:59-07:00`,
  };

  console.log('🔍 Broader range (no time specified):', broaderRange);
  console.log('🔍 Today range:', todayRange);
  console.log('🔍 Tomorrow range:', tomorrowRange);

  // Calculate the difference in days
  const today = new Date(dateContext.today);
  const nextWeekEnd = new Date(dateContext.nextWeekEnd);
  const daysDifference = Math.ceil(
    (nextWeekEnd - today) / (1000 * 60 * 60 * 24)
  );

  console.log(
    `📊 Broader search covers ${daysDifference} days (from today to next Sunday)`
  );
}

// Run tests
async function runTests() {
  console.log('🚀 Starting broader time range search tests...\n');

  testDateContext();
  await testBroaderTimeRangeSearch();

  console.log('\n✅ All broader time range search tests completed!');
}

runTests().catch(console.error);
