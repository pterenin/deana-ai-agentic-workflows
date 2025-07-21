// Test script to simulate the real deletion workflow
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

// Simulate the workflow: get events first, then delete
async function testDeletionWorkflow() {
  console.log(
    '\n🧪 Testing deletion workflow (get events first, then delete)...'
  );

  try {
    // Step 1: Get events for yesterday to find "meeting with Vlada"
    console.log('\n📅 Step 1: Getting events for yesterday...');
    const eventsResult = await calendarHandlers.getEvents(
      {
        timeMin: '2025-07-19T00:00:00-07:00',
        timeMax: '2025-07-19T23:59:59-07:00',
        calendarId: 'tps8327@gmail.com',
      },
      mockCreds,
      mockProgress
    );

    console.log('✅ Events found:', eventsResult);

    // Step 2: Find the "meeting with Vlada" event
    console.log('\n🔍 Step 2: Looking for "meeting with Vlada"...');
    const events = eventsResult.events || eventsResult;
    const vladaMeeting = events.find(
      (event) => event.summary && event.summary.toLowerCase().includes('vlada')
    );

    if (vladaMeeting) {
      console.log('✅ Found Vlada meeting:', vladaMeeting);

      // Step 3: Delete the event
      console.log('\n🗑️ Step 3: Deleting the Vlada meeting...');
      const deleteResult = await calendarHandlers.deleteEvent(
        {
          eventId: vladaMeeting.id,
          calendarId: 'tps8327@gmail.com',
        },
        mockCreds,
        mockProgress
      );

      console.log('✅ Delete result:', deleteResult);
    } else {
      console.log('❌ No Vlada meeting found in events');
    }
  } catch (error) {
    console.log('❌ Workflow error:', error.message);
  }
}

// Test with mock events data
async function testWithMockData() {
  console.log('\n🧪 Testing with mock events data...');

  // Mock events data similar to what the user has
  const mockEvents = [
    {
      id: '6nfg7f9cfrplf5u5bko7s49nn9',
      summary: 'Test',
      start: { dateTime: '2025-07-20T15:00:00-07:00' },
      end: { dateTime: '2025-07-20T16:00:00-07:00' },
    },
    {
      id: 'rm1pc16ebuh6m3if0d77uea3e0',
      summary: 'test33',
      start: { dateTime: '2025-07-20T17:00:00-07:00' },
      end: { dateTime: '2025-07-20T18:00:00-07:00' },
    },
    {
      id: 'vlada_meeting_id_123',
      summary: 'meeting with Vlada',
      start: { dateTime: '2025-07-19T14:00:00-07:00' },
      end: { dateTime: '2025-07-19T15:00:00-07:00' },
    },
  ];

  console.log('📅 Mock events:', mockEvents);

  // Find Vlada meeting
  const vladaMeeting = mockEvents.find(
    (event) => event.summary && event.summary.toLowerCase().includes('vlada')
  );

  if (vladaMeeting) {
    console.log('✅ Found Vlada meeting:', vladaMeeting);
    console.log('🎯 Would delete with eventId:', vladaMeeting.id);
  } else {
    console.log('❌ No Vlada meeting found');
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting real deletion workflow tests...\n');

  await testDeletionWorkflow();
  await testWithMockData();

  console.log('\n✅ All deletion workflow tests completed!');
}

runTests().catch(console.error);
