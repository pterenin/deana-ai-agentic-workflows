import { DateTime } from 'luxon';

// Helper function to get current date context in a specific IANA timezone
// If clientNowISO is provided, we anchor calculations to the client-reported time.
export function getCurrentDateContext(
  userTimeZone?: string,
  clientNowISO?: string
) {
  const tz = userTimeZone || 'America/Los_Angeles';
  let now = clientNowISO
    ? DateTime.fromISO(clientNowISO, { zone: tz })
    : DateTime.now().setZone(tz);
  if (!now.isValid) {
    now = DateTime.now().setZone(tz);
  }

  const tomorrow = now.plus({ days: 1 });
  const yesterday = now.minus({ days: 1 });

  // Next Sunday relative to "now" in the user's timezone
  const weekday = now.weekday; // 1 (Mon) - 7 (Sun)
  const daysUntilNextSunday = weekday === 7 ? 7 : 7 - weekday;
  const nextWeekEnd = now.plus({ days: daysUntilNextSunday }).startOf('day');

  const todayStr = now.toFormat('yyyy-LL-dd');
  const tomorrowStr = tomorrow.toFormat('yyyy-LL-dd');
  const yesterdayStr = yesterday.toFormat('yyyy-LL-dd');
  const nextWeekEndStr = nextWeekEnd.toFormat('yyyy-LL-dd');

  console.log(
    `[Date Context] tz=${tz} now=${now.toISO()} → today=${todayStr} tomorrow=${tomorrowStr} yesterday=${yesterdayStr} nextWeekEnd=${nextWeekEndStr}`
  );

  return {
    today: todayStr,
    tomorrow: tomorrowStr,
    yesterday: yesterdayStr,
    nextWeekEnd: nextWeekEndStr,
    currentTime: now.toISO(),
  };
}
