const fetch = require('node-fetch');

// Test accounts matching your setup
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

async function testBroadQuery() {
  console.log(
    '🔍 Testing: "How does my day look like?" - Should check BOTH calendars'
  );

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How does my day look like?',
        sessionId: 'test_broad_query',
        email: 'user@example.com',
        ...testAccounts,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Response received:');
      console.log('📝 Message:', data.message);

      // Check if response mentions both calendars
      const message = data.message || '';
      const mentionsPersonal = message.toLowerCase().includes('personal');
      const mentionsWork = message.toLowerCase().includes('work');

      console.log('\n📊 Multi-account analysis:');
      console.log(
        '- Mentions Personal calendar:',
        mentionsPersonal ? '✅' : '❌'
      );
      console.log('- Mentions Work calendar:', mentionsWork ? '✅' : '❌');

      if (mentionsPersonal && mentionsWork) {
        console.log('🎉 SUCCESS: Response includes both calendars!');
      } else if (mentionsPersonal || mentionsWork) {
        console.log('⚠️  PARTIAL: Only mentions one calendar');
      } else {
        console.log("❌ ISSUE: Doesn't mention calendar breakdown");
      }
    } else {
      console.log('❌ Request failed:', response.status);
      const errorText = await response.text();
      console.log('Error:', errorText);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testStreamingBroadQuery() {
  console.log(
    '\n📡 Testing streaming: "How does my day look?" - Should check BOTH calendars'
  );

  try {
    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How does my day look?',
        sessionId: 'test_streaming_broad',
        email: 'user@example.com',
        ...testAccounts,
      }),
    });

    if (response.ok) {
      console.log('✅ Streaming request sent');
      console.log(
        '🔄 Expected behavior: Should show progress for checking both Personal and Work calendars'
      );
      console.log(
        '📺 Check your browser or server logs for the full streaming response'
      );
    } else {
      console.log('❌ Streaming failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Streaming error:', error.message);
  }
}

async function runFocusedTest() {
  console.log('🎯 FOCUSED TEST: Multi-Account Calendar Checking\n');
  console.log(
    'Issue: "How does my day look?" should check BOTH calendars but was only checking one\n'
  );
  console.log(
    'Expected fix: AI should NOT pass calendarId parameter for broad queries\n'
  );

  console.log('Prerequisites:');
  console.log('1. Express server running on http://localhost:3000');
  console.log('2. Agent server running on http://localhost:3060');
  console.log('3. Updated agent prompt with multi-account instructions\n');

  // Test the exact query from the user
  await testBroadQuery();

  // Test streaming version too
  await testStreamingBroadQuery();

  console.log('\n🔧 If still not working, check:');
  console.log('- Agent is calling getEvents WITHOUT calendarId parameter');
  console.log('- Calendar handler is detecting "both" accounts scenario');
  console.log('- Response includes breakdown of both calendars');
  console.log('- Server logs show "Checking both your calendars..." message');
}

if (require.main === module) {
  runFocusedTest().catch(console.error);
}

module.exports = { testBroadQuery, testStreamingBroadQuery, runFocusedTest };
