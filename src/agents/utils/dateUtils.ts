// Helper function to get current date context
export function getCurrentDateContext() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Calculate next week end (Sunday of next week)
  const nextWeekEnd = new Date(now);
  const daysUntilNextSunday = (7 - nextWeekEnd.getDay()) % 7;
  if (daysUntilNextSunday === 0) {
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7); // If today is Sunday, go to next Sunday
  } else {
    nextWeekEnd.setDate(nextWeekEnd.getDate() + daysUntilNextSunday);
  }

  // Use local time instead of UTC to avoid timezone issues
  const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  const yesterdayStr = yesterday.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  const nextWeekEndStr = nextWeekEnd.toLocaleDateString('en-CA'); // YYYY-MM-DD format

  console.log(
    `[Date Context] Current date: ${todayStr}, Tomorrow: ${tomorrowStr}, Yesterday: ${yesterdayStr}, Next Week End: ${nextWeekEndStr}`
  );

  return {
    today: todayStr,
    tomorrow: tomorrowStr,
    yesterday: yesterdayStr,
    nextWeekEnd: nextWeekEndStr,
    currentTime: now.toISOString(),
  };
}
