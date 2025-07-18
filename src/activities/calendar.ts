import { google } from 'googleapis';
// import { log } from '@temporalio/activity';
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
  event: { start: string; end: string; summary: string; attendees?: string[] }
): Promise<any> {
  const auth = makeOauthClient(creds);
  const cal = google.calendar({ version: 'v3', auth });
  const eventWithAttendees = {
    ...event,
    attendees: event.attendees
      ? event.attendees.map((email) => ({ email }))
      : undefined,
    start: { dateTime: event.start },
    end: { dateTime: event.end },
  };
  return cal.events.insert({ calendarId, requestBody: eventWithAttendees });
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
  const auth = makeOauthClient(creds);
  const cal = google.calendar({ version: 'v3', auth });
  return cal.events.delete({
    calendarId,
    eventId,
  });
}
