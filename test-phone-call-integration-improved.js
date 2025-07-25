import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test the exact scenario from the user's issue
    const testBody = {
      message: 'Please book a hair appointment today at 6pm', // User's original request
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
      sessionId: 'test-phone-integration-fixed',
    };

    console.log('🧪 [Test Improved Phone Call Integration] Starting test...');
    console.log('📞 User request:', testBody.message);
    console.log('');
    console.log('🎯 Expected AI Workflow:');
    console.log(
      '1. getRecentCallSummary() → Find call data with "8 PM with Thomas"'
    );
    console.log(
      '2. parseCallSummaryForBooking() → Extract actualTime="20:00", stylistName="Thomas"'
    );
    console.log(
      '3. createEventFromCallBooking() → Create event for 8 PM, not 6 PM'
    );
    console.log(
      '4. Explain to user that time changed from 6 PM to 8 PM due to availability'
    );
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
          '✅ [Test Improved Phone Call Integration] Server response:'
        );
        console.log(data);
        console.log('');
        console.log('🔍 What to check in the response:');
        console.log('✅ AI should call getRecentCallSummary first');
        console.log('✅ AI should parse "8 PM with Thomas" from call summary');
        console.log(
          '✅ Calendar event should be created for 8:00-9:00 PM, not 6:00-7:00 PM'
        );
        console.log(
          '✅ AI should explain: "appointment was scheduled for 8 PM rather than 6 PM"'
        );
        console.log('✅ AI should mention Thomas as the stylist');
        console.log('');
        console.log('❌ Issues to watch for:');
        console.log('❌ Creating event at wrong time (6 PM instead of 8 PM)');
        console.log('❌ Not explaining the time change');
        console.log('❌ Not using call integration workflow');
      })
      .catch((error) => {
        console.error(
          '❌ [Test Improved Phone Call Integration] Error:',
          error
        );
      });
  })
  .catch((err) => {
    console.error('Failed to import node-fetch:', err);
  });
