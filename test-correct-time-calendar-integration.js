import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test the exact issue: AI says "8:00 PM" but creates calendar event at 6:00 PM
    const testBody = {
      message: 'Please book a hair appointment today at 6pm', // User request: 6pm
      primary_account: {
        title: 'Personal',
        email: 'tps8327@gmail.com',
        creds: {
          access_token: 'valid',
          refresh_token: 'test_refresh',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          client_id: 'test_client',
        },
      },
      secondary_account: {
        title: 'Work',
        email: 'pavel.terenin@gmail.com',
        creds: {
          access_token: 'valid',
          refresh_token: 'test_refresh_work',
          expires_at: new Date(Date.now() + 3600000).toISOString(),
          client_id: 'test_client',
        },
      },
      sessionId: 'test-correct-time-integration',
    };

    console.log('🧪 [Test Correct Time Calendar Integration] Starting test...');
    console.log('');
    console.log('📋 Test Scenario:');
    console.log('👤 User Request: "book appointment today at 6pm"');
    console.log('📞 Call Summary: "appointment confirmed for 8 PM with Alex"');
    console.log('');
    console.log('🎯 Expected Behavior:');
    console.log('✅ AI Message: "Time: 8:00 PM"');
    console.log('✅ Calendar Event: 2025-07-26T20:00:00 (8:00 PM)');
    console.log('✅ NOT: 2025-07-26T18:00:00 (6:00 PM)');
    console.log('');
    console.log('🔍 Required AI Workflow:');
    console.log('1. getRecentCallSummary() → Find "8 PM with Alex"');
    console.log('2. parseCallSummaryForBooking() → Extract actualTime="20:00"');
    console.log('3. createEventFromCallBooking() → Use 20:00, not 18:00');
    console.log('4. Message and calendar MUST have same time');
    console.log('');

    // Test with streaming server
    fetch('http://localhost:3002/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testBody),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then((data) => {
        console.log(
          '✅ [Test Correct Time Calendar Integration] Server response:'
        );
        console.log(data);
        console.log('');
        console.log('🔍 CRITICAL CHECKS:');
        console.log('1. Does AI message say "8:00 PM" or "8 PM"? ✅/❌');
        console.log(
          '2. Does calendar API receive "2025-07-26T20:00:00"? ✅/❌'
        );
        console.log('3. Does AI use getRecentCallSummary workflow? ✅/❌');
        console.log('4. Does AI mention "Alex" as stylist? ✅/❌');
        console.log('5. Does AI explain time change from 6pm to 8pm? ✅/❌');
        console.log('');
        console.log('🚨 FAILURE INDICATORS:');
        console.log(
          '❌ Calendar event at 18:00 (6 PM) instead of 20:00 (8 PM)'
        );
        console.log('❌ AI message says "8 PM" but calendar shows 6 PM');
        console.log('❌ No mention of call integration workflow');
        console.log(
          '❌ AI creates event based on user request (6pm) not call data (8pm)'
        );
      })
      .catch((error) => {
        console.error(
          '❌ [Test Correct Time Calendar Integration] Error:',
          error
        );
        if (error.code === 'ECONNREFUSED') {
          console.log('');
          console.log('💡 Solution: Start the server first:');
          console.log('   npm run enhanced-server');
          console.log('   Then run this test again.');
        }
      });
  })
  .catch((err) => {
    console.error('Failed to import node-fetch:', err);
  });
