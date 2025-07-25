// Test AI's intelligent calendar selection
// Run with: node test-intelligent-calendar.js

async function testIntelligentSelection() {
  console.log('🧠 Testing AI Intelligent Calendar Selection\n');

  // Import fetch for ES modules
  const fetch = await import('node-fetch').then((module) => module.default);

  const testAccounts = {
    primary_account: {
      email: 'user@personal.com',
      title: 'Personal',
      creds: {
        access_token: 'test_token',
        refresh_token: 'test',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        client_id: 'test',
      },
    },
    secondary_account: {
      email: 'user@work.com',
      title: 'Work',
      creds: {
        access_token: 'test_token',
        refresh_token: 'test',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        client_id: 'test',
      },
    },
  };

  const testCases = [
    {
      query: 'How does my day look like?',
      expectedBehavior: 'Should CHECK BOTH calendars (AI omits calendarId)',
      expectedLog: 'AI omitted calendarId - checking both calendars',
    },
    {
      query: 'Do I have work meetings today?',
      expectedBehavior:
        "Should CHECK WORK calendar only (AI includes calendarId: 'work')",
      expectedLog: 'AI specified Work calendar',
    },
    {
      query: 'Any personal appointments this week?',
      expectedBehavior:
        "Should CHECK PERSONAL calendar only (AI includes calendarId: 'personal')",
      expectedLog: 'AI specified Personal calendar',
    },
    {
      query: 'Am I free at 3pm tomorrow?',
      expectedBehavior: 'Should CHECK BOTH calendars (need complete picture)',
      expectedLog: 'AI omitted calendarId - checking both calendars',
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n--- Test ${i + 1}: ${testCase.query} ---`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log(`Looking for log: "${testCase.expectedLog}"`);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testCase.query,
          sessionId: `intelligent_test_${i}`,
          email: 'user@example.com',
          ...testAccounts,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Request successful');
        console.log(`📝 Response: ${data.message || 'No message'}`);
        console.log(
          '🔍 Check server logs for account determination debug info'
        );
      } else {
        console.log('❌ Request failed:', response.status);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }

    // Wait between requests
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log('\n🎯 Expected Debug Logs to Look For:');
  console.log(
    '✅ "🧠 [determineTargetAccount] AI omitted calendarId - checking both calendars"'
  );
  console.log('✅ "🧠 [determineTargetAccount] AI specified Work calendar"');
  console.log(
    '✅ "🧠 [determineTargetAccount] AI specified Personal calendar"'
  );
  console.log(
    '\n🧠 The AI should now intelligently decide based on context, not keywords!'
  );
}

testIntelligentSelection().catch(console.error);
