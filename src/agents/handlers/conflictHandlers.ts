import { getEvents, createEvent } from '../../activities/calendar';

// Conflict resolution function handlers
export const conflictHandlers = {
  findAlternativeTimeSlots: async (args: any, creds: any) => {
    const { requestedTime, duration = 60, calendarId } = args;

    // Parse the requested time
    const requestedDateTime = new Date(requestedTime);
    const startTime = new Date(requestedDateTime);
    const endTime = new Date(requestedDateTime.getTime() + duration * 60000);

    // Generate alternative time slots: 1 hour before, 1 hour after, 2 hours after
    const alternatives = [
      {
        start: new Date(requestedDateTime.getTime() - 60 * 60000), // 1 hour before
        end: new Date(
          requestedDateTime.getTime() - 60 * 60000 + duration * 60000
        ),
        label: '1 hour earlier',
      },
      {
        start: new Date(requestedDateTime.getTime() + 60 * 60000), // 1 hour after
        end: new Date(
          requestedDateTime.getTime() + 60 * 60000 + duration * 60000
        ),
        label: '1 hour later',
      },
      {
        start: new Date(requestedDateTime.getTime() + 120 * 60000), // 2 hours after
        end: new Date(
          requestedDateTime.getTime() + 120 * 60000 + duration * 60000
        ),
        label: '2 hours later',
      },
    ];

    // Check availability for each alternative
    const availableAlternatives = [];
    for (const alt of alternatives) {
      const altStartISO = alt.start.toISOString();
      const altEndISO = alt.end.toISOString();

      const events = await getEvents(creds, calendarId, altStartISO, altEndISO);
      if (events.length === 0) {
        availableAlternatives.push({
          ...alt,
          startISO: altStartISO,
          endISO: altEndISO,
          timeDisplay: `${alt.start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })} - ${alt.end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}`,
        });
      }
    }

    return {
      alternatives: availableAlternatives,
      message: `Found ${availableAlternatives.length} available alternative time slots`,
    };
  },

  createEventAtAlternative: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    return await createEvent(creds, args.calendarId, {
      start: args.startISO,
      end: args.endISO,
      summary: args.summary,
      timeZone: args.timeZone || 'America/Los_Angeles',
      attendees: args.attendees, // Pass attendees to preserve invitations
    });
  },
};
