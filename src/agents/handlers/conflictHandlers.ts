import {
  getEvents,
  createEvent,
  updateEvent,
  getAvailability,
} from '../../activities/calendar';

// Helper function to resolve calendar title to actual calendar ID
function resolveCalendarId(calendarIdOrTitle: string, context?: any): string {
  // If it's already a valid calendar ID (email or 'primary'), return as-is
  if (calendarIdOrTitle.includes('@') || calendarIdOrTitle === 'primary') {
    return calendarIdOrTitle;
  }

  // Try to map title to actual calendar ID using context
  if (context) {
    // Check if we have account info in context
    const primaryAccount = context.primaryAccount;
    const secondaryAccount = context.secondaryAccount;

    if (
      primaryAccount?.title &&
      primaryAccount.title.toLowerCase() === calendarIdOrTitle.toLowerCase()
    ) {
      console.log(
        `🔧 [resolveCalendarId] Mapping "${calendarIdOrTitle}" -> "${primaryAccount.email}"`
      );
      return primaryAccount.email;
    }

    if (
      secondaryAccount?.title &&
      secondaryAccount.title.toLowerCase() === calendarIdOrTitle.toLowerCase()
    ) {
      console.log(
        `🔧 [resolveCalendarId] Mapping "${calendarIdOrTitle}" -> "${secondaryAccount.email}"`
      );
      return secondaryAccount.email;
    }
  }

  // If no mapping found, check for common patterns and log warning
  console.warn(
    `⚠️ [resolveCalendarId] Could not resolve calendar "${calendarIdOrTitle}" to email. Using as-is.`
  );
  return calendarIdOrTitle;
}

import {
  getCredentialsForCalendar,
  getSessionAccounts,
  getFallbackCredentials,
  debugSessionCredentials,
} from '../../utils/sessionCredentialStore';

// Helper function to recover real event data when fake IDs are detected
async function recoverRealEventData(
  creds: any,
  eventSummary: string,
  context?: any,
  onProgress?: (update: any) => void,
  sessionId?: string
): Promise<any | null> {
  console.log(
    '🔄 [recoverRealEventData] Attempting to find real event data for:',
    eventSummary
  );

  onProgress?.({
    type: 'progress',
    message: `Searching for real event data for "${eventSummary}"...`,
  });

  try {
    // Get time range for search (broader range to catch events from today and future days)
    const today = new Date();
    const timeMin = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString(); // Start from today

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7); // Search up to 7 days ahead
    const timeMax = endDate.toISOString();

    // Get session accounts from credential store
    let sessionAccounts = null;
    if (sessionId) {
      sessionAccounts = getSessionAccounts(sessionId);
    }

    // Fallback to context if session store not available
    if (!sessionAccounts && context) {
      sessionAccounts = {
        primaryAccount: context.primaryAccount,
        secondaryAccount: context.secondaryAccount,
      };
    }

    // Build calendars to search
    const calendarsToSearch = [];

    if (sessionAccounts?.primaryAccount?.email) {
      calendarsToSearch.push({
        id: sessionAccounts.primaryAccount.email,
        title: sessionAccounts.primaryAccount.title || 'Primary',
      });
    } else {
      calendarsToSearch.push({ id: 'primary', title: 'Primary' });
    }

    if (sessionAccounts?.secondaryAccount?.email) {
      calendarsToSearch.push({
        id: sessionAccounts.secondaryAccount.email,
        title: sessionAccounts.secondaryAccount.title || 'Secondary',
      });
    }

    console.log(
      '🔍 [recoverRealEventData] Searching calendars:',
      calendarsToSearch
    );

    // Debug session credential store
    console.log('🔍 [recoverRealEventData] Session credential debug:', {
      sessionId,
      hasSessionAccounts: !!sessionAccounts,
      hasPrimaryAccount: !!sessionAccounts?.primaryAccount,
      hasSecondaryAccount: !!sessionAccounts?.secondaryAccount,
      primaryEmail: sessionAccounts?.primaryAccount?.email,
      secondaryEmail: sessionAccounts?.secondaryAccount?.email,
      primaryTitle: sessionAccounts?.primaryAccount?.title,
      secondaryTitle: sessionAccounts?.secondaryAccount?.title,
    });

    // Search each calendar
    for (const calendar of calendarsToSearch) {
      console.log(
        `🔍 [recoverRealEventData] Searching calendar: ${calendar.title} (${calendar.id})`
      );
      console.log(
        `🔍 [recoverRealEventData] Time range: ${timeMin} to ${timeMax}`
      );

      // Use the correct credentials for each calendar via session store
      let calendarCreds = creds; // Default to provided creds

      if (sessionId) {
        const credResult = getCredentialsForCalendar(sessionId, calendar.id);
        if (credResult) {
          calendarCreds = credResult.creds;
          console.log(
            `🔑 [recoverRealEventData] Using ${
              credResult.accountInfo.title?.toUpperCase() || 'SESSION'
            } account creds for ${calendar.title}`
          );
        } else {
          console.log(
            `🔑 [recoverRealEventData] No session creds found for ${calendar.title}, using fallback`
          );
          const fallbackCreds = getFallbackCredentials(sessionId);
          if (fallbackCreds) {
            calendarCreds = fallbackCreds;
          }
        }
      } else {
        console.log(
          `🔑 [recoverRealEventData] No session ID provided, using default creds for ${calendar.title}`
        );
      }

      console.log(
        '🔍 [recoverRealEventData] Using creds with client_id:',
        calendarCreds?.client_id
      );
      console.log('🔍 [recoverRealEventData] Full credential details:', {
        hasAccessToken: !!calendarCreds?.access_token,
        hasRefreshToken: !!calendarCreds?.refresh_token,
        expiresAt: calendarCreds?.expires_at,
        clientId: calendarCreds?.client_id,
        credSource:
          context?.primaryAccount?.email === calendar.id
            ? 'PRIMARY'
            : context?.secondaryAccount?.email === calendar.id
            ? 'SECONDARY'
            : 'DEFAULT',
      });

      let events = [];
      try {
        events = await getEvents(calendarCreds, calendar.id, timeMin, timeMax);
      } catch (error) {
        console.warn(
          `⚠️ [recoverRealEventData] Failed to get events from ${calendar.title} (${calendar.id}):`,
          error instanceof Error ? error.message : String(error)
        );

        // Try fallback with 'primary' calendar ID if using email failed
        if (calendar.id.includes('@') && calendar.id !== 'primary') {
          console.log(
            `🔄 [recoverRealEventData] Trying fallback with 'primary' calendar ID for ${calendar.title}...`
          );
          try {
            events = await getEvents(
              calendarCreds,
              'primary',
              timeMin,
              timeMax
            );
            console.log(
              `✅ [recoverRealEventData] Fallback to 'primary' succeeded for ${calendar.title}!`
            );
          } catch (fallbackError) {
            console.warn(
              `⚠️ [recoverRealEventData] Fallback to 'primary' also failed for ${calendar.title}:`,
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError)
            );
            console.log(
              `🔄 [recoverRealEventData] Continuing to next calendar...`
            );
            continue;
          }
        } else {
          console.log(
            `🔄 [recoverRealEventData] Continuing to next calendar...`
          );
          continue;
        }
      }

      console.log(
        `🔍 [recoverRealEventData] Found ${events.length} events in ${calendar.title} calendar`
      );

      // Log all event summaries for debugging
      if (events.length > 0) {
        console.log(
          '🔍 [recoverRealEventData] Available events:',
          events.map((e) => e.summary)
        );
      }

      // Look for event matching the summary - try multiple matching strategies
      const eventSummaryLower = eventSummary.toLowerCase().trim();

      let matchingEvent = events.find((event) => {
        if (!event.summary) return false;
        const eventSummaryEventLower = event.summary.toLowerCase().trim();

        // Exact match
        if (eventSummaryEventLower === eventSummaryLower) return true;

        // Contains match (original logic)
        if (eventSummaryEventLower.includes(eventSummaryLower)) return true;

        // Reverse contains match (search term contains event summary)
        if (eventSummaryLower.includes(eventSummaryEventLower)) return true;

        return false;
      });

      if (matchingEvent) {
        console.log('✅ [recoverRealEventData] Found matching event:', {
          id: matchingEvent.id,
          summary: matchingEvent.summary,
          calendarId: calendar.id,
          start: matchingEvent.start,
          end: matchingEvent.end,
        });

        // Return the real event data with the actual calendar ID
        return {
          id: matchingEvent.id,
          summary: matchingEvent.summary,
          start: matchingEvent.start,
          end: matchingEvent.end,
          calendarId: calendar.id,
          calendarTitle: calendar.title,
        };
      } else {
        console.log(
          `❌ [recoverRealEventData] No matching event found in ${calendar.title} for: "${eventSummary}"`
        );
      }
    }

    console.log(
      '❌ [recoverRealEventData] No matching event found for:',
      eventSummary
    );
    console.log('🔍 [recoverRealEventData] Search summary:', {
      searchTerm: eventSummary,
      calendarsSearched: calendarsToSearch.map((c) => `${c.title} (${c.id})`),
      timeRange: `${timeMin} to ${timeMax}`,
      totalEventsFound: 'check individual calendar logs above',
    });

    console.log(
      '❌ [recoverRealEventData] RECOVERY FAILED - Diagnostic checklist:'
    );
    console.log(
      '   1. Check if secondary account credentials are valid and not expired'
    );
    console.log('   2. Verify calendar permissions for each Google account');
    console.log(
      '   3. Confirm event exists in the expected calendar and time range'
    );
    console.log(
      '   4. Check if calendar IDs should use "primary" instead of email addresses'
    );
    console.log(
      '   5. Verify account context is being passed correctly from client'
    );

    return null;
  } catch (error) {
    console.error(
      '❌ [recoverRealEventData] Error searching for event:',
      error
    );
    return null;
  }
}

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

  createEventAtAlternative: async (args: any, creds: any) => {
    return await createEvent(creds, args.calendarId, {
      start: args.startISO,
      end: args.endISO,
      summary: args.summary,
      timeZone: args.timeZone || 'America/Los_Angeles',
      attendees: args.attendees, // Pass attendees to preserve invitations
    });
  },

  rescheduleEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    const { eventId, calendarId, newStartTime, newEndTime, eventSummary } =
      args;

    console.log('🔄 [rescheduleEvent] Called with:', args);
    console.log(
      '🔄 [rescheduleEvent] Context:',
      context ? Object.keys(context) : 'none'
    );

    // Resolve calendar title to actual calendar ID
    const resolvedCalendarId = resolveCalendarId(calendarId, context);

    console.log('🔄 [rescheduleEvent] Calendar ID resolution:', {
      original: calendarId,
      resolved: resolvedCalendarId,
    });

    // Validate that we have real event data, not fake data
    if (!eventId || !resolvedCalendarId) {
      return {
        success: false,
        error: 'Missing event data',
        message:
          'I need the actual event ID and calendar ID to reschedule. Let me find the real event data first.',
      };
    }

    // Check for obviously fake data patterns (using resolved calendar ID)
    const isFakeEventId =
      eventId.includes('office_meeting_') ||
      eventId.includes('_2025_') ||
      eventId.includes('blue-event') ||
      eventId.includes('red-event') ||
      eventId === 'blue-event' ||
      eventId === 'red-event' ||
      eventId.length < 10;
    const isFakeCalendarId =
      resolvedCalendarId === 'Blue' ||
      resolvedCalendarId === 'Red' ||
      resolvedCalendarId === 'blue' ||
      resolvedCalendarId === 'red' ||
      resolvedCalendarId === 'blue_calendar' ||
      (!resolvedCalendarId.includes('@') && resolvedCalendarId !== 'primary');

    if (isFakeEventId || isFakeCalendarId) {
      console.error(
        '🚫 [rescheduleEvent] Detected fake data - BLOCKING OPERATION:',
        {
          eventId,
          originalCalendarId: calendarId,
          resolvedCalendarId: resolvedCalendarId,
          isFakeEventId,
          isFakeCalendarId,
        }
      );
      return {
        success: false,
        error: 'FAKE_DATA_BLOCKED',
        message:
          '❌ I cannot reschedule with fake data. I need to get the real event information first. Let me check your calendar to find the actual "Office meeting" event with its real Google Calendar event ID.',
        needsRealData: true,
        suggestedAction:
          'Call getEvents to retrieve real event data before rescheduling',
      };
    }

    onProgress?.({
      type: 'progress',
      message: `Rescheduling "${eventSummary}" to ${new Date(
        newStartTime
      ).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}...`,
    });

    // ALWAYS use session store credentials - ignore passed creds to avoid using wrong account
    let correctCreds = creds; // Fallback only
    if (context?.sessionId) {
      const credResult = getCredentialsForCalendar(
        context.sessionId,
        resolvedCalendarId
      );
      if (credResult) {
        correctCreds = credResult.creds;
        console.log(
          '🔑 [rescheduleEvent] Using SESSION STORE credentials (ignoring passed creds):',
          {
            calendarId: resolvedCalendarId,
            account: credResult.accountInfo.title,
            email: credResult.accountInfo.email,
            tokenStart: correctCreds.access_token?.substring(0, 20) + '...',
          }
        );
      } else {
        console.warn(
          '⚠️ [rescheduleEvent] No credentials found in session store for:',
          resolvedCalendarId
        );
        console.warn(
          '   - Falling back to passed credentials (may cause issues)'
        );
        // Try to get fallback credentials from session store
        const fallbackCreds = getFallbackCredentials(context.sessionId);
        if (fallbackCreds) {
          correctCreds = fallbackCreds;
          console.log(
            '🔄 [rescheduleEvent] Using fallback credentials from session store'
          );
        }
      }
    } else {
      console.warn(
        '⚠️ [rescheduleEvent] No sessionId in context - using passed credentials'
      );
    }

    try {
      // Use the resolved calendar ID for the API call
      await updateEvent(
        correctCreds,
        resolvedCalendarId,
        eventId,
        {
          start: newStartTime,
          end: newEndTime,
        },
        context?.sessionId
      );

      return {
        success: true,
        eventId,
        eventSummary,
        newStartTime,
        newEndTime,
        calendarId: resolvedCalendarId, // Return the resolved calendar ID
        message: `Successfully rescheduled "${eventSummary}" to ${new Date(
          newStartTime
        ).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })} - ${new Date(newEndTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}`,
      };
    } catch (error) {
      console.error('Error rescheduling event:', error);
      return {
        success: false,
        error: 'Failed to reschedule event',
        message: `Sorry, I couldn't reschedule "${eventSummary}". Please try again or contact support.`,
      };
    }
  },

  showReschedulingOptions: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    let { userAgreed, conflictedEvent } = args;

    console.log('🔍 [showReschedulingOptions] Called with:', {
      userAgreed,
      conflictedEvent: conflictedEvent
        ? conflictedEvent.summary
        : 'not provided',
      contextKeys: context ? Object.keys(context) : 'no context',
    });

    if (!userAgreed) {
      return {
        message:
          'No problem! Your meetings will stay as they are. Let me know if you change your mind or need anything else.',
      };
    }

    // If no specific conflicted event provided, return error - we need real event data
    if (!conflictedEvent) {
      return {
        success: false,
        message:
          "I need more information about which specific meeting to reschedule. Could you please tell me which meeting you'd like me to move?",
      };
    }

    // Check for fake event data and attempt recovery
    const eventId = conflictedEvent.id;
    const calendarId = conflictedEvent.calendarId;
    const eventSummary = conflictedEvent.summary;

    const isFakeEventId =
      !eventId ||
      eventId.includes('office_meeting_') ||
      eventId.includes('_2025_') ||
      eventId.includes('blue-event') ||
      eventId.includes('red-event') ||
      eventId === 'blue-event' ||
      eventId === 'red-event' ||
      eventId.length < 10;

    const isFakeCalendarId =
      !calendarId ||
      calendarId === 'Blue' ||
      calendarId === 'Red' ||
      calendarId === 'blue' ||
      calendarId === 'red' ||
      calendarId === 'blue_calendar' ||
      calendarId.includes('blue-calendar') ||
      calendarId.includes('red-calendar');

    if (isFakeEventId || isFakeCalendarId) {
      console.log(
        '🔄 [showReschedulingOptions] Detected fake data, attempting recovery:',
        {
          eventId,
          calendarId,
          eventSummary,
          isFakeEventId,
          isFakeCalendarId,
        }
      );

      if (!eventSummary) {
        return {
          success: false,
          message:
            'I need the event title to find the real event data. Could you tell me which specific meeting you want to reschedule?',
        };
      }

      // Attempt to recover real event data
      const realEventData = await recoverRealEventData(
        creds,
        eventSummary,
        context,
        onProgress,
        context?.sessionId
      );

      if (!realEventData) {
        return {
          success: false,
          message: `I couldn't find the "${eventSummary}" event in your calendars. This might be because:
- The event name is different than expected
- The event is outside the search time range (today to next 7 days)
- The calendar permissions need to be refreshed

Please check the event name and try again, or try rescheduling manually.`,
        };
      }

      console.log(
        '✅ [showReschedulingOptions] Successfully recovered real event data:',
        realEventData
      );

      // Replace fake data with real data
      conflictedEvent = realEventData;

      onProgress?.({
        type: 'progress',
        message: `Found real event data for "${eventSummary}". Proceeding with rescheduling...`,
      });
    }

    onProgress?.({
      type: 'progress',
      content: `Finding alternative time slots for "${conflictedEvent.summary}"...`,
    });

    try {
      // Get the original time details
      const originalStart =
        conflictedEvent.start?.dateTime || conflictedEvent.start;
      const originalEnd = conflictedEvent.end?.dateTime || conflictedEvent.end;
      const startTime = new Date(originalStart);
      const endTime = new Date(originalEnd);
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // Duration in minutes

      // Generate 3 alternative time slots around the original time
      const alternatives = [
        {
          start: new Date(startTime.getTime() - 60 * 60000), // 1 hour earlier
          end: new Date(endTime.getTime() - 60 * 60000),
          label: '1 hour earlier',
        },
        {
          start: new Date(startTime.getTime() + 60 * 60000), // 1 hour later
          end: new Date(endTime.getTime() + 60 * 60000),
          label: '1 hour later',
        },
        {
          start: new Date(startTime.getTime() + 120 * 60000), // 2 hours later
          end: new Date(endTime.getTime() + 120 * 60000),
          label: '2 hours later',
        },
      ];

      onProgress?.({
        type: 'progress',
        content: `Checking availability for alternative time slots...`,
      });

      // Check availability for each alternative using getAvailability
      const availableAlternatives = [];

      for (const alt of alternatives) {
        const altStartISO = alt.start.toISOString();
        const altEndISO = alt.end.toISOString();

        // Use getAvailability to check if this time slot is free
        const availabilityResult = await getAvailability(
          creds,
          [{ id: conflictedEvent.calendarId }],
          altStartISO,
          altEndISO
        );

        const calendarData =
          availabilityResult.calendars[conflictedEvent.calendarId];
        if (calendarData && calendarData.available) {
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
          message: `I couldn't find any available alternative time slots for "${conflictedEvent.summary}". You can suggest a specific time, or try manually rescheduling this meeting.`,
        };
      }

      // Format the alternatives for user selection
      const optionsText = availableAlternatives
        .map((alt, index) => `${index + 1}. ${alt.timeDisplay} (${alt.label})`)
        .join('\n');

      return {
        success: true,
        conflictedEvent: conflictedEvent,
        alternatives: availableAlternatives,
        message: `Great! I found these available time slots for "${conflictedEvent.summary}":\n\n${optionsText}\n\nPlease let me know which option you prefer, or feel free to suggest your own time!`,
      };
    } catch (error) {
      console.error('Error finding alternative slots:', error);
      return {
        success: false,
        message: `I had trouble finding alternative time slots for "${conflictedEvent.summary}". You can suggest a specific time, or try manually rescheduling this meeting.`,
      };
    }
  },

  selectTimeSlot: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: any
  ) => {
    let { conflictedEvent, selectedSlot } = args;

    console.log('🎯 [selectTimeSlot] Called with:', {
      eventSummary: conflictedEvent?.summary,
      eventId: conflictedEvent?.id,
      newTime: selectedSlot?.timeDisplay,
      originalCalendarId: conflictedEvent?.calendarId,
    });

    if (!conflictedEvent) {
      return {
        success: false,
        error: 'Missing event data',
        message:
          'I need the event information to reschedule. Please try again.',
      };
    }

    // Check for fake event data and attempt recovery
    const eventId = conflictedEvent.id;
    const calendarId = conflictedEvent.calendarId;
    const eventSummary = conflictedEvent.summary;

    const isFakeEventId =
      !eventId ||
      eventId.includes('office_meeting_') ||
      eventId.includes('_2025_') ||
      eventId.includes('blue-event') ||
      eventId.includes('red-event') ||
      eventId === 'blue-event' ||
      eventId === 'red-event' ||
      eventId.length < 10;

    const isFakeCalendarId =
      !calendarId ||
      calendarId === 'Blue' ||
      calendarId === 'Red' ||
      calendarId === 'blue' ||
      calendarId === 'red' ||
      calendarId === 'blue_calendar' ||
      calendarId.includes('blue-calendar') ||
      calendarId.includes('red-calendar');

    if (isFakeEventId || isFakeCalendarId) {
      console.log(
        '🔄 [selectTimeSlot] Detected fake data, attempting recovery:',
        {
          eventId,
          calendarId,
          eventSummary,
          isFakeEventId,
          isFakeCalendarId,
        }
      );

      if (!eventSummary) {
        return {
          success: false,
          message:
            'I need the event title to find the real event data. Could you tell me which specific meeting you want to reschedule?',
        };
      }

      // Attempt to recover real event data
      const realEventData = await recoverRealEventData(
        creds,
        eventSummary,
        context,
        onProgress,
        context?.sessionId
      );

      if (!realEventData) {
        return {
          success: false,
          message: `I couldn't find the "${eventSummary}" event in your calendars. This might be because:
- The event name is different than expected
- The event is outside the search time range (today to next 7 days)
- The calendar permissions need to be refreshed

Please check the event name and try again, or try rescheduling manually.`,
        };
      }

      console.log(
        '✅ [selectTimeSlot] Successfully recovered real event data:',
        realEventData
      );

      // Replace fake data with real data
      conflictedEvent = realEventData;

      onProgress?.({
        type: 'progress',
        message: `Found real event data for "${eventSummary}". Proceeding with rescheduling...`,
      });
    }

    // Resolve calendar title to actual calendar ID
    const resolvedCalendarId = resolveCalendarId(
      conflictedEvent.calendarId,
      context
    );

    console.log('🎯 [selectTimeSlot] Calendar ID resolution:', {
      original: conflictedEvent.calendarId,
      resolved: resolvedCalendarId,
    });

    // ALWAYS use session store credentials - ignore passed creds to avoid using wrong account
    let correctCreds = creds; // Fallback only
    if (context?.sessionId) {
      // Debug: Show all available credentials for this session
      debugSessionCredentials(context.sessionId);
      const credResult = getCredentialsForCalendar(
        context.sessionId,
        resolvedCalendarId
      );
      if (credResult) {
        correctCreds = credResult.creds;
        console.log(
          '🔑 [selectTimeSlot] Using SESSION STORE credentials (ignoring passed creds):',
          {
            calendarId: resolvedCalendarId,
            account: credResult.accountInfo.title,
            email: credResult.accountInfo.email,
            tokenStart: correctCreds.access_token?.substring(0, 20) + '...',
          }
        );
      } else {
        console.warn(
          '⚠️ [selectTimeSlot] No credentials found in session store for:',
          resolvedCalendarId
        );
        console.warn(
          '   - Falling back to passed credentials (may cause issues)'
        );
        // Try to get fallback credentials from session store
        const fallbackCreds = getFallbackCredentials(context.sessionId);
        if (fallbackCreds) {
          correctCreds = fallbackCreds;
          console.log(
            '🔄 [selectTimeSlot] Using fallback credentials from session store'
          );
        }
      }
    } else {
      console.warn(
        '⚠️ [selectTimeSlot] No sessionId in context - using passed credentials'
      );
    }

    onProgress?.({
      type: 'progress',
      message: `Rescheduling "${conflictedEvent.summary}" to ${selectedSlot.timeDisplay}...`,
    });

    try {
      await updateEvent(
        correctCreds,
        resolvedCalendarId,
        conflictedEvent.id,
        {
          start: selectedSlot.startISO,
          end: selectedSlot.endISO,
        },
        context?.sessionId
      );

      return {
        success: true,
        eventId: conflictedEvent.id,
        eventSummary: conflictedEvent.summary,
        calendarId: resolvedCalendarId, // Include the resolved calendar ID
        newTime: selectedSlot,
        message: `Perfect! I've successfully rescheduled "${conflictedEvent.summary}" to ${selectedSlot.timeDisplay}. Your calendars are now conflict-free! 🎉`,
      };
    } catch (error) {
      console.error('Error selecting time slot:', error);
      return {
        success: false,
        error: 'Failed to reschedule event',
        message: `Sorry, I couldn't reschedule "${conflictedEvent.summary}" to ${selectedSlot.timeDisplay}. Please try again or contact support.`,
      };
    }
  },
};
