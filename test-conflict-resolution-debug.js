async function testConflictResolution() {
  const fetch = (await import('node-fetch')).default;
  console.log('🧪 Testing Conflict Resolution with Debug Logging...\n');

  try {
    const response = await fetch('http://localhost:3060/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "I'd like to reschedule my work meeting to avoid the conflict",
        sessionId: 'test-conflict-debug-session',
        email: 'tps8327@gmail.com',
        primary_account: {
          title: 'Personal',
          email: 'tps8327@gmail.com',
          creds: {
            access_token: 'ya29.mock_personal_token',
            refresh_token: '1//mock_personal_refresh',
            expires_at: '1753458792785',
            client_id:
              '1026844693886-rkhvlb9d35iuu8p23pl62ckjli204r7j.apps.googleusercontent.com',
          },
        },
        secondary_account: {
          title: 'Work',
          email: 'pavel.terenin@gmail.com',
          creds: {
            access_token: 'ya29.mock_work_token',
            refresh_token: '1//mock_work_refresh',
            expires_at: '1753458792785',
            client_id:
              '1026844693886-rkhvlb9d35iuu8p23pl62ckjli204r7j.apps.googleusercontent.com',
          },
        },
      }),
    });

    if (response.ok) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log('📡 Streaming response:');
      console.log('=====================================');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                console.log(`📈 Progress: ${data.content}`);
              } else if (data.type === 'response') {
                console.log(`🤖 Response: ${data.content}`);
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }
      }
    } else {
      console.error('❌ Request failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n🔍 Check the server logs above for debug output showing:');
  console.log(
    '   🔧 [DEBUG detectConflicts] - Real conflict data with event IDs'
  );
  console.log('   🔧 [DEBUG proposeRescheduleOptions] - AI input parameters');
  console.log(
    '   🔧 [DEBUG rescheduleEvent] - Final credentials and event details'
  );
}

// Run the test
testConflictResolution();
