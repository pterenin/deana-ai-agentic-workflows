// Debug time extraction function
function extractNewTimeFromRequest(userRequest) {
  const requestLower = userRequest.toLowerCase();

  // Look for time patterns like "3pm", "3:30pm", "15:00", etc.
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i, // 3:30pm, 10:45am
    /(\d{1,2})\s*(am|pm)/i, // 3pm, 10am
    /(\d{1,2}):(\d{2})/i, // 15:30, 10:45
  ];

  for (let i = 0; i < timePatterns.length; i++) {
    const pattern = timePatterns[i];
    const match = requestLower.match(pattern);
    console.log(`Pattern ${i}:`, pattern.source);
    console.log(`Match for "${userRequest}":`, match);

    if (match) {
      let hour = parseInt(match[1]);
      // For patterns without minutes (like "3pm"), match[2] will be undefined
      const minute = match[2] !== undefined ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toLowerCase() : null;

      console.log(
        `Parsed values: hour=${hour}, minute=${minute}, period=${period}`
      );

      // Convert 12-hour to 24-hour format
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;

      const timeString = `${hour}:${minute.toString().padStart(2, '0')}`;

      console.log('[extractNewTimeFromRequest] Found time:', {
        time: timeString,
        hour,
        minute,
      });
      return { time: timeString, hour, minute };
    }
  }

  console.log('[extractNewTimeFromRequest] No time found in request');
  return null;
}

// Test the exact case that's failing
console.log(
  '🧪 Testing time extraction for "Reschedule meeting \\"hello\\" to 3pm"...\n'
);

const result = extractNewTimeFromRequest('Reschedule meeting "hello" to 3pm');
console.log('\n📋 Final result:', result);

// Test a few more cases
console.log('\n🧪 Testing other cases...\n');

const testCases = ['to 3pm', 'to 2:30pm', 'to 15:00', 'to 10:45am'];

for (const testCase of testCases) {
  console.log(`📝 Testing: "${testCase}"`);
  const result = extractNewTimeFromRequest(testCase);
  console.log(`   Result:`, result);
  console.log('');
}
