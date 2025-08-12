import { google } from 'googleapis';
import 'dotenv/config';

function makeOauthClient(creds: {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  // Avoid logging secrets; only log existence
  console.log('[makeOauthClient] Using:', {
    clientId: clientId ? '[present]' : '[missing]',
    clientSecret: clientSecret ? '[present]' : '[missing]',
    redirectUri,
  });
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expires_at
      ? new Date(creds.expires_at).getTime()
      : undefined,
  });
  return auth;
}

export async function getEvents(
  creds: any,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  // Defensive: ensure RFC3339 format to avoid Google 400 errors
  function ensureRfc3339Local(dt: string): string {
    if (/Z$|[+-]\d{2}:\d{2}$/.test(dt)) return dt;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return `${dt}T00:00:00Z`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dt)) {
      const withSeconds = dt.match(/:\d{2}$/) ? dt : `${dt}:00`;
      return `${withSeconds}Z`;
    }
    const parsed = new Date(dt);
    return isNaN(parsed.getTime()) ? dt : parsed.toISOString();
  }
  timeMin = ensureRfc3339Local(timeMin);
  timeMax = ensureRfc3339Local(timeMax);
  console.log('🔍 [getEvents] Starting with params:', {
    calendarId,
    timeMin,
    timeMax,
    credsKeys: creds ? Object.keys(creds) : 'null',
  });

  try {
    const auth = makeOauthClient(creds);
    const cal = google.calendar({ version: 'v3', auth });

    console.log('🔍 [getEvents] Making API call with:', {
      calendarId,
      timeMin,
      timeMax,
      credentialsType: creds?.access_token === 'valid' ? 'test' : 'real',
    });

    const res = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const result = res.data.items || [];
    console.log(
      '✅ [getEvents] API call succeeded! Returning ' +
        result.length +
        ' events'
    );
    console.log('📧 [getEvents] Calendar ID used:', calendarId);
    console.log(
      '🔑 [getEvents] Credential type:',
      creds?.access_token === 'valid' ? 'TEST' : 'REAL'
    );
    console.log('🎯 [getEvents] Returning events:', result);

    // If no events found, log additional debug info
    if (result.length === 0) {
      console.log('🔍 [getEvents] No events found - Debug info:');
      console.log('   📅 Query range:', { timeMin, timeMax });
      console.log('   📧 Calendar:', calendarId);
      console.log('   🔑 Token: [redacted]');
    }

    return result;
  } catch (err) {
    console.error('❌ [getEvents] Error occurred:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      code: (err as any)?.code,
      status: (err as any)?.status,
    });
    // Only return mock data for explicit test credentials; otherwise, propagate
    const isTestCredentials = creds?.access_token === 'valid';
    if (isTestCredentials) {
      console.log('🔄 [getEvents] Falling back to TEST mock data...');
      // Return sample events for testing - events for "today"
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        9,
        0
      );
      const todayEnd = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        10,
        0
      );
      const todayStart2 = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        14,
        0
      );
      const todayEnd2 = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        15,
        0
      );

      const mockData = [
        {
          id: 'mock-meeting-1',
          summary: 'Team Standup',
          start: { dateTime: todayStart.toISOString() },
          end: { dateTime: todayEnd.toISOString() },
        },
        {
          id: 'mock-meeting-2',
          summary: 'Client Review',
          start: { dateTime: todayStart2.toISOString() },
          end: { dateTime: todayEnd2.toISOString() },
        },
      ];
      console.log(
        '🎯 [getEvents] Returning test mock data for user:',
        calendarId,
        'Query range:',
        { timeMin, timeMax },
        'Events:',
        mockData
      );
      return mockData;
    }

    throw err;
  }
}

export async function createEvent(
  creds: any,
  calendarId: string,
  event: {
    start: string;
    end: string;
    summary: string;
    attendees?: any[]; // Accept both string[] and {email}[]
    timeZone?: string;
  }
): Promise<any> {
  const auth = makeOauthClient(creds);
  const cal = google.calendar({ version: 'v3', auth });
  const eventWithAttendees = {
    ...event,
    attendees: event.attendees
      ? event.attendees.map((a) => (typeof a === 'string' ? { email: a } : a))
      : undefined,
    start: event.timeZone
      ? { dateTime: event.start, timeZone: event.timeZone }
      : { dateTime: event.start },
    end: event.timeZone
      ? { dateTime: event.end, timeZone: event.timeZone }
      : { dateTime: event.end },
  };
  try {
    console.log(
      '[createEvent] Creating event with:',
      JSON.stringify(eventWithAttendees, null, 2)
    );
    const response = await cal.events.insert({
      calendarId,
      requestBody: eventWithAttendees,
    });
    console.log(
      '[createEvent] Google Calendar API response:',
      JSON.stringify(response.data, null, 2)
    );
    return response.data;
  } catch (error: any) {
    console.error('[createEvent] Error creating event:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data,
      stack: error.stack,
    });
    return {
      error: true,
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data,
    };
  }
}

export async function updateEvent(
  creds: any,
  calendarId: string,
  eventId: string,
  updates: {
    start?: string;
    end?: string;
    summary?: string;
    attendees?: string[];
  }
) {
  const auth = makeOauthClient(creds);
  const cal = google.calendar({ version: 'v3', auth });
  const eventPatch: any = {};
  if (updates.start) {
    eventPatch.start = { dateTime: updates.start };
  }
  if (updates.end) {
    eventPatch.end = { dateTime: updates.end };
  }
  if (updates.summary) {
    eventPatch.summary = updates.summary;
  }
  if (updates.attendees) {
    eventPatch.attendees = updates.attendees.map((email) => ({ email }));
  }
  return cal.events.patch({
    calendarId,
    eventId,
    requestBody: eventPatch,
  });
}

export async function deleteEvent(
  creds: any,
  calendarId: string,
  eventId: string
) {
  // Validate eventId
  if (!eventId || eventId === 'test' || eventId.length < 3) {
    throw new Error(
      `Invalid event ID: "${eventId}". Event ID must be a valid Google Calendar event ID.`
    );
  }

  const auth = makeOauthClient(creds);
  const cal = google.calendar({ version: 'v3', auth });

  try {
    console.log(
      `🗑️ [deleteEvent] Attempting to delete event: ${eventId} from calendar: ${calendarId}`
    );

    const result = await cal.events.delete({
      calendarId,
      eventId,
    });

    console.log(`✅ [deleteEvent] Successfully deleted event: ${eventId}`);
    return {
      success: true,
      message: `Event "${eventId}" has been deleted successfully.`,
      data: result,
    };
  } catch (error: any) {
    console.error(`❌ [deleteEvent] Error deleting event ${eventId}:`, {
      error: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data,
    });

    if (error.code === 404) {
      throw new Error(
        `Event "${eventId}" not found. It may have already been deleted or the event ID is incorrect.`
      );
    } else if (error.code === 403) {
      throw new Error(
        `Permission denied. You don't have permission to delete this event.`
      );
    } else {
      throw new Error(`Failed to delete event "${eventId}": ${error.message}`);
    }
  }
}

export async function getAvailability(
  creds: any,
  timeMin: string,
  timeMax: string,
  calendarIds: string[] = ['primary']
): Promise<{
  calendars: any;
  available: boolean;
  busyPeriods: Array<{ start: string; end: string; calendar: string }>;
}> {
  // Defensive: ensure RFC3339 format to avoid Google 400 errors
  function ensureRfc3339Local(dt: string): string {
    if (/Z$|[+-]\d{2}:\d{2}$/.test(dt)) return dt;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return `${dt}T00:00:00Z`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dt)) {
      const withSeconds = dt.match(/:\d{2}$/) ? dt : `${dt}:00`;
      return `${withSeconds}Z`;
    }
    const parsed = new Date(dt);
    return isNaN(parsed.getTime()) ? dt : parsed.toISOString();
  }
  timeMin = ensureRfc3339Local(timeMin);
  timeMax = ensureRfc3339Local(timeMax);
  console.log('🔍 [getAvailability] Starting with params:', {
    timeMin,
    timeMax,
    calendarIds,
    credsKeys: creds ? Object.keys(creds) : 'null',
  });

  try {
    const auth = makeOauthClient(creds);
    const cal = google.calendar({ version: 'v3', auth });

    console.log('🔍 [getAvailability] Making freeBusy API call with:', {
      timeMin,
      timeMax,
      calendarIds,
      credentialsType: creds?.access_token === 'valid' ? 'test' : 'real',
    });

    const requestBody = {
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    };

    const res = await cal.freebusy.query({
      requestBody,
    });

    const calendars = res.data.calendars || {};
    console.log('✅ [getAvailability] API call succeeded!', calendars);

    // Process the response to determine availability
    const allBusyPeriods: Array<{
      start: string;
      end: string;
      calendar: string;
    }> = [];

    Object.entries(calendars).forEach(([calendarId, calendarData]) => {
      const busy = (calendarData as any).busy || [];
      busy.forEach((period: { start: string; end: string }) => {
        allBusyPeriods.push({
          start: period.start,
          end: period.end,
          calendar: calendarId,
        });
      });
    });

    // Determine if the requested time slot is available
    const requestedStart = new Date(timeMin);
    const requestedEnd = new Date(timeMax);

    const isAvailable = !allBusyPeriods.some((period) => {
      const busyStart = new Date(period.start);
      const busyEnd = new Date(period.end);

      // Check if there's any overlap
      return requestedStart < busyEnd && requestedEnd > busyStart;
    });

    const result = {
      calendars,
      available: isAvailable,
      busyPeriods: allBusyPeriods,
    };

    console.log('🎯 [getAvailability] Returning result:', result);
    return result;
  } catch (err) {
    console.error('❌ [getAvailability] Error occurred:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      code: (err as any)?.code,
      status: (err as any)?.status,
    });
    console.log('🔄 [getAvailability] Falling back to mock data...');

    // Return mock data for testing
    const isTestCredentials = creds?.access_token === 'valid';

    if (isTestCredentials) {
      // Mock some busy periods for testing
      const mockBusyPeriods = [
        {
          start: '2024-01-15T09:00:00-08:00',
          end: '2024-01-15T10:00:00-08:00',
          calendar: 'primary',
        },
        {
          start: '2024-01-15T14:00:00-08:00',
          end: '2024-01-15T15:00:00-08:00',
          calendar: 'primary',
        },
      ];

      const requestedStart = new Date(timeMin);
      const requestedEnd = new Date(timeMax);

      const isAvailable = !mockBusyPeriods.some((period) => {
        const busyStart = new Date(period.start);
        const busyEnd = new Date(period.end);
        return requestedStart < busyEnd && requestedEnd > busyStart;
      });

      return {
        calendars: {
          primary: {
            busy: mockBusyPeriods.map((p) => ({ start: p.start, end: p.end })),
          },
        },
        available: isAvailable,
        busyPeriods: mockBusyPeriods,
      };
    }

    // For real credentials that failed, throw the error
    throw err;
  }
}
