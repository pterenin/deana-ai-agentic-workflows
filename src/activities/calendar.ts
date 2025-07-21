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
    const res = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const result = res.data.items || [];
    console.log('🎯 [getEvents] Returning ' + result.length + ' events');
    console.log('🎯 [getEvents] Returning events:', result);
    return result;
  } catch (err) {
    console.error('❌ [getEvents] Error occurred:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      code: (err as any)?.code,
      status: (err as any)?.status,
      response: (err as any)?.response?.data,
    });
    console.log('🔄 [getEvents] Falling back to mock data...');
    const mockData = [
      {
        id: 'mock1',
        summary: 'Mock Event',
        start: { dateTime: timeMin },
        end: { dateTime: timeMax },
      },
    ];
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
