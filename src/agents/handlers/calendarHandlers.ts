import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../../activities/calendar';
import { findContactEmailByName } from '../../activities/contacts';

// Calendar function handlers
export const calendarHandlers = {
  getEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    try {
      console.log('🔍 [getEvents] Starting with params:', {
        calendarId: args.calendarId || 'tps8327@gmail.com',
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        credsKeys: creds ? Object.keys(creds) : 'null',
      });

      onProgress?.({
        type: 'progress',
        content: 'Fetching calendar events...',
      });

      const events = await getEvents(
        creds,
        args.calendarId || 'tps8327@gmail.com',
        args.timeMin,
        args.timeMax
      );

      onProgress?.({
        type: 'progress',
        content: `Found ${events.length} events`,
      });

      return {
        events,
        count: events.length,
      };
    } catch (error: any) {
      console.error('[Calendar Handler] Get events error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to fetch events: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
        events: [],
        count: 0,
      };
    }
  },

  createEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    // First check if the time slot is available
    onProgress?.({
      type: 'progress',
      content: 'Checking calendar availability...',
    });

    const events = await getEvents(
      creds,
      args.calendarId || 'tps8327@gmail.com',
      args.start,
      args.end
    );

    if (events.length > 0) {
      // Time slot is not available, find alternatives
      onProgress?.({
        type: 'progress',
        content: 'Scheduling conflict detected, finding alternatives...',
      });

      const requestedDateTime = new Date(args.start);
      const duration =
        (new Date(args.end).getTime() - requestedDateTime.getTime()) / 60000;

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
      for (let i = 0; i < alternatives.length; i++) {
        const alt = alternatives[i];
        onProgress?.({
          type: 'progress',
          content: `Checking alternative ${i + 1} of ${alternatives.length}...`,
        });

        const altStartISO = alt.start.toISOString();
        const altEndISO = alt.end.toISOString();

        const altEvents = await getEvents(
          creds,
          args.calendarId || 'tps8327@gmail.com',
          altStartISO,
          altEndISO
        );
        if (altEvents.length === 0) {
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
        conflict: true,
        conflictingEvents: events,
        alternatives: availableAlternatives,
        message: `I found a scheduling conflict for your "${
          args.summary
        }" meeting at ${new Date(args.start).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}. You already have ${events.length} meeting${
          events.length > 1 ? 's' : ''
        } scheduled during that time.

Here are ${availableAlternatives.length} available alternative time slots:

${availableAlternatives
  .map((alt, i) => `${i + 1}. ${alt.label}: ${alt.timeDisplay}`)
  .join('\n')}

Please let me know which alternative you'd prefer, or suggest a different time.`,
      };
    }

    // Time slot is available, create the event
    try {
      onProgress?.({
        type: 'progress',
        content: 'Creating calendar event...',
      });
      console.log(
        'DEBUG: args for createEvent in handler:',
        JSON.stringify(args, null, 2)
      );
      const result = await createEvent(
        creds,
        args.calendarId || 'tps8327@gmail.com',
        {
          start: args.start,
          end: args.end,
          summary: args.summary,
          timeZone: args.timeZone || 'America/Los_Angeles',
          attendees: args.attendees, // Pass attendees if present
        }
      );

      onProgress?.({
        type: 'progress',
        content: 'Event created successfully!',
      });

      return result;
    } catch (error: any) {
      console.error('[Calendar Handler] Create event error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to create event: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
      };
    }
  },

  updateEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    try {
      onProgress?.({
        type: 'progress',
        content: `Updating event "${args.eventId}"...`,
      });

      const result = await updateEvent(
        creds,
        args.calendarId || 'tps8327@gmail.com',
        args.eventId,
        {
          start: args.start,
          end: args.end,
          summary: args.summary,
        }
      );

      onProgress?.({
        type: 'progress',
        content: 'Event updated successfully!',
      });

      return result;
    } catch (error: any) {
      console.error('[Calendar Handler] Update event error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to update event: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
      };
    }
  },

  deleteEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    console.log('[Calendar Handler] deleteEvent called with args:', args);
    console.log(
      '[Calendar Handler] deleteEvent called with creds keys:',
      creds ? Object.keys(creds) : 'null'
    );

    try {
      onProgress?.({
        type: 'progress',
        content: `Deleting event "${args.eventId}"...`,
      });

      console.log(
        '[Calendar Handler] About to call deleteEvent function with:',
        {
          creds: creds ? 'present' : 'missing',
          calendarId: args.calendarId || 'tps8327@gmail.com',
          eventId: args.eventId,
        }
      );

      const result = await deleteEvent(
        creds,
        args.calendarId || 'tps8327@gmail.com',
        args.eventId
      );

      console.log('[Calendar Handler] deleteEvent function returned:', result);

      onProgress?.({
        type: 'progress',
        content: 'Event deleted successfully!',
      });

      return result;
    } catch (error: any) {
      console.error('[Calendar Handler] Delete event error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to delete event: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
      };
    }
  },

  deleteMultipleEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    try {
      const eventIds = args.eventIds;
      const totalEvents = eventIds.length;

      onProgress?.({
        type: 'progress',
        content: `Deleting ${totalEvents} events...`,
      });

      const results = [];
      const errors = [];

      for (let i = 0; i < eventIds.length; i++) {
        const eventId = eventIds[i];

        onProgress?.({
          type: 'progress',
          content: `Deleting event ${i + 1} of ${totalEvents} (${eventId})...`,
        });

        try {
          const result = await deleteEvent(
            creds,
            args.calendarId || 'tps8327@gmail.com',
            eventId
          );
          results.push({ eventId, success: true, result });
        } catch (error: any) {
          console.error(
            `[Calendar Handler] Failed to delete event ${eventId}:`,
            error
          );
          errors.push({ eventId, error: error.message });
        }
      }

      const successCount = results.length;
      const errorCount = errors.length;

      onProgress?.({
        type: 'progress',
        content: `Deleted ${successCount} events successfully${
          errorCount > 0 ? `, ${errorCount} failed` : ''
        }`,
      });

      return {
        success: true,
        totalEvents,
        deletedEvents: results,
        failedEvents: errors,
        message: `Successfully deleted ${successCount} out of ${totalEvents} events${
          errorCount > 0 ? `. ${errorCount} events failed to delete.` : '.'
        }`,
      };
    } catch (error: any) {
      console.error('[Calendar Handler] Delete multiple events error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to delete events: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
      };
    }
  },

  sendProgressUpdate: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    console.log('[Calendar Handler] sendProgressUpdate called with:', args);

    // Send the progress update to the user
    onProgress?.({
      type: 'progress',
      content: args.message,
      data: { step: args.step || 'update' },
    });

    return {
      success: true,
      message: 'Progress update sent',
      content: args.message,
    };
  },

  findContactEmailByName: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    onProgress?.({
      type: 'progress',
      content: `Looking up contact: ${args.name}...`,
    });
    const email = await findContactEmailByName(creds, args.name);
    if (email) {
      onProgress?.({
        type: 'progress',
        content: `Found contact email: ${email}`,
      });
    } else {
      onProgress?.({
        type: 'progress',
        content: `No contact found for name: ${args.name}`,
      });
    }
    return { email };
  },
};
