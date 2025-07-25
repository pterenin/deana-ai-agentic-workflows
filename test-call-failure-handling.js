import('node-fetch')
  .then((module) => {
    const fetch = module.default;

    // Test call failure handling:
    // When phone call fails (no answer, disconnected, no summary), should not create calendar event
    // and should inform user about the problem
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
      sessionId: 'test-call-failure-handling',
    };

    console.log('🧪 [Test Call Failure Handling] Starting test...');
    console.log('');
    console.log('📋 Test Scenario:');
    console.log('👤 User Request: "Book a hair appointment today at 6pm"');
    console.log(
      '📞 Phone Call: Fails (no answer, disconnected, or no meaningful response)'
    );
    console.log('');
    console.log('🎯 Expected Behavior:');
    console.log('✅ System detects call failure');
    console.log('✅ NO calendar event is created');
    console.log('✅ AI informs user about the problem');
    console.log('✅ Error message includes phone number');
    console.log('✅ Clear explanation of what went wrong');
    console.log('');
    console.log('🔍 Call Failure Scenarios to Test:');
    console.log('1. Call status ≠ "ended"');
    console.log('2. Call endedReason: "no-answer", "busy", "failed"');
    console.log('3. Customer ended call too early (short transcript)');
    console.log('4. No transcript or very short transcript');
    console.log('5. No summary provided');
    console.log('6. Business says "sorry, we\'re closed" or similar');
    console.log('');
    console.log('✅ SUCCESS INDICATORS:');
    console.log('- NO calendar event created');
    console.log(
      '- Error message: "There was a problem booking the appointment"'
    );
    console.log(
      '- Phone number mentioned: "The number +16049108101 did not answer"'
    );
    console.log('- Professional error handling without crashes');
    console.log('');
    console.log('❌ FAILURE INDICATORS:');
    console.log('- Calendar event created despite call failure');
    console.log('- No error message shown to user');
    console.log('- System crashes or throws unhandled errors');
    console.log('- Generic error without phone number');
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
        console.log('✅ [Test Call Failure Handling] Server response:');
        console.log(data);
        console.log('');
        console.log('🔍 VALIDATION CHECKLIST:');
        console.log('');
        console.log('📞 CALL VALIDATION:');
        console.log('1. Does log show call validation being performed? ✅/❌');
        console.log('2. Is call failure detected correctly? ✅/❌');
        console.log('3. Does validateCallSuccess function work? ✅/❌');
        console.log('');
        console.log('📅 CALENDAR PROTECTION:');
        console.log('4. Is calendar event creation skipped? ✅/❌');
        console.log('5. No "Creating calendar event..." message? ✅/❌');
        console.log('6. No calendar API calls made? ✅/❌');
        console.log('');
        console.log('💬 ERROR MESSAGING:');
        console.log(
          '7. Does response mention "problem booking appointment"? ✅/❌'
        );
        console.log('8. Is phone number included in error message? ✅/❌');
        console.log('9. Clear explanation of what went wrong? ✅/❌');
        console.log('10. Professional, user-friendly error message? ✅/❌');
        console.log('');
        console.log('🛡️ SYSTEM STABILITY:');
        console.log('11. No crashes or unhandled errors? ✅/❌');
        console.log('12. Graceful error handling throughout? ✅/❌');
        console.log('');
        console.log('🎯 PERFECT SUCCESS = All 12 checkboxes are ✅');
        console.log('');
        console.log('📝 Expected error message patterns:');
        console.log('   "There was a problem booking the appointment."');
        console.log(
          '   "The number +16049108101 did not answer or got disconnected."'
        );
        console.log('   OR');
        console.log(
          '   "The number +16049108101 did not answer or the call failed."'
        );
        console.log('');
        console.log('🔍 Debug logs to look for:');
        console.log(
          '   "[validateCallSuccess] Validating call: { status: ..., endedReason: ... }"'
        );
        console.log('   "[bookAppointmentAgent] Call validation failed: ..."');
        console.log('   "Failed to book appointment: ..."');
      })
      .catch((error) => {
        console.error('❌ [Test Call Failure Handling] Error:', error);
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
