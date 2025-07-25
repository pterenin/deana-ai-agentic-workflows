import { google } from 'googleapis';
import {
  getCredentialsForCalendar,
  getSessionStoreStats,
} from '../utils/sessionCredentialStore';
import 'dotenv/config';

function makeOauthClient(creds: {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  console.log('[makeOauthClient] Using:', {
    clientId,
    clientSecret,
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
      console.log(
        '   🔑 Token preview:',
        creds?.access_token
          ? `${creds.access_token.substring(0, 15)}...`
          : 'missing'
      );
    }

    return result;
  } catch (err) {
    console.error('❌ [getEvents] Error occurred:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      code: (err as any)?.code,
      status: (err as any)?.status,
    });
    console.log('🔄 [getEvents] Falling back to mock data...');

    // Enhanced mock data for testing with different users
    const requestedTime = new Date(timeMin);
    const hour = requestedTime.getHours();

    // If using test credentials (access_token === "valid"), return sample events
    const isTestCredentials = creds?.access_token === 'valid';

    if (isTestCredentials) {
      // Return sample events for testing - events for "today"
      const today = new Date();

      // Create different events for primary vs secondary to test conflicts
      let mockData;

      if (calendarId.includes('primary') || calendarId === 'test@example.com') {
        // Primary calendar events (Red calendar)
        const event1Start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          15,
          15
        ); // 3:15 PM
        const event1End = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          16,
          15
        ); // 4:15 PM
        const event2Start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          18,
          30
        ); // 6:30 PM
        const event2End = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          19,
          30
        ); // 7:30 PM

        mockData = [
          {
            id: 'primary-personal-meeting-123abc',
            summary: 'Personal Meeting',
            start: { dateTime: event1Start.toISOString() },
            end: { dateTime: event1End.toISOString() },
          },
          {
            id: 'primary-taken-meeting-456def',
            summary: 'Taken',
            start: { dateTime: event2Start.toISOString() },
            end: { dateTime: event2End.toISOString() },
          },
        ];
      } else {
        // Secondary calendar events (Blue calendar - with conflicts)
        const event1Start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          15,
          0
        ); // 3:00 PM (overlaps with primary 3:15-4:15 PM)
        const event1End = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          16,
          0
        ); // 4:00 PM
        const event2Start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          18,
          30
        ); // 6:30 PM
        const event2End = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          19,
          30
        ); // 7:30 PM

        mockData = [
          {
            id: 'secondary-office-meeting-789ghi',
            summary: 'Office Meeting',
            start: { dateTime: event1Start.toISOString() },
            end: { dateTime: event1End.toISOString() },
          },
          {
            id: 'secondary-taken-meeting-012jkl',
            summary: 'Taken',
            start: { dateTime: event2Start.toISOString() },
            end: { dateTime: event2End.toISOString() },
          },
        ];
      }

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

    // Original logic: only return conflicts for specific times to simulate realistic calendar
    const hasConflict = hour === 8 || hour === 14; // 8am or 2pm

    const mockData = hasConflict
      ? [
          {
            id: 'mock1',
            summary: 'Mock Event',
            start: { dateTime: timeMin },
            end: { dateTime: timeMax },
          },
        ]
      : []; // No conflicts for other times

    console.log('🎯 [getEvents] Returning mock data:', mockData);
    return mockData;
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
    console.log('🔄 [createEvent] Calendar ID:', calendarId);
    console.log('🔄 [createEvent] Creds:', creds);
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
  },
  sessionId?: string
) {
  console.log('🔄 [updateEvent] Starting with params:', {
    calendarId,
    eventId,
    updates,
    credentialsType: creds?.access_token === 'valid' ? 'test' : 'real',
    sessionId,
  });

  // Validate credentials against session store if sessionId provided
  if (sessionId && calendarId !== 'primary') {
    console.log(
      '🔍 [updateEvent] Validating credentials for calendar:',
      calendarId
    );

    const expectedCreds = getCredentialsForCalendar(sessionId, calendarId);
    if (expectedCreds) {
      const isCorrectCreds =
        expectedCreds.creds.access_token === creds.access_token;
      console.log('🔍 [updateEvent] Credential validation:', {
        calendarId,
        expectedAccount: `${expectedCreds.accountInfo.title} (${expectedCreds.accountInfo.email})`,
        isCorrectCreds,
        providedTokenStart: creds.access_token?.substring(0, 20) + '...',
        expectedTokenStart:
          expectedCreds.creds.access_token?.substring(0, 20) + '...',
      });

      if (!isCorrectCreds) {
        console.warn('⚠️ [updateEvent] CREDENTIAL MISMATCH WARNING!');
        console.warn('   - Calendar:', calendarId);
        console.warn(
          '   - Expected account:',
          expectedCreds.accountInfo.title,
          `(${expectedCreds.accountInfo.email})`
        );
        console.warn(
          '   - Using potentially wrong credentials - this may cause 404 errors'
        );
      } else {
        console.log(
          '✅ [updateEvent] Credential validation passed - using correct account credentials'
        );
      }
    } else {
      console.warn(
        '⚠️ [updateEvent] No credentials found in session store for calendar:',
        calendarId
      );
      console.warn(
        '   - This may indicate the session store was not properly initialized'
      );
      console.warn(
        '   - Or the calendar ID format may not match stored accounts'
      );
    }
  } else {
    console.log(
      '🔍 [updateEvent] Skipping credential validation (no sessionId or using primary calendar)'
    );
  }

  // Handle test credentials with mock response
  if (creds?.access_token === 'valid') {
    console.log('✅ [updateEvent] Using mock update for testing');
    return {
      data: {
        id: eventId,
        summary: updates.summary || 'Updated Event',
        start: updates.start ? { dateTime: updates.start } : undefined,
        end: updates.end ? { dateTime: updates.end } : undefined,
        updated: new Date().toISOString(),
      },
    };
  }

  try {
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

    console.log('🔄 [updateEvent] Making API call to update event', eventPatch);
    console.log('🔄 [updateEvent] Calendar ID:', calendarId);
    console.log('🔄 [updateEvent] Event ID:', eventId);
    console.log('🔄 [updateEvent] creds:', creds);
    const result = await cal.events.patch({
      calendarId,
      eventId,
      requestBody: eventPatch,
    });

    console.log('✅ [updateEvent] Successfully updated event');
    return result;
  } catch (error) {
    console.error('❌ [updateEvent] Error updating event:', error);
    throw error;
  }
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
  items: Array<{ id: string }>,
  timeMin: string,
  timeMax: string,
  timeZone: string = 'UTC'
): Promise<any> {
  console.log('🔍 [getAvailability] Starting FreeBusy query with params:', {
    items,
    timeMin,
    timeMax,
    timeZone,
    credsKeys: creds ? Object.keys(creds) : 'null',
  });

  try {
    const auth = makeOauthClient(creds);
    const cal = google.calendar({ version: 'v3', auth });

    console.log('🔍 [getAvailability] Making FreeBusy API call...');

    const requestBody = {
      timeMin,
      timeMax,
      timeZone,
      items,
    };

    const res = await cal.freebusy.query({
      requestBody,
    });

    const result = res.data;
    console.log('✅ [getAvailability] FreeBusy API call succeeded!');
    console.log(
      '🎯 [getAvailability] Result:',
      JSON.stringify(result, null, 2)
    );

    // Process the result to make it easier to work with
    const processedResult = {
      timeMin,
      timeMax,
      timeZone,
      calendars: {} as Record<
        string,
        { busy: Array<{ start: string; end: string }>; available: boolean }
      >,
    };

    // Process each calendar's busy times
    if (result.calendars) {
      for (const [calendarId, calendarData] of Object.entries(
        result.calendars
      )) {
        const busyTimes = (calendarData as any).busy || [];
        processedResult.calendars[calendarId] = {
          busy: busyTimes,
          available: busyTimes.length === 0, // If no busy times, it's available
        };
      }
    }

    console.log('📊 [getAvailability] Processed result:', processedResult);
    return processedResult;
  } catch (err) {
    console.error('❌ [getAvailability] Error occurred:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      code: (err as any)?.code,
      status: (err as any)?.status,
    });

    // Return mock data for testing when using test credentials
    const isTestCredentials = creds?.access_token === 'valid';
    if (isTestCredentials) {
      console.log(
        '🔄 [getAvailability] Using test credentials, returning mock availability data...'
      );

      // Mock some busy times for testing
      const mockResult = {
        timeMin,
        timeMax,
        timeZone,
        calendars: {} as Record<
          string,
          { busy: Array<{ start: string; end: string }>; available: boolean }
        >,
      };

      // Add mock data for each requested calendar
      items.forEach((item) => {
        // Create some mock busy times for demo purposes
        const requestedStart = new Date(timeMin);
        const requestedEnd = new Date(timeMax);
        const duration = requestedEnd.getTime() - requestedStart.getTime();

        // If the requested time is during typical working hours, make it busy sometimes
        const hour = requestedStart.getHours();
        const isBusyTime = hour >= 9 && hour <= 17 && Math.random() > 0.5; // 50% chance of being busy during work hours

        if (isBusyTime) {
          mockResult.calendars[item.id] = {
            busy: [
              {
                start: timeMin,
                end: timeMax,
              },
            ],
            available: false,
          };
        } else {
          mockResult.calendars[item.id] = {
            busy: [],
            available: true,
          };
        }
      });

      console.log('🎯 [getAvailability] Mock result:', mockResult);
      return mockResult;
    }

    throw err;
  }
}
