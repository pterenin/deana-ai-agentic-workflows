// Simple test to debug the multi-account issue
// Run with: node test-debug-multi-account.js

async function testQuery() {
  console.log('🧪 Testing: "How does my day look like?" with debug logging\n');

  // Import fetch using dynamic import for ES modules
  const fetch = await import('node-fetch').then((module) => module.default);

  const testAccounts = {
    primary_account: {
      email: 'user@personal.com',
      title: 'Personal',
      creds: {
        access_token: 'test_primary_token',
        refresh_token: 'test_primary_refresh',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        client_id: 'test_client_id',
      },
    },
    secondary_account: {
      email: 'user@work.com',
      title: 'Work',
      creds: {
        access_token: 'test_work_token',
        refresh_token: 'test_work_refresh',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        client_id: 'test_client_id',
      },
    },
  };

  try {
    console.log('📡 Sending request to streaming endpoint...');

    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How does my day look like?',
        sessionId: 'debug_test_session',
        email: 'user@example.com',
        ...testAccounts,
      }),
    });

    if (response.ok) {
      console.log('✅ Request sent successfully');
      console.log('🔍 Expected debug logs in server console:');
      console.log(
        '1. [getEvents] Called with args: (should NOT include calendarId)'
      );
      console.log('2. [getEvents] Context accounts available: true');
      console.log('3. [getEvents] Using multi-account handler');
      console.log(
        '4. [getEventsMultiAccount] Target account determination: both accounts'
      );
      console.log('5. Progress: "Checking both your calendars..."');
      console.log('\n📺 Check your agent server console for these debug logs');
      console.log(
        '📺 If you see "Using legacy single-account handler", the context is missing'
      );
      console.log(
        '📺 If calendarId is present in args, the AI is still passing it'
      );
    } else {
      console.log('❌ Request failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Run the test
testQuery().catch(console.error);
