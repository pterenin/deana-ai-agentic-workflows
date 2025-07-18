// Timezone-aware date utilities
const DEFAULT_TIMEZONE = 'America/New_York';

export const getStartOfDayInTimezone = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): string => {
  // Create a date in the target timezone
  const localDate = new Date(
    date.toLocaleString('en-US', { timeZone: timezone })
  );
  localDate.setHours(0, 0, 0, 0);

  // Convert to ISO string (this will be the start of day in that timezone)
  return localDate.toISOString();
};

export const getEndOfDayInTimezone = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): string => {
  // Create a date in the target timezone
  const localDate = new Date(
    date.toLocaleString('en-US', { timeZone: timezone })
  );
  localDate.setHours(23, 59, 59, 999);

  // Convert to ISO string (this will be the end of day in that timezone)
  return localDate.toISOString();
};

export const getTodayStart = (timezone: string = DEFAULT_TIMEZONE): string => {
  return getStartOfDayInTimezone(new Date(), timezone);
};

export const getTodayEnd = (timezone: string = DEFAULT_TIMEZONE): string => {
  return getEndOfDayInTimezone(new Date(), timezone);
};

export const getTomorrowStart = (
  timezone: string = DEFAULT_TIMEZONE
): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getStartOfDayInTimezone(tomorrow, timezone);
};

export const getTomorrowEnd = (timezone: string = DEFAULT_TIMEZONE): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getEndOfDayInTimezone(tomorrow, timezone);
};

export const getDateRangeForDay = (
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): { start: string; end: string } => {
  return {
    start: getStartOfDayInTimezone(date, timezone),
    end: getEndOfDayInTimezone(date, timezone),
  };
};
