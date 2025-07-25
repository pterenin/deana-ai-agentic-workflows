const fetch = require('node-fetch');

// Mock account data for testing
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

// Test scenarios
const testScenarios = [
  {
    name: 'Multi-account calendar check',
    message: 'Do I have meetings today?',
    expectedBehavior: 'Should check both Personal and Work calendars',
  },
  {
    name: 'Work calendar specific check',
    message: 'Do I have meetings in my work calendar?',
    expectedBehavior: 'Should only check Work calendar',
  },
  {
    name: 'Personal calendar specific check',
    message: 'What meetings do I have in my personal calendar?',
    expectedBehavior: 'Should only check Personal calendar',
  },
  {
    name: 'Meeting creation with work account',
    message: 'Create a meeting tomorrow at 2pm in my work calendar',
    expectedBehavior:
      'Should create meeting in Work calendar using Work credentials',
  },
  {
    name: 'Meeting creation default (primary)',
    message: 'Schedule a doctor appointment for Friday at 10am',
    expectedBehavior: 'Should create meeting in Personal calendar (default)',
  },
  {
    name: 'Secondary account reference',
    message: 'Create a team meeting in my secondary calendar',
    expectedBehavior: 'Should create meeting in Work calendar (secondary)',
  },
];

async function testMultiAccount() {
  console.log('🧪 Testing Multi-Account Gmail Integration\n');

  // Test each scenario
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`\n--- Test ${i + 1}: ${scenario.name} ---`);
    console.log(`Message: "${scenario.message}"`);
    console.log(`Expected: ${scenario.expectedBehavior}`);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: scenario.message,
          sessionId: `test_session_${i}`,
          email: 'user@example.com',
          ...testAccounts,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Request successful');
        console.log(`Response: ${data.message || 'No message'}`);

        // Log account usage if available in response
        if (data.context && data.context.accounts) {
          console.log('📧 Accounts available:', {
            primary: data.context.accounts.primary.title,
            secondary: data.context.accounts.secondary?.title || 'None',
          });
        }
      } else {
        console.log('❌ Request failed:', response.status, response.statusText);
        const errorData = await response.text();
        console.log('Error details:', errorData);
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }

    // Wait between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n🏁 Multi-account testing completed!');
  console.log('\nExpected behaviors:');
  console.log('- Multi-account queries should mention both calendars');
  console.log('- Specific account queries should only use that account');
  console.log('- Default behavior should use primary account');
  console.log('- Account titles (Personal/Work) should be recognized');
}

// Test streaming endpoint as well
async function testStreamingMultiAccount() {
  console.log('\n📡 Testing Streaming Multi-Account Integration\n');

  const testMessage = 'Do I have any meetings today?';
  console.log(`Testing streaming with: "${testMessage}"`);

  try {
    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: testMessage,
        sessionId: 'streaming_test_session',
        email: 'user@example.com',
        ...testAccounts,
      }),
    });

    if (response.ok) {
      console.log('✅ Streaming request initiated');
      console.log(
        '📊 Expected: Should see progress updates for checking both calendars'
      );

      // Note: In a real test, you'd parse the SSE stream
      // For now, just indicate the test was sent
      console.log(
        '🔄 Streaming response initiated (check browser/logs for full output)'
      );
    } else {
      console.log('❌ Streaming request failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Streaming error:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Multi-Account Gmail Integration Tests\n');
  console.log('Prerequisites:');
  console.log('1. Express server running on http://localhost:3000');
  console.log('2. Agent server running on http://localhost:3060');
  console.log('3. Both servers updated with multi-account support\n');

  // Test regular endpoint
  await testMultiAccount();

  // Test streaming endpoint
  await testStreamingMultiAccount();

  console.log('\n✨ All tests completed!');
  console.log('\nNext steps:');
  console.log('- Verify responses mention correct account titles');
  console.log('- Check that multi-account queries show breakdown by calendar');
  console.log('- Confirm default behavior uses primary account');
  console.log('- Test with real Gmail credentials for full integration');
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testMultiAccount,
  testStreamingMultiAccount,
  runTests,
  testAccounts,
  testScenarios,
};
