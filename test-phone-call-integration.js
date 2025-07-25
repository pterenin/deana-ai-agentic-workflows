import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test call summary (similar to the actual data provided)
    const callSummary = `The AI successfully booked Pavel's hair appointment at Tomi Gun Barber Shop for July 26, 2025. Initially aiming for 18:00-19:00, the AI adjusted the time to 15:00 after checking Pavel's availability and confirming Tom the stylist was available. The call concluded with the appointment confirmed and a reminder to be sent.`;

    const testBody = {
      message: 'Please book a hair appointment today at 6pm', // Original user request
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
      sessionId: 'test-phone-integration-session',
      // Simulate call summary being available
      callSummary: callSummary,
    };

    console.log('🧪 [Test Phone Call Integration] Starting test...');
    console.log('📞 User request:', testBody.message);
    console.log('📋 Call summary available:', testBody.callSummary);
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
        console.log('✅ [Test Phone Call Integration] Server response:');
        console.log(data);
        console.log('');
        console.log('🎯 Expected behavior:');
        console.log(
          '1. AI should detect call summary contains actual booking details'
        );
        console.log(
          '2. AI should parse: July 26, 2025 at 15:00 with Tom at Tomi Gun Barber Shop'
        );
        console.log(
          "3. AI should create calendar event with ACTUAL details, not user's original request"
        );
        console.log(
          '4. AI should explain difference between requested (today 6pm) vs actual (July 26 3pm)'
        );
      })
      .catch((error) => {
        console.error('❌ [Test Phone Call Integration] Error:', error);
      });
  })
  .catch((err) => {
    console.error('Failed to import node-fetch:', err);
  });
