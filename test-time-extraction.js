// Test time extraction function
function extractNewTimeFromRequest(userRequest) {
  const requestLower = userRequest.toLowerCase();

  // Look for time patterns like "3pm", "3:30pm", "15:00", etc.
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i, // 3:30pm, 10:45am
    /(\d{1,2})\s*(am|pm)/i, // 3pm, 10am
    /(\d{1,2}):(\d{2})/i, // 15:30, 10:45
  ];

  for (const pattern of timePatterns) {
    const match = requestLower.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      // For patterns without minutes (like "3pm"), match[2] will be undefined
      const minute = match[2] !== undefined ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toLowerCase() : null;

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

// Test cases
const testCases = [
  'Reschedule meeting "hello" to 3pm',
  'move to 2:30pm',
  'change to 15:00',
  'update to 10:45am',
  'reschedule to 12pm',
  'move to 12am',
];

console.log('🧪 Testing time extraction function...\n');

for (const testCase of testCases) {
  console.log(`📝 Testing: "${testCase}"`);
  const result = extractNewTimeFromRequest(testCase);
  console.log(`   Result:`, result);
  console.log('');
}

console.log('✅ Time extraction tests completed!');
