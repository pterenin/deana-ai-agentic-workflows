import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test the exact issue: User says "today" but system checks tomorrow's date
    const testBody = {
      message: 'Please book a hair appointment today at 6pm', // Should book for TODAY (July 25th)
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
      sessionId: 'test-today-date-parsing',
    };

    console.log('🧪 [Test Today Date Parsing] Starting test...');
    console.log('');
    console.log('📋 Test Scenario:');
    console.log('👤 User Request: "book appointment TODAY at 6pm"');
    console.log('📅 Today is: July 25th, 2025');
    console.log('📅 Tomorrow is: July 26th, 2025');
    console.log('');
    console.log('🎯 Expected Behavior:');
    console.log('✅ System should check availability for 7/25/2025 (TODAY)');
    console.log('❌ NOT: 7/26/2025 (tomorrow)');
    console.log('✅ Calendar event should be created for July 25th');
    console.log('✅ Response should say "today" and match the actual date');
    console.log('');
    console.log('🔍 Debug logs to watch for:');
    console.log('✅ "[extractAppointmentDetails] Date parsing: today: true"');
    console.log('✅ "Checking calendar availability for hair on 7/25/2025"');
    console.log('❌ Should NOT see: "7/26/2025"');
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
        console.log('✅ [Test Today Date Parsing] Server response:');
        console.log(data);
        console.log('');
        console.log('🔍 CRITICAL VALIDATION:');
        console.log('1. Does log show "today: true" in date parsing? ✅/❌');
        console.log(
          '2. Does availability check use 7/25/2025 (not 7/26/2025)? ✅/❌'
        );
        console.log('3. Does AI response mention "today" correctly? ✅/❌');
        console.log('4. Is calendar event created for July 25th? ✅/❌');
        console.log('');
        console.log('🚨 FAILURE INDICATORS:');
        console.log('❌ Log shows "today: false" when user said "today"');
        console.log('❌ Availability check for 7/26/2025 instead of 7/25/2025');
        console.log('❌ Response says "today" but creates event for tomorrow');
      })
      .catch((error) => {
        console.error('❌ [Test Today Date Parsing] Error:', error);
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
