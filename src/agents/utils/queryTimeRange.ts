/**
 * Utility functions to determine appropriate time ranges for different types of calendar queries
 */

export interface TimeRange {
  timeMin: string;
  timeMax: string;
  description: string;
}

/**
 * Determines the appropriate time range based on the user's query
 */
export function getTimeRangeForQuery(
  userQuery: string,
  currentDate: Date = new Date()
): TimeRange {
  const queryLower = userQuery.toLowerCase();

  // Event search queries without specific dates - use 7-day range
  const isEventSearchQuery = queryLower.match(
    /(when is|what time is|when do i have|what time do i have|remind me when|find.*meeting|locate.*meeting)/
  );

  // Daily/today queries - use today only
  const isDailyQuery = queryLower.match(
    /(today|my day|how.*day.*look|schedule.*today)/
  );

  // Weekly queries - use 7-day range
  const isWeeklyQuery = queryLower.match(
    /(this week|next.*days|week|meetings.*week)/
  );

  if (isDailyQuery && !isEventSearchQuery) {
    // Today only
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      description: 'Today only',
    };
  }

  if (isEventSearchQuery || isWeeklyQuery) {
    // 7-day range (today + next 6 days)
    const startOfToday = new Date(currentDate);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(currentDate.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
      timeMin: startOfToday.toISOString(),
      timeMax: endOfWeek.toISOString(),
      description: '7-day range (today + next 6 days)',
    };
  }

  // Default to today for other queries
  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    description: 'Default (today only)',
  };
}

/**
 * Examples of how different queries map to time ranges
 */
export const QUERY_EXAMPLES = {
  dailyQueries: [
    'How does my day look?',
    "What's my schedule today?",
    'Do I have meetings today?',
  ],
  eventSearchQueries: [
    'When is my Office meeting?',
    'What time is my client call?',
    'Remind me when is my team meeting?',
  ],
  weeklyQueries: [
    'What meetings do I have this week?',
    'Any appointments next few days?',
  ],
};
