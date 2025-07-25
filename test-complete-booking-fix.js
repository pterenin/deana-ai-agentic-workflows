import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test both issues:
    // 1. Date parsing: "today" should be July 25th, NOT July 26th
    // 2. Time parsing: Should use actual confirmed time (8pm) from call, NOT original request time (6pm)
    const testBody = {
      message: 'Book a hair appointment today at 6pm',
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
      sessionId: 'test-complete-booking-fix',
    };

    console.log(
      '🧪 [Test Complete Booking Fix] Starting comprehensive test...'
    );
    console.log('');
    console.log('📋 Test Scenario:');
    console.log('👤 User Request: "Book a hair appointment TODAY at 6pm"');
    console.log(
      '📞 Phone Call: Business confirms appointment at 8 PM (not 6 PM)'
    );
    console.log('📅 Today is: July 25th, 2025');
    console.log('📅 Tomorrow is: July 26th, 2025');
    console.log('');
    console.log('🎯 Expected Behavior:');
    console.log('');
    console.log('📅 DATE PARSING:');
    console.log('✅ System should check availability for 7/25/2025 (TODAY)');
    console.log('❌ NOT: 7/26/2025 (tomorrow)');
    console.log('✅ Debug log: "today: true, tomorrow: false"');
    console.log('');
    console.log('⏰ TIME PARSING:');
    console.log('✅ Original request: 6 PM (18:00)');
    console.log('✅ Phone call confirms: 8 PM (20:00)');
    console.log(
      '✅ Calendar event should be created at: 8 PM (20:00), NOT 6 PM'
    );
    console.log('✅ AI message should say: "8 PM"');
    console.log('✅ Debug log: "Actual confirmed time from transcript: 20:00"');
    console.log('');
    console.log('🔍 Critical Debug Logs to Watch For:');
    console.log(
      '1. Date parsing: "[extractAppointmentDetails] Date parsing: today: true"'
    );
    console.log(
      '2. Availability check: "Checking for hair on 7/25/2025" (not 7/26)'
    );
    console.log('3. Time parsing: "Original requested time: 18:00"');
    console.log(
      '4. Time parsing: "Actual confirmed time from transcript: 20:00"'
    );
    console.log(
      '5. Calendar creation: "start: 2025-07-25T20:00:00" (8 PM, not 6 PM)'
    );
    console.log('');
    console.log('❌ FAILURE INDICATORS:');
    console.log('- Availability check for 7/26/2025 (tomorrow)');
    console.log('- Calendar event shows 18:00 instead of 20:00');
    console.log('- AI says "8 PM" but calendar shows 6 PM');
    console.log('- "today: false" when user said "today"');
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
        console.log('✅ [Test Complete Booking Fix] Server response:');
        console.log(data);
        console.log('');
        console.log('🔍 VALIDATION CHECKLIST:');
        console.log('');
        console.log('📅 DATE PARSING VALIDATION:');
        console.log('1. Does log show "today: true" in date parsing? ✅/❌');
        console.log(
          '2. Does availability check use 7/25/2025 (not 7/26/2025)? ✅/❌'
        );
        console.log('');
        console.log('⏰ TIME PARSING VALIDATION:');
        console.log('3. Does log show "Original requested time: 18:00"? ✅/❌');
        console.log(
          '4. Does log show "Actual confirmed time from transcript: 20:00"? ✅/❌'
        );
        console.log(
          '5. Does calendar event creation use T20:00:00 (8 PM)? ✅/❌'
        );
        console.log('6. Does AI response mention "8 PM" (not 6 PM)? ✅/❌');
        console.log('');
        console.log('🎯 CONSISTENCY CHECK:');
        console.log('7. AI message time matches calendar event time? ✅/❌');
        console.log('8. Both AI and calendar show July 25th (today)? ✅/❌');
        console.log(
          '9. Both AI and calendar show 8 PM (confirmed time)? ✅/❌'
        );
        console.log('');
        console.log('🚨 SUCCESS = All checkboxes are ✅');
        console.log('🚨 FAILURE = Any checkbox is ❌');
      })
      .catch((error) => {
        console.error('❌ [Test Complete Booking Fix] Error:', error);
        if (error.code === 'ECONNREFUSED') {
          console.log('');
          console.log('💡 Solution: Start the server first:');
          console.log('   npm run enhanced-server');
          console.log(
            '   (Make sure to use the enhanced server, not modern-booking-server)'
          );
          console.log('   Then run this test again.');
        }
      });
  })
  .catch((err) => {
    console.error('Failed to import node-fetch:', err);
  });
