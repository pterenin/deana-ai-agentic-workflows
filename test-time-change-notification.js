import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test time change notification:
    // User requests 6pm, call confirms 8pm, system should notify about time change
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
      sessionId: 'test-time-change-notification',
    };

    console.log('🧪 [Test Time Change Notification] Starting test...');
    console.log('');
    console.log('📋 Test Scenario:');
    console.log('👤 User Request: "Book a hair appointment today at 6pm"');
    console.log(
      '📞 Phone Call: Business confirms appointment at 8 PM (not 6 PM)'
    );
    console.log('');
    console.log('🎯 Expected Behavior:');
    console.log('✅ System creates calendar event at 8 PM (correct time)');
    console.log('✅ AI response mentions "8 PM" as the final appointment time');
    console.log(
      '✅ AI response includes notification about time change from 6 PM to 8 PM'
    );
    console.log(
      '✅ Clear acknowledgment that time was adjusted due to availability'
    );
    console.log('');
    console.log('🔍 Critical Elements to Check:');
    console.log('1. Calendar event time: 2025-07-25T20:00:00 (8 PM)');
    console.log('2. AI message mentions "8 PM" as appointment time');
    console.log('3. AI message includes time change notification');
    console.log(
      '4. Message explains reason for time adjustment (availability)'
    );
    console.log(
      '5. Original requested time (6 PM) vs actual time (8 PM) mentioned'
    );
    console.log('');
    console.log('✅ SUCCESS INDICATORS:');
    console.log('- "successfully booked for today at 8 PM"');
    console.log('- "time was adjusted from your original request"');
    console.log('- "6:00 PM to 8:00 PM"');
    console.log('- "based on availability confirmed during the call"');
    console.log('');
    console.log('❌ FAILURE INDICATORS:');
    console.log('- No mention of time change');
    console.log('- Calendar event still at 6 PM');
    console.log('- User not informed about time adjustment');
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
        console.log('✅ [Test Time Change Notification] Server response:');
        console.log(data);
        console.log('');
        console.log('🔍 VALIDATION CHECKLIST:');
        console.log('');
        console.log('⏰ TIME CONSISTENCY:');
        console.log('1. Calendar event created at T20:00:00 (8 PM)? ✅/❌');
        console.log('2. AI response says "8 PM" (not 6 PM)? ✅/❌');
        console.log('');
        console.log('📢 TIME CHANGE NOTIFICATION:');
        console.log('3. Response mentions time was "adjusted"? ✅/❌');
        console.log('4. Response mentions original request (6 PM)? ✅/❌');
        console.log('5. Response mentions actual time (8 PM)? ✅/❌');
        console.log('6. Response explains reason (availability)? ✅/❌');
        console.log('');
        console.log('💡 USER EXPERIENCE:');
        console.log('7. Clear about final appointment time? ✅/❌');
        console.log('8. User understands why time changed? ✅/❌');
        console.log('9. No confusion about actual appointment time? ✅/❌');
        console.log('');
        console.log('🎯 PERFECT SUCCESS = All 9 checkboxes are ✅');
        console.log('📝 Expected message pattern:');
        console.log(
          '   "Your hair appointment has been successfully booked for today at 8 PM with [stylist]."'
        );
        console.log(
          '   "Please note that the appointment time was adjusted from your original request"'
        );
        console.log(
          '   "of 6:00 PM to 8:00 PM based on availability confirmed during the call."'
        );
      })
      .catch((error) => {
        console.error('❌ [Test Time Change Notification] Error:', error);
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
