import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getAvailability,
} from '../../activities/calendar';
import { findContactEmailByName } from '../../activities/contacts';
import {
  getCredentialsForCalendar,
  debugSessionCredentials,
} from '../../utils/sessionCredentialStore';

// Helper function to resolve calendar title to actual calendar ID (email)
function resolveCalendarId(calendarIdOrTitle: string, context?: any): string {
  if (!calendarIdOrTitle) return 'primary';

  // If it's already an email, return as-is
  if (calendarIdOrTitle.includes('@')) {
    return calendarIdOrTitle;
  }

  // Check if it matches account titles and return corresponding email
  if (
    context?.primaryAccount?.title?.toLowerCase() ===
    calendarIdOrTitle.toLowerCase()
  ) {
    return context.primaryAccount.email;
  }

  if (
    context?.secondaryAccount?.title?.toLowerCase() ===
    calendarIdOrTitle.toLowerCase()
  ) {
    return context.secondaryAccount.email;
  }
  return calendarIdOrTitle;
}

// Helper function to check if two events overlap
function eventsOverlap(event1: any, event2: any): boolean {
  const start1 = new Date(event1.start?.dateTime || event1.start?.date);
  const end1 = new Date(event1.end?.dateTime || event1.end?.date);
  const start2 = new Date(event2.start?.dateTime || event2.start?.date);
  const end2 = new Date(event2.end?.dateTime || event2.end?.date);

  // Check if events overlap: start1 < end2 && start2 < end1
  return start1 < end2 && start2 < end1;
}

// Helper function to find alternative time slots for a conflicted event
async function findAlternativeSlots(
  eventToReschedule: any,
  primaryAccount: any,
  secondaryAccount: any,
  searchStart: string,
  searchEnd: string
): Promise<any[]> {
  const originalStart = new Date(
    eventToReschedule.start?.dateTime || eventToReschedule.start?.date
  );
  const originalEnd = new Date(
    eventToReschedule.end?.dateTime || eventToReschedule.end?.date
  );
  const durationMs = originalEnd.getTime() - originalStart.getTime();

  const searchStartDate = new Date(searchStart);
  const searchEndDate = new Date(searchEnd);
  const now = new Date();

  const originalHour = originalStart.getHours();
  const potentialSlots = [];

  // Create time ranges prioritizing slots around the original meeting time
  const timeRanges = [
    // Priority 1: Close to original time (±2 hours)
    {
      startHour: Math.max(9, originalHour - 2),
      endHour: Math.min(20, originalHour + 3),
      priority: 1,
    },
    // Priority 2: Earlier in day if original was afternoon/evening
    ...(originalHour >= 14 ? [{ startHour: 9, endHour: 12, priority: 2 }] : []),
    // Priority 3: Later in day if original was morning
    ...(originalHour <= 12
      ? [{ startHour: 14, endHour: 18, priority: 3 }]
      : []),
    // Priority 4: Any other business hours
    { startHour: 9, endHour: 20, priority: 4 },
  ];

  // Generate potential slots
  for (const range of timeRanges) {
    for (let hour = range.startHour; hour <= range.endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(searchStartDate);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Skip past slots
        if (slotStart <= now) continue;

        // Skip if slot goes beyond search range
        if (slotEnd > searchEndDate) continue;

        // Skip if too close to original time (within 1 hour)
        if (Math.abs(slotStart.getTime() - originalStart.getTime()) < 3600000)
          continue;

        potentialSlots.push({
          start: slotStart,
          end: slotEnd,
          startISO: slotStart.toISOString(),
          endISO: slotEnd.toISOString(),
          priority: range.priority,
        });
      }
    }
  }

  // Sort by priority and time distance from original
  potentialSlots.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aDistance = Math.abs(a.start.getHours() - originalHour);
    const bDistance = Math.abs(b.start.getHours() - originalHour);
    return aDistance - bDistance;
  });

  // Check availability in both calendars
  const availableSlots = [];
  for (const slot of potentialSlots) {
    try {
      let isPrimaryFree = true;
      let isSecondaryFree = true;

      // Check primary calendar
      if (primaryAccount?.email && primaryAccount?.creds) {
        const primaryEvents = await getEvents(
          primaryAccount.creds,
          primaryAccount.email,
          slot.startISO,
          slot.endISO
        );
        isPrimaryFree = primaryEvents.length === 0;
      }

      // Check secondary calendar
      if (secondaryAccount?.email && secondaryAccount?.creds) {
        const secondaryEvents = await getEvents(
          secondaryAccount.creds,
          secondaryAccount.email,
          slot.startISO,
          slot.endISO
        );
        isSecondaryFree = secondaryEvents.length === 0;
      }

      if (isPrimaryFree && isSecondaryFree) {
        availableSlots.push({
          startTime: slot.start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          endTime: slot.end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          startISO: slot.startISO,
          endISO: slot.endISO,
          timeDisplay: `${slot.start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })} - ${slot.end.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}`,
        });

        if (availableSlots.length >= 3) break;
      }
    } catch (error) {
      console.log(`Error checking slot ${slot.startISO}:`, error);
      continue;
    }
  }

  return availableSlots;
}

// Calendar function handlers
export const calendarHandlers = {
  getEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    try {
      console.log('🔍 [getEvents] Starting with params:', {
        calendarId: args.calendarId,
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
        args.calendarId,
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
        events: [],
        count: 0,
        error: error.message,
      };
    }
  },

  getDualAccountEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    primaryAccount?: any,
    secondaryAccount?: any
  ) => {
    try {
      console.log('🔍 [getDualAccountEvents] Starting with params:', {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        primaryAccount: primaryAccount?.email,
        secondaryAccount: secondaryAccount?.email,
      });

      onProgress?.({
        type: 'progress',
        content: 'Fetching events from both calendars...',
      });

      const results = {
        primaryEvents: [] as any[],
        secondaryEvents: [] as any[],
        primaryTitle: primaryAccount?.title || 'Primary',
        secondaryTitle: secondaryAccount?.title || 'Secondary',
        totalCount: 0,
      };

      // Fetch from primary calendar
      if (primaryAccount?.email && primaryAccount?.creds) {
        try {
          onProgress?.({
            type: 'progress',
            content: `Checking ${results.primaryTitle} calendar...`,
          });

          const primaryEvents = await getEvents(
            primaryAccount.creds,
            primaryAccount.email,
            args.timeMin,
            args.timeMax
          );

          results.primaryEvents = primaryEvents;
          console.log(
            `🎯 [getDualAccountEvents] Found ${primaryEvents.length} events in primary calendar`
          );
        } catch (error: any) {
          console.error(
            '[getDualAccountEvents] Primary calendar error:',
            error
          );
          onProgress?.({
            type: 'progress',
            content: `Could not access ${results.primaryTitle} calendar`,
          });
        }
      }

      // Fetch from secondary calendar
      if (secondaryAccount?.email && secondaryAccount?.creds) {
        try {
          onProgress?.({
            type: 'progress',
            content: `Checking ${results.secondaryTitle} calendar...`,
          });

          const secondaryEvents = await getEvents(
            secondaryAccount.creds,
            secondaryAccount.email,
            args.timeMin,
            args.timeMax
          );

          results.secondaryEvents = secondaryEvents;
          console.log(
            `🎯 [getDualAccountEvents] Found ${secondaryEvents.length} events in secondary calendar`
          );
        } catch (error: any) {
          console.error(
            '[getDualAccountEvents] Secondary calendar error:',
            error
          );
          onProgress?.({
            type: 'progress',
            content: `Could not access ${results.secondaryTitle} calendar`,
          });
        }
      }

      results.totalCount =
        results.primaryEvents.length + results.secondaryEvents.length;

      onProgress?.({
        type: 'progress',
        content: `Found ${results.totalCount} total events across both calendars`,
      });

      // Check for conflicts between primary and secondary calendar events
      const conflicts = [];
      for (const primaryEvent of results.primaryEvents) {
        for (const secondaryEvent of results.secondaryEvents) {
          if (eventsOverlap(primaryEvent, secondaryEvent)) {
            conflicts.push({
              primaryEvent,
              secondaryEvent,
              primaryCalendar: results.primaryTitle,
              secondaryCalendar: results.secondaryTitle,
            });
          }
        }
      }

      // If conflicts detected, propose rescheduling for secondary calendar events
      if (conflicts.length > 0) {
        onProgress?.({
          type: 'progress',
          content: `Detected ${conflicts.length} conflict(s) between calendars. Finding alternative time slots...`,
        });

        const reschedulingProposals = [];

        for (const conflict of conflicts) {
          try {
            console.log(
              '🔍 [getDualAccountEvents] Finding alternatives for conflict:',
              {
                secondary: conflict.secondaryEvent.summary,
                primary: conflict.primaryEvent.summary,
              }
            );

            // Extend search range to next day for more options
            const searchEndDate = new Date(args.timeMax);
            searchEndDate.setDate(searchEndDate.getDate() + 1);
            const extendedSearchEnd = searchEndDate.toISOString();

            // Find alternative slots for the secondary event
            const alternatives = await findAlternativeSlots(
              conflict.secondaryEvent,
              primaryAccount,
              secondaryAccount,
              args.timeMin,
              extendedSearchEnd
            );

            console.log(
              '🎯 [getDualAccountEvents] Found alternatives:',
              alternatives.length
            );

            if (alternatives.length > 0) {
              reschedulingProposals.push({
                conflictedEvent: conflict.secondaryEvent,
                conflictedCalendar: results.secondaryTitle,
                conflictingEvent: conflict.primaryEvent,
                conflictingCalendar: results.primaryTitle,
                alternatives: alternatives.slice(0, 3), // Limit to 3 alternatives
              });
              console.log(
                '✅ [getDualAccountEvents] Added rescheduling proposal for:',
                conflict.secondaryEvent.summary
              );
            } else {
              console.log(
                '❌ [getDualAccountEvents] No alternatives found for:',
                conflict.secondaryEvent.summary
              );
            }
          } catch (error) {
            console.error(
              '[getDualAccountEvents] Error finding alternatives:',
              error
            );
          }
        }

        return {
          ...results,
          conflicts,
          hasConflicts: true,
          awaitingReschedulingDecision: true,
          pendingReschedulingProposals: reschedulingProposals,
        };
      }

      return results;
    } catch (error: any) {
      console.error('[Calendar Handler] Dual account events error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to fetch events from calendars: ${error.message}`,
      });

      return {
        primaryEvents: [] as any[],
        secondaryEvents: [] as any[],
        primaryTitle: 'Primary',
        secondaryTitle: 'Secondary',
        totalCount: 0,
        error: error.message,
      };
    }
  },

  getSpecificCalendarEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    primaryAccount?: any,
    secondaryAccount?: any
  ) => {
    try {
      console.log('🔍 [getSpecificCalendarEvents] Starting with params:', {
        timeMin: args.timeMin,
        timeMax: args.timeMax,
        requestedCalendar: args.requestedCalendar,
        primaryAccount: primaryAccount?.email,
        secondaryAccount: secondaryAccount?.email,
      });

      const requestedCalendarLower = args.requestedCalendar.toLowerCase();

      // Determine which account to use based on the requested calendar
      let targetAccount = null;
      let accountType = '';

      // Check if the requested calendar matches the primary account title
      if (
        (primaryAccount?.title &&
          primaryAccount.title
            .toLowerCase()
            .includes(requestedCalendarLower)) ||
        requestedCalendarLower.includes(primaryAccount.title.toLowerCase())
      ) {
        targetAccount = primaryAccount;
        accountType = 'primary';
      }
      // Check if the requested calendar matches the secondary account title
      else if (
        secondaryAccount?.title &&
        (secondaryAccount.title
          .toLowerCase()
          .includes(requestedCalendarLower) ||
          requestedCalendarLower.includes(secondaryAccount.title.toLowerCase()))
      ) {
        targetAccount = secondaryAccount;
        accountType = 'secondary';
      }
      // If no match, try to match common patterns
      else if (
        requestedCalendarLower.includes('work') ||
        requestedCalendarLower.includes('business')
      ) {
        // Default to secondary for work-related queries
        targetAccount = secondaryAccount || primaryAccount;
        accountType = secondaryAccount ? 'secondary' : 'primary';
      } else if (
        requestedCalendarLower.includes('personal') ||
        requestedCalendarLower.includes('private')
      ) {
        // Default to primary for personal queries
        targetAccount = primaryAccount;
        accountType = 'primary';
      } else {
        // Default to primary if no clear match
        targetAccount = primaryAccount;
        accountType = 'primary';
      }

      if (!targetAccount || !targetAccount.email || !targetAccount.creds) {
        return {
          events: [] as any[],
          count: 0,
          calendarTitle: args.requestedCalendar,
          error: `No matching calendar found for "${args.requestedCalendar}"`,
        };
      }

      onProgress?.({
        type: 'progress',
        content: `Checking ${targetAccount.title} calendar...`,
      });

      console.log(
        `🎯 [getSpecificCalendarEvents] Using ${accountType} account: ${targetAccount.email} (${targetAccount.title})`
      );

      const events = await getEvents(
        targetAccount.creds,
        targetAccount.email,
        args.timeMin,
        args.timeMax
      );

      console.log(
        `🎯 [getSpecificCalendarEvents] Found ${events.length} events in ${targetAccount.title} calendar`
      );

      onProgress?.({
        type: 'progress',
        content: `Found ${events.length} events in ${targetAccount.title} calendar`,
      });

      return {
        events,
        count: events.length,
        calendarTitle: targetAccount.title,
        accountType,
      };
    } catch (error: any) {
      console.error(
        '[Calendar Handler] Specific calendar events error:',
        error
      );

      onProgress?.({
        type: 'error',
        content: `Failed to fetch events from ${args.requestedCalendar} calendar: ${error.message}`,
      });

      return {
        events: [] as any[],
        count: 0,
        calendarTitle: args.requestedCalendar,
        error: error.message,
      };
    }
  },

  createEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    console.log('🔍 [createEvent] Called with:', {
      originalCalendarId: args.calendarId,
      summary: args.summary,
      start: args.start,
      end: args.end,
      hasContext: !!context,
      sessionId: context?.sessionId,
    });

    // Resolve calendar title to actual calendar ID (email or 'primary')
    const resolvedCalendarId = resolveCalendarId(args.calendarId, context);

    console.log('🎯 [createEvent] Calendar ID resolution:', {
      original: args.calendarId,
      resolved: resolvedCalendarId,
    });

    // Get correct credentials for the resolved calendar
    let correctCreds = creds; // Fallback
    if (context?.sessionId) {
      debugSessionCredentials(context.sessionId);

      const credResult = getCredentialsForCalendar(
        context.sessionId,
        resolvedCalendarId
      );
      if (credResult) {
        correctCreds = credResult.creds;
        console.log(
          '🔑 [createEvent] Using SESSION STORE credentials (ignoring passed creds):',
          {
            calendarId: resolvedCalendarId,
            account: credResult.accountInfo.title,
            email: credResult.accountInfo.email,
            tokenStart: correctCreds.access_token?.substring(0, 20) + '...',
          }
        );
      } else {
        console.warn(
          '⚠️ [createEvent] No credentials found in session store for:',
          resolvedCalendarId
        );
      }
    } else {
      console.warn(
        '⚠️ [createEvent] No sessionId in context - using passed credentials'
      );
    }

    // First check if the time slot is available
    onProgress?.({
      type: 'progress',
      content: 'Checking calendar availability...',
    });

    const events = await getEvents(
      correctCreds,
      resolvedCalendarId,
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
          args.calendarId,
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
        originalEvent: {
          summary: args.summary,
          attendees: args.attendees, // Preserve attendees for alternatives
          timeZone: args.timeZone || 'America/Los_Angeles',
        },
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
      const result = await createEvent(correctCreds, resolvedCalendarId, {
        start: args.start,
        end: args.end,
        summary: args.summary,
        timeZone: args.timeZone || 'America/Los_Angeles',
        attendees: args.attendees, // Pass attendees if present
      });

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

  createEventWithContacts: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    const attendeeEmails = [];

    // Look up contacts by name
    if (args.contactNames && args.contactNames.length > 0) {
      onProgress?.({
        type: 'progress',
        content: `Looking up ${args.contactNames.length} contact(s)...`,
      });

      for (const contactName of args.contactNames) {
        onProgress?.({
          type: 'progress',
          content: `Looking up contact: ${contactName}...`,
        });

        try {
          const email = await findContactEmailByName(creds, contactName);
          if (email) {
            attendeeEmails.push(email);
            onProgress?.({
              type: 'progress',
              content: `Found ${contactName}: ${email}`,
            });
          } else {
            onProgress?.({
              type: 'progress',
              content: `No contact found for: ${contactName}`,
            });
          }
        } catch (error: any) {
          onProgress?.({
            type: 'progress',
            content: `Error looking up ${contactName}: ${error.message}`,
          });
        }
      }
    }

    // Add additional emails
    if (args.additionalEmails && args.additionalEmails.length > 0) {
      attendeeEmails.push(...args.additionalEmails);
      onProgress?.({
        type: 'progress',
        content: `Added ${args.additionalEmails.length} additional email(s)`,
      });
    }

    // Debug logging
    console.log('DEBUG: attendees array after lookup:', attendeeEmails);
    console.log(
      'DEBUG: functionArgs for createEvent:',
      JSON.stringify(
        {
          summary: args.summary,
          start: args.start,
          end: args.end,
          attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
        },
        null,
        2
      )
    );

    // Create the event with attendees
    const createEventArgs = {
      calendarId: args.calendarId,
      summary: args.summary,
      start: args.start,
      end: args.end,
      timeZone: args.timeZone,
      attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    };

    // Use the existing createEvent handler
    return await calendarHandlers.createEvent(
      createEventArgs,
      creds,
      onProgress
    );
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

      const result = await updateEvent(creds, args.calendarId, args.eventId, {
        start: args.start,
        end: args.end,
        summary: args.summary,
      });

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
          calendarId: args.calendarId,
          eventId: args.eventId,
        }
      );

      const result = await deleteEvent(creds, args.calendarId, args.eventId);

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
          const result = await deleteEvent(creds, args.calendarId, eventId);
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

    try {
      const email = await findContactEmailByName(creds, args.name);
      if (email) {
        onProgress?.({
          type: 'progress',
          content: `Found contact email: ${email}`,
        });
        return { email };
      } else {
        onProgress?.({
          type: 'progress',
          content: `No contact found for name: ${args.name}`,
        });
        return { email: null };
      }
    } catch (error: any) {
      // Check if this is a People API not enabled error
      if (
        error.code === 403 &&
        error.message?.includes('People API has not been used')
      ) {
        onProgress?.({
          type: 'progress',
          content: `Google People API is not enabled. Contact lookup unavailable.`,
        });
        return {
          email: null,
          error:
            'Google People API not enabled - please enable it in Google Cloud Console',
        };
      } else {
        onProgress?.({
          type: 'progress',
          content: `Error accessing contacts: ${
            error.message || 'Unknown error'
          }`,
        });
        return {
          email: null,
          error: `Contact lookup failed: ${error.message || 'Unknown error'}`,
        };
      }
    }
  },

  getAvailability: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void
  ) => {
    const { items, timeMin, timeMax, timeZone = 'UTC' } = args;

    console.log('🔍 [getAvailability Handler] Called with:', {
      items,
      timeMin,
      timeMax,
      timeZone,
    });

    onProgress?.({
      type: 'progress',
      message: `Checking availability for ${
        items.length
      } calendar(s) from ${new Date(
        timeMin
      ).toLocaleTimeString()} to ${new Date(timeMax).toLocaleTimeString()}...`,
    });

    try {
      const result = await getAvailability(
        creds,
        items,
        timeMin,
        timeMax,
        timeZone
      );

      // Format the response for better readability
      const summary = {
        timeRange: `${new Date(timeMin).toLocaleString()} - ${new Date(
          timeMax
        ).toLocaleString()}`,
        timeZone,
        calendars: {} as Record<
          string,
          { status: string; busyTimes?: Array<{ start: string; end: string }> }
        >,
        overallAvailable: true,
      };

      // Process each calendar's availability
      for (const [calendarId, calendarData] of Object.entries(
        result.calendars
      )) {
        const calData = calendarData as {
          busy: Array<{ start: string; end: string }>;
          available: boolean;
        };
        const isAvailable = calData.available;
        summary.calendars[calendarId] = {
          status: isAvailable ? 'Available' : 'Busy',
          ...(calData.busy.length > 0 && { busyTimes: calData.busy }),
        };

        if (!isAvailable) {
          summary.overallAvailable = false;
        }
      }

      console.log('✅ [getAvailability Handler] Success:', summary);

      return {
        success: true,
        availability: result,
        summary,
        message: summary.overallAvailable
          ? `✅ All calendars are available during the requested time slot!`
          : `❌ Some calendars have conflicts during the requested time slot.`,
      };
    } catch (error) {
      console.error('❌ [getAvailability Handler] Error:', error);
      return {
        success: false,
        error: 'Failed to check availability',
        message: `Sorry, I couldn't check calendar availability. ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  },

  createEventWithAvailabilityCheck: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    const {
      summary,
      start,
      end,
      calendarId = 'primary',
      timeZone = 'America/Los_Angeles',
      attendees = [],
      calendarsToCheck = [calendarId],
    } = args;

    console.log('🔍 [createEventWithAvailabilityCheck] Called with:', {
      summary,
      start,
      end,
      calendarId,
      calendarsToCheck,
    });

    // Resolve calendar title to actual calendar ID (email or 'primary')
    const resolvedCalendarId = resolveCalendarId(calendarId, context);

    console.log(
      '🎯 [createEventWithAvailabilityCheck] Calendar ID resolution:',
      {
        original: calendarId,
        resolved: resolvedCalendarId,
      }
    );

    // Get correct credentials for the resolved calendar
    let correctCreds = creds; // Fallback
    if (context?.sessionId) {
      const credResult = getCredentialsForCalendar(
        context.sessionId,
        resolvedCalendarId
      );
      if (credResult) {
        correctCreds = credResult.creds;
        console.log(
          '🔑 [createEventWithAvailabilityCheck] Using SESSION STORE credentials:',
          {
            calendarId: resolvedCalendarId,
            account: credResult.accountInfo.title,
            email: credResult.accountInfo.email,
          }
        );
      } else {
        console.warn(
          '⚠️ [createEventWithAvailabilityCheck] No credentials found in session store for:',
          resolvedCalendarId
        );
      }
    }

    onProgress?.({
      type: 'progress',
      message: `Checking availability for "${summary}" at ${new Date(
        start
      ).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}...`,
    });

    try {
      // First, check availability using getAvailability
      const availabilityResult = await getAvailability(
        creds,
        calendarsToCheck.map((id: string) => ({ id })),
        start,
        end,
        timeZone
      );

      // Check if all calendars are available
      let isAvailable = true;
      const busyCalendars = [];

      for (const [calId, calData] of Object.entries(
        availabilityResult.calendars
      )) {
        const calInfo = calData as {
          busy: Array<{ start: string; end: string }>;
          available: boolean;
        };
        if (!calInfo.available) {
          isAvailable = false;
          busyCalendars.push(calId);
        }
      }

      if (isAvailable) {
        // Time is available, create the event
        onProgress?.({
          type: 'progress',
          message: `Time slot is available! Creating "${summary}"...`,
        });

        const eventResult = await createEvent(
          correctCreds,
          resolvedCalendarId,
          {
            start,
            end,
            summary,
            timeZone,
            attendees: attendees.map((email: string) => ({ email })),
          }
        );

        return {
          success: true,
          created: true,
          event: eventResult,
          message: `Perfect! I've created "${summary}" for ${new Date(
            start
          ).toLocaleTimeString()} - ${new Date(end).toLocaleTimeString()}. 🎉`,
        };
      } else {
        // Time is not available, propose alternatives
        onProgress?.({
          type: 'progress',
          message: `The requested time conflicts with existing events. Finding alternative slots...`,
        });

        const startTime = new Date(start);
        const endTime = new Date(end);
        const duration = endTime.getTime() - startTime.getTime();

        // Generate 3 alternative time slots
        const alternatives = [
          {
            start: new Date(startTime.getTime() - 60 * 60000), // 1 hour earlier
            end: new Date(startTime.getTime() - 60 * 60000 + duration),
            label: '1 hour earlier',
          },
          {
            start: new Date(startTime.getTime() + 60 * 60000), // 1 hour later
            end: new Date(startTime.getTime() + 60 * 60000 + duration),
            label: '1 hour later',
          },
          {
            start: new Date(startTime.getTime() + 120 * 60000), // 2 hours later
            end: new Date(startTime.getTime() + 120 * 60000 + duration),
            label: '2 hours later',
          },
        ];

        // Check availability for each alternative
        const availableAlternatives = [];

        for (const alt of alternatives) {
          const altStartISO = alt.start.toISOString();
          const altEndISO = alt.end.toISOString();

          const altAvailability = await getAvailability(
            creds,
            calendarsToCheck.map((id: string) => ({ id })),
            altStartISO,
            altEndISO,
            timeZone
          );

          // Check if all calendars are available for this alternative
          let altIsAvailable = true;
          for (const [calId, calData] of Object.entries(
            altAvailability.calendars
          )) {
            const altCalInfo = calData as {
              busy: Array<{ start: string; end: string }>;
              available: boolean;
            };
            if (!altCalInfo.available) {
              altIsAvailable = false;
              break;
            }
          }

          if (altIsAvailable) {
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

        if (availableAlternatives.length === 0) {
          return {
            success: false,
            conflict: true,
            busyCalendars,
            message: `The requested time for "${summary}" conflicts with existing events, and I couldn't find any available alternative time slots. You can suggest a specific time, or try a different day.`,
          };
        }

        // Format the alternatives for user selection
        const optionsText = availableAlternatives
          .map(
            (alt, index) => `${index + 1}. ${alt.timeDisplay} (${alt.label})`
          )
          .join('\n');

        return {
          success: true,
          conflict: true,
          created: false,
          busyCalendars,
          alternatives: availableAlternatives,
          originalEvent: {
            summary,
            start,
            end,
            calendarId,
            timeZone,
            attendees,
          },
          message: `The requested time for "${summary}" conflicts with existing events. Here are some available alternatives:\n\n${optionsText}\n\nPlease let me know which option you prefer, or feel free to suggest your own time!`,
        };
      }
    } catch (error) {
      console.error('❌ [createEventWithAvailabilityCheck] Error:', error);
      return {
        success: false,
        error: 'Failed to check availability or create event',
        message: `Sorry, I couldn't check availability or create "${summary}". ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  },
};
