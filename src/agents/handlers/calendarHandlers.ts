import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getAvailability,
} from '../../activities/calendar';
import { findContactEmailByName } from '../../activities/contacts';
import { sendEmail } from './sendEmailHandler';

import { AccountInfo, SessionContext } from '../types';

// Ensure times are RFC3339 (Google Calendar requirement). If missing timezone, append Z
function ensureRfc3339(dateTime: string | undefined): string | undefined {
  if (!dateTime) return dateTime;
  // Already has timezone info (Z or "+/-HH:MM")
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dateTime)) return dateTime;
  // If it's a plain date (YYYY-MM-DD), convert to start of day UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) return `${dateTime}T00:00:00Z`;
  // If it's a datetime without timezone, append Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateTime)) {
    // Normalize to include seconds
    const withSeconds = dateTime.match(/:\d{2}$/) ? dateTime : `${dateTime}:00`;
    return `${withSeconds}Z`;
  }
  // Fallback: try to parse and re-ISO
  const parsed = new Date(dateTime);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return dateTime;
}

// Detect if the user asked a non-specific period query (today/this week/month/year or generic month/week/year)
function isNonSpecificPeriodQuery(userMessage: string): boolean {
  const msg = (userMessage || '').toLowerCase();
  // Cover misspellings like "months"
  return /\b(today|this week|this month|this year|week|month|year|\d{4})\b/.test(
    msg
  );
}

// Detect if user explicitly requested the beginning of the period
function mentionsBeginningOfPeriod(userMessage: string): boolean {
  const msg = (userMessage || '').toLowerCase();
  return /\b(from the beginning|from start|since the beginning|start of (the )?(day|week|month|year))\b/.test(
    msg
  );
}

// Filter out events that ended before now, preserving ongoing and future events
function filterToOngoingAndFuture(events: any[], now: Date): any[] {
  return (events || []).filter((event) => {
    const endDateTime = event?.end?.dateTime || null;
    const endDate = event?.end?.date || null; // all-day events use date (exclusive end)
    let eventEnd: Date | null = null;
    if (endDateTime) {
      const parsed = new Date(endDateTime);
      eventEnd = isNaN(parsed.getTime()) ? null : parsed;
    } else if (endDate) {
      const parsed = new Date(endDate);
      eventEnd = isNaN(parsed.getTime()) ? null : parsed;
    }
    // If cannot parse end, keep it just in case
    if (!eventEnd) return true;
    return eventEnd >= now;
  });
}

// Annotate events with isOngoing flag based on current time
function annotateOngoing(events: any[], now: Date): any[] {
  return (events || []).map((event) => {
    const startDT = event?.start?.dateTime || null;
    const endDT = event?.end?.dateTime || null;
    let isOngoing = false;
    if (startDT && endDT) {
      const start = new Date(startDT);
      const end = new Date(endDT);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        isOngoing = start <= now && now < end;
      }
    }
    return { ...event, isOngoing };
  });
}

// Helper function to detect conflicts between calendar events
function detectConflicts(
  primaryEvents: any[],
  secondaryEvents: any[],
  accounts: { primary: AccountInfo; secondary: AccountInfo | null }
): any[] {
  const conflicts = [];

  for (const primaryEvent of primaryEvents) {
    const primaryStart = new Date(primaryEvent.start.dateTime);
    const primaryEnd = new Date(primaryEvent.end.dateTime);

    for (const secondaryEvent of secondaryEvents) {
      const secondaryStart = new Date(secondaryEvent.start.dateTime);
      const secondaryEnd = new Date(secondaryEvent.end.dateTime);

      // Check for overlap
      if (primaryStart < secondaryEnd && secondaryStart < primaryEnd) {
        conflicts.push({
          type: 'overlap',
          primaryEvent: {
            id: primaryEvent.id,
            summary: primaryEvent.summary,
            start: primaryEvent.start.dateTime,
            end: primaryEvent.end.dateTime,
            calendar: accounts.primary.title,
            calendarEmail: accounts.primary.email,
          },
          secondaryEvent: {
            id: secondaryEvent.id,
            summary: secondaryEvent.summary,
            start: secondaryEvent.start.dateTime,
            end: secondaryEvent.end.dateTime,
            calendar: accounts.secondary?.title,
            calendarEmail: accounts.secondary?.email,
          },
          overlapStart: new Date(
            Math.max(primaryStart.getTime(), secondaryStart.getTime())
          ),
          overlapEnd: new Date(
            Math.min(primaryEnd.getTime(), secondaryEnd.getTime())
          ),
        });
      }
    }
  }

  return conflicts;
}

// Helper function to determine which account to use based on user request
function determineTargetAccount(
  userMessage: string,
  accounts: { primary: AccountInfo; secondary: AccountInfo | null },
  calendarIdFromAI?: string
): AccountInfo | 'both' | null {
  if (!accounts.primary) return null;

  const messageLower = (userMessage || '').toLowerCase();
  const primaryTitle = (accounts.primary?.title || '').toLowerCase();
  const secondaryTitle = (accounts.secondary?.title || '').toLowerCase();

  // If AI explicitly omitted calendarId, it wants to check both calendars
  if (!calendarIdFromAI && accounts.secondary) {
    console.log(
      '🧠 [determineTargetAccount] AI omitted calendarId - checking both calendars'
    );
    return 'both';
  }

  // For event searches and schedule overviews without specific calendar mention, check both
  const isEventSearchQuery = userMessage
    .toLowerCase()
    .match(
      /(what time.*have|when.*have|when is|what time is|find.*meeting|find.*event|locate.*meeting)/
    );

  const isScheduleOverviewQuery = userMessage
    .toLowerCase()
    .match(
      /(how.*week|what.*week|my week|what.*schedule|my schedule|list.*meetings|meetings.*week|week.*looks|schedule.*looks|next.*weeks|this week|this month|next month|meetings.*month|september|october|november|december|january|february|march|april|may|june|july|august)/
    );

  const hasNoCalendarMention = !userMessage
    .toLowerCase()
    .match(/(work|personal|primary|secondary)/);

  if (
    (isEventSearchQuery || isScheduleOverviewQuery) &&
    hasNoCalendarMention &&
    !!accounts.secondary
  ) {
    console.log(
      '🧠 [determineTargetAccount] Schedule/event query without calendar specification - checking both calendars'
    );
    return 'both';
  }

  // If AI specified a calendarId, try to match it to account titles
  if (calendarIdFromAI) {
    const calendarIdLower = calendarIdFromAI.toLowerCase();

    // Check if AI specified account by title
    if (
      primaryTitle &&
      (calendarIdLower === primaryTitle ||
        calendarIdLower.includes(primaryTitle))
    ) {
      console.log(
        `🧠 [determineTargetAccount] AI specified ${accounts.primary.title} calendar`
      );
      return accounts.primary;
    }

    if (
      secondaryTitle &&
      (calendarIdLower === secondaryTitle ||
        calendarIdLower.includes(secondaryTitle))
    ) {
      console.log(
        `🧠 [determineTargetAccount] AI specified ${
          accounts.secondary!.title
        } calendar`
      );
      return accounts.secondary!;
    }

    // Check for generic references
    if (calendarIdLower === 'primary' || calendarIdLower === 'main') {
      console.log('🧠 [determineTargetAccount] AI specified primary calendar');
      return accounts.primary;
    }

    if (calendarIdLower === 'secondary' || calendarIdLower === 'second') {
      console.log(
        '🧠 [determineTargetAccount] AI specified secondary calendar'
      );
      return accounts.secondary || accounts.primary;
    }
  }

  // Check for explicit account references in the original message
  if (primaryTitle && messageLower.includes(primaryTitle)) {
    console.log(
      `🧠 [determineTargetAccount] User mentioned ${accounts.primary.title} in message`
    );
    return accounts.primary;
  }

  if (secondaryTitle && messageLower.includes(secondaryTitle)) {
    console.log(
      `🧠 [determineTargetAccount] User mentioned ${
        accounts.secondary!.title
      } in message`
    );
    return accounts.secondary!;
  }

  // Default to primary account if AI specified some calendarId but we couldn't match it
  console.log('🧠 [determineTargetAccount] Defaulting to primary account');
  return accounts.primary;
}

// Enhanced getEvents handler that can work with multiple accounts
const getEventsMultiAccount = async (
  args: any,
  context: SessionContext,
  onProgress?: (update: any) => void
) => {
  try {
    if (!context.accounts?.primary) {
      throw new Error('No account information available in session context');
    }

    const userMessage =
      context.history[context.history.length - 1]?.content || '';

    const hasUsableSecondary = !!(
      context.accounts.secondary &&
      context.accounts.secondary.email &&
      context.accounts.secondary.creds &&
      context.accounts.secondary.creds.access_token
    );

    console.log('🔍 [getEventsMultiAccount] DEBUG INFO:');
    console.log('  User message:', userMessage);
    console.log('  Args calendarId:', args.calendarId);
    console.log('  Has secondary account:', hasUsableSecondary);
    console.log('  Primary title:', context.accounts.primary.title);
    console.log('  Secondary title:', context.accounts.secondary?.title);

    // SAFETY CHECK: If AI passed an email address for a broad query, override it
    let calendarIdToUse = args.calendarId;
    const isBroadQuery = userMessage
      .toLowerCase()
      .match(
        /(how.*day|what.*schedule|meetings today|my day|my schedule|do i have meetings|am i free|what.*today)/
      );
    if (isBroadQuery && args.calendarId && args.calendarId.includes('@')) {
      console.log(
        '🚨 [SAFETY] AI passed email for broad query - overriding to check both calendars'
      );
      // Only force multi if a usable secondary exists; otherwise, keep primary
      calendarIdToUse = hasUsableSecondary
        ? undefined
        : context.accounts.primary.email;
    }

    // Clamp timeMin to NOW for non-specific period queries, unless user asks for beginning of period
    if (
      args?.timeMin &&
      isNonSpecificPeriodQuery(userMessage) &&
      !mentionsBeginningOfPeriod(userMessage)
    ) {
      const nowIso = new Date().toISOString();
      if (new Date(args.timeMin) < new Date(nowIso)) {
        console.log(
          '🕒 [timeRange] Clamping timeMin to now for non-specific query:',
          { before: args.timeMin, now: nowIso }
        );
        args.timeMin = nowIso;
      }
    }

    const targetAccount = determineTargetAccount(
      userMessage,
      context.accounts,
      calendarIdToUse
    );

    console.log('🔍 [getEventsMultiAccount] User message:', userMessage);
    console.log(
      '🔍 [getEventsMultiAccount] Target account determination:',
      targetAccount === 'both'
        ? 'both accounts'
        : targetAccount
        ? `${targetAccount.title} (${targetAccount.email})`
        : 'none'
    );

    if (targetAccount === 'both') {
      if (!hasUsableSecondary) {
        // Safety: if no secondary, fall back to primary-only
        onProgress?.({
          type: 'progress',
          content: `Fetching events from your ${context.accounts.primary.title} calendar...`,
        });
        const events = await getEvents(
          context.accounts.primary.creds,
          context.accounts.primary.email,
          args.timeMin,
          args.timeMax
        );
        return {
          events,
          count: events.length,
          account: {
            title: context.accounts.primary.title,
            email: context.accounts.primary.email,
          },
        };
      }
      // Helper to fetch one calendar safely so one failure doesn't mask the other
      const fetchEventsSafe = async (
        title: string,
        creds: any,
        email: string,
        timeMin: string,
        timeMax: string
      ): Promise<{ events: any[] | null; error: Error | null }> => {
        try {
          const events = await getEvents(creds, email, timeMin, timeMax);
          return { events, error: null };
        } catch (e: any) {
          console.error(
            `⚠️ [getEventsMultiAccount] Failed to fetch ${title} calendar:`,
            e?.message || e
          );
          return { events: null, error: e };
        }
      };

      // Fetch from both calendars
      onProgress?.({
        type: 'progress',
        content: 'Checking both your calendars...',
      });

      const [primaryRes, secondaryRes] = await Promise.all([
        fetchEventsSafe(
          context.accounts.primary.title,
          context.accounts.primary.creds,
          context.accounts.primary.email,
          args.timeMin,
          args.timeMax
        ),
        context.accounts.secondary && hasUsableSecondary
          ? fetchEventsSafe(
              context.accounts.secondary.title,
              context.accounts.secondary.creds,
              context.accounts.secondary.email,
              args.timeMin,
              args.timeMax
            )
          : Promise.resolve({ events: [], error: null }),
      ]);

      let primaryEvents = primaryRes.events || [];
      let secondaryEvents = secondaryRes.events || [];
      const primaryCount = primaryEvents.length;
      const secondaryCount = secondaryEvents.length;

      // Apply filtering for non-specific period queries: show only ongoing/future
      const now = new Date();
      if (
        isNonSpecificPeriodQuery(userMessage) &&
        !mentionsBeginningOfPeriod(userMessage)
      ) {
        primaryEvents = filterToOngoingAndFuture(primaryEvents, now);
        secondaryEvents = filterToOngoingAndFuture(secondaryEvents, now);
      }

      onProgress?.({
        type: 'progress',
        content: secondaryRes.error
          ? `Found ${primaryCount} events in your ${
              context.accounts.primary.title
            } calendar. Your ${
              context.accounts.secondary?.title || 'secondary'
            } calendar could not be fetched (${
              secondaryRes.error?.message || 'error'
            }).`
          : `Found ${primaryCount} events in your ${
              context.accounts.primary.title
            } calendar and ${secondaryCount} events in your ${
              context.accounts.secondary?.title || 'secondary'
            } calendar`,
      });

      // Check for conflicts between calendars
      // Annotate ongoing status for response rendering
      const nowForFlags = new Date();
      primaryEvents = annotateOngoing(primaryEvents, nowForFlags);
      secondaryEvents = annotateOngoing(secondaryEvents, nowForFlags);

      const conflicts = detectConflicts(
        primaryEvents,
        secondaryEvents,
        context.accounts
      );

      if (conflicts.length > 0) {
        console.log(
          '🔧 [DEBUG detectConflicts] =============================='
        );
        console.log(
          '🔧 [DEBUG] Detected conflicts:',
          JSON.stringify(conflicts, null, 2)
        );
        console.log(
          '🔧 [DEBUG detectConflicts] =============================='
        );

        onProgress?.({
          type: 'progress',
          content: `Detected ${conflicts.length} scheduling conflict(s) between calendars`,
        });
      }

      return {
        events: primaryEvents.concat(secondaryEvents),
        count: primaryCount + secondaryCount,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
        breakdown: {
          primary: {
            title: context.accounts.primary.title,
            email: context.accounts.primary.email,
            events: primaryEvents,
            count: primaryCount,
          },
          secondary: context.accounts.secondary
            ? {
                title: context.accounts.secondary.title,
                email: context.accounts.secondary.email,
                events: secondaryEvents,
                count: secondaryCount,
                error: secondaryRes.error
                  ? secondaryRes.error.message
                  : undefined,
              }
            : null,
        },
        // ✨ Make conflict details available to AI for rescheduling
        conflictDetails:
          conflicts.length > 0
            ? {
                message: `SCHEDULING CONFLICTS DETECTED: Use these real event details for any rescheduling:`,
                conflicts: conflicts.map((conflict) => ({
                  primaryEvent: {
                    id: conflict.primaryEvent.id,
                    summary: conflict.primaryEvent.summary,
                    calendarEmail: conflict.primaryEvent.calendarEmail,
                    start: conflict.primaryEvent.start,
                    end: conflict.primaryEvent.end,
                  },
                  secondaryEvent: {
                    id: conflict.secondaryEvent.id,
                    summary: conflict.secondaryEvent.summary,
                    calendarEmail: conflict.secondaryEvent.calendarEmail,
                    start: conflict.secondaryEvent.start,
                    end: conflict.secondaryEvent.end,
                  },
                })),
              }
            : null,
      };
    } else if (targetAccount && typeof targetAccount === 'object') {
      // Fetch from specific account
      onProgress?.({
        type: 'progress',
        content: `Fetching events from your ${targetAccount.title} calendar...`,
      });
      try {
        let events = await getEvents(
          targetAccount.creds,
          targetAccount.email,
          ensureRfc3339(args.timeMin)!,
          ensureRfc3339(args.timeMax)!
        );

        // Apply filtering for non-specific period queries: show only ongoing/future
        const now = new Date();
        if (
          isNonSpecificPeriodQuery(userMessage) &&
          !mentionsBeginningOfPeriod(userMessage)
        ) {
          events = filterToOngoingAndFuture(events, now);
        }

        // Annotate ongoing status
        events = annotateOngoing(events, new Date());

        onProgress?.({
          type: 'progress',
          content: `Found ${events.length} events in your ${targetAccount.title} calendar`,
        });

        return {
          events,
          count: events.length,
          account: {
            title: targetAccount.title,
            email: targetAccount.email,
          },
        };
      } catch (e: any) {
        const message = e?.message || 'Unknown error';
        console.error(
          `⚠️ [getEventsMultiAccount] Failed to fetch ${targetAccount.title} calendar:`,
          message
        );
        // If specific account fails and there is a secondary available, try fallback once
        if (
          context.accounts.secondary &&
          targetAccount.email === context.accounts.primary.email
        ) {
          try {
            onProgress?.({
              type: 'progress',
              content: `Primary calendar fetch failed (${message}). Trying your ${context.accounts.secondary.title} calendar...`,
            });
            const fallbackEvents = await getEvents(
              context.accounts.secondary.creds,
              context.accounts.secondary.email,
              ensureRfc3339(args.timeMin)!,
              ensureRfc3339(args.timeMax)!
            );
            return {
              events: fallbackEvents,
              count: fallbackEvents.length,
              account: {
                title: context.accounts.secondary.title,
                email: context.accounts.secondary.email,
              },
              warning: `Primary calendar failed with: ${message}. Showing results from ${context.accounts.secondary.title} calendar instead`,
            };
          } catch (fallbackErr: any) {
            console.error(
              `⚠️ [getEventsMultiAccount] Fallback to secondary failed as well:`,
              fallbackErr?.message || fallbackErr
            );
          }
        }
        const requiresReauth =
          message.includes('invalid_grant') ||
          e?.response?.data?.error === 'invalid_grant';
        onProgress?.({
          type: 'progress',
          content: `Could not fetch your ${
            targetAccount.title
          } calendar (${message}).${
            requiresReauth ? ' Please reconnect this account.' : ''
          }`,
        });
        return {
          events: [],
          count: 0,
          account: {
            title: targetAccount.title,
            email: targetAccount.email,
          },
          error: { message, requiresReauth },
        };
      }
    } else {
      throw new Error('Unable to determine target account');
    }
  } catch (error: any) {
    console.error('[Calendar Handler] Get events multi-account error:', error);

    onProgress?.({
      type: 'error',
      content: 'Error fetching calendar events',
    });

    throw new Error(`Failed to get events: ${error.message}`);
  }
};

// Calendar function handlers
export const calendarHandlers = {
  getEvents: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log('🚨 [getEvents] =================================');
      console.log(
        '🚨 [getEvents] AI called getEvents with args:',
        JSON.stringify(args, null, 2)
      );
      console.log('🚨 [getEvents] calendarId present:', !!args.calendarId);
      console.log('🚨 [getEvents] calendarId value:', args.calendarId);
      console.log(
        '🚨 [getEvents] Context accounts available:',
        !!context?.accounts
      );
      console.log(
        '🚨 [getEvents] Primary account:',
        context?.accounts?.primary?.title
      );
      console.log(
        '🚨 [getEvents] Secondary account:',
        context?.accounts?.secondary?.title
      );
      console.log('🚨 [getEvents] =================================');

      // If we have session context with multiple accounts, use the enhanced handler
      if (context?.accounts) {
        console.log('🚨 [getEvents] ✅ Using MULTI-ACCOUNT handler');
        // Sanitize time range before passing down
        const sanitizedArgs = {
          ...args,
          timeMin: ensureRfc3339(args.timeMin),
          timeMax: ensureRfc3339(args.timeMax),
        };
        return await getEventsMultiAccount(sanitizedArgs, context, onProgress);
      }

      // Legacy single-account handling
      console.log(
        '🚨 [getEvents] ❌ Using LEGACY single-account handler (context missing)'
      );
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
        ensureRfc3339(args.timeMin)!,
        ensureRfc3339(args.timeMax)!
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
        content: 'Error fetching calendar events',
      });

      throw new Error(`Failed to get events: ${error.message}`);
    }
  },

  createEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    // Determine which account to use for creating the event
    let targetAccount = null;
    let targetCreds = creds;
    let targetCalendarId = args.calendarId || 'primary';

    if (context?.accounts) {
      const userMessage =
        context.history[context.history.length - 1]?.content || '';
      const determinedAccount = determineTargetAccount(
        userMessage,
        context.accounts
      );

      if (determinedAccount && typeof determinedAccount === 'object') {
        targetAccount = determinedAccount;
        targetCreds = determinedAccount.creds;
        targetCalendarId = determinedAccount.email;

        onProgress?.({
          type: 'progress',
          content: `Creating event in your ${determinedAccount.title} calendar...`,
        });
      } else {
        // Default to primary account
        targetAccount = context.accounts.primary;
        targetCreds = context.accounts.primary.creds;
        targetCalendarId = context.accounts.primary.email;

        onProgress?.({
          type: 'progress',
          content: `Creating event in your ${context.accounts.primary.title} calendar...`,
        });
      }
    }

    // First check if the time slot is available using freeBusy API
    onProgress?.({
      type: 'progress',
      content: 'Checking calendar availability...',
    });

    const availabilityResult = await getAvailability(
      targetCreds,
      args.start,
      args.end,
      [targetCalendarId]
    );

    if (!availabilityResult.available) {
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

        const altAvailability = await getAvailability(
          targetCreds,
          altStartISO,
          altEndISO,
          [targetCalendarId]
        );
        if (altAvailability.available) {
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
        conflictingEvents: availabilityResult.busyPeriods,
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
        })}. You already have ${
          availabilityResult.busyPeriods.length
        } conflicting period${
          availabilityResult.busyPeriods.length > 1 ? 's' : ''
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
      // Merge attendees and additionalEmails into a unified attendee list
      let attendeeEmails: string[] = [];
      if (Array.isArray(args.attendees) && args.attendees.length > 0) {
        attendeeEmails.push(
          ...args.attendees
            .map((a: any) => (typeof a === 'string' ? a : a.email))
            .filter(Boolean)
        );
      }
      if (
        Array.isArray(args.additionalEmails) &&
        args.additionalEmails.length > 0
      ) {
        attendeeEmails.push(...args.additionalEmails);
      }
      attendeeEmails = Array.from(new Set(attendeeEmails));

      const result = await createEvent(targetCreds, targetCalendarId, {
        start: args.start,
        end: args.end,
        summary: args.summary,
        timeZone: args.timeZone || 'America/Los_Angeles',
        attendees: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      });

      onProgress?.({
        type: 'progress',
        content: 'Event created successfully!',
      });

      // Optionally send a follow-up email to explicitly provided additional emails
      if (
        Array.isArray(args.additionalEmails) &&
        args.additionalEmails.length > 0
      ) {
        try {
          const eventStart = new Date(args.start);
          const eventEnd = new Date(args.end);
          const timeZone = args.timeZone || 'America/Los_Angeles';
          const locale: Intl.LocalesArgument = 'en-US';
          const startText = eventStart.toLocaleString(locale, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone,
          });
          const endText = eventEnd.toLocaleString(locale, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone,
          });
          const dateText = eventStart.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone,
          });

          for (const to of args.additionalEmails) {
            onProgress?.({
              type: 'progress',
              content: `Sending invite email to ${to}...`,
            });
            await sendEmail(
              {
                to,
                from:
                  (targetAccount && targetAccount.email) || targetCalendarId,
                subject: `Invitation: ${args.summary} on ${dateText}`,
                body: `Hi,

I'd like to invite you to "${args.summary}" on ${dateText} from ${startText} to ${endText}.

I've added this to my calendar and you should receive a calendar invite as well. If the time doesn't work, let me know and we can adjust.

Thanks!`,
              },
              targetCreds,
              onProgress
            );
          }
        } catch (e: any) {
          console.error(
            '[Calendar Handler] Failed to send follow-up email(s):',
            e?.message || e
          );
        }
      }

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
    onProgress?: (update: any) => void,
    context?: SessionContext
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
      onProgress,
      context
    );
  },

  updateEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      // Determine which account to use for updating the event
      let targetCreds = creds;
      let targetCalendarId = args.calendarId || 'primary';

      if (context?.accounts) {
        const userMessage =
          context.history[context.history.length - 1]?.content || '';
        const determinedAccount = determineTargetAccount(
          userMessage,
          context.accounts
        );

        if (determinedAccount && typeof determinedAccount === 'object') {
          targetCreds = determinedAccount.creds;
          targetCalendarId = determinedAccount.email;

          onProgress?.({
            type: 'progress',
            content: `Updating event in your ${determinedAccount.title} calendar...`,
          });
        } else {
          // Default to primary account
          targetCreds = context.accounts.primary.creds;
          targetCalendarId = context.accounts.primary.email;
        }
      }

      onProgress?.({
        type: 'progress',
        content: `Updating event "${args.eventId}"...`,
      });

      const result = await updateEvent(
        targetCreds,
        targetCalendarId,
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
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    console.log('[Calendar Handler] deleteEvent called with args:', args);
    console.log(
      '[Calendar Handler] deleteEvent called with creds keys:',
      creds ? Object.keys(creds) : 'null'
    );

    try {
      // Helper to judge whether an ID looks like a real Google Calendar event ID
      const looksLikeGoogleEventId = (id: string | undefined): boolean => {
        if (!id) return false;
        // Typical Google event IDs are lowercase base32-ish strings, often 10+ chars.
        // Reject purely numeric, very short, or strings with spaces/uppercase.
        if (/^\d+$/.test(id)) return false;
        if (id.length < 8) return false;
        if (/\s/.test(id)) return false;
        if (/[A-Z]/.test(id)) return false;
        return /^[a-z0-9_-]+$/.test(id);
      };

      // If the eventId is missing or suspicious, try to infer it from recent context
      if (!looksLikeGoogleEventId(args?.eventId) && context?.history) {
        try {
          const recentMessages = context.history.slice(-20);
          const userMessage = recentMessages
            .slice()
            .reverse()
            .find((m: any) => m.role === 'user')?.content as string | undefined;
          const assistantMessage = recentMessages
            .slice()
            .reverse()
            .find((m: any) => m.role === 'assistant')?.content as
            | string
            | undefined;

          // Gather recent events from the latest tool results containing an events array
          const candidateEvents: any[] = [];
          for (let i = recentMessages.length - 1; i >= 0; i--) {
            const m = recentMessages[i];
            if (m.role === 'tool' && typeof m.content === 'string') {
              try {
                const parsed = JSON.parse(m.content);
                if (parsed && Array.isArray(parsed.events)) {
                  for (const ev of parsed.events) {
                    if (ev && ev.id && ev.summary) candidateEvents.push(ev);
                  }
                  // Stop after the most recent events payload
                  break;
                }
              } catch (_) {
                // Not JSON from events tool; skip
              }
            }
          }

          const textForMatching = `${userMessage || ''} ${
            assistantMessage || ''
          }`
            .toLowerCase()
            .trim();

          const extractKeywords = (text: string): string[] => {
            const kws: string[] = [];
            const quoted = text.match(/"([^"]+)"/g);
            if (quoted) kws.push(...quoted.map((q) => q.slice(1, -1)));
            // Heuristics: look for common tokens that appeared in recent queries/answers
            if (text.includes('vlada')) kws.push('vlada');
            if (text.includes('meeting')) kws.push('meeting');
            if (text.includes('coffee')) kws.push('coffee');
            if (text.includes('doctor')) kws.push('doctor');
            return Array.from(new Set(kws.filter(Boolean)));
          };

          const keywords = extractKeywords(textForMatching);
          if (candidateEvents.length > 0 && keywords.length > 0) {
            const matches = candidateEvents.filter((ev) => {
              const s = `${ev.summary || ''} ${
                ev.description || ''
              }`.toLowerCase();
              return keywords.every((k) => s.includes(k));
            });
            let chosen =
              matches[0] ||
              candidateEvents.find((ev) => {
                const s = `${ev.summary || ''}`.toLowerCase();
                return keywords.some((k) => s.includes(k));
              });
            if (chosen && looksLikeGoogleEventId(chosen.id)) {
              console.log(
                '[Calendar Handler] Inferred missing/invalid eventId from recent events:',
                chosen.summary,
                chosen.id
              );
              args.eventId = chosen.id;
              // Prefer the calendar email from the event if present (multi-account flows may add it)
              if (chosen.calendarEmail && !args.calendarId) {
                args.calendarId = chosen.calendarEmail;
              }
            }
          }
        } catch (inferErr) {
          console.log(
            '[Calendar Handler] Unable to infer eventId from context:',
            inferErr
          );
        }
      }

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

      // Determine which account to use for deleting the event
      let targetCreds = creds;
      let targetCalendarId = args.calendarId || 'primary';

      if (context?.accounts) {
        const userMessage =
          context.history[context.history.length - 1]?.content || '';
        const determinedAccount = determineTargetAccount(
          userMessage,
          context.accounts
        );

        if (determinedAccount && typeof determinedAccount === 'object') {
          targetCreds = determinedAccount.creds;
          targetCalendarId = determinedAccount.email;
        } else {
          // Default to primary account
          targetCreds = context.accounts.primary.creds;
          targetCalendarId = context.accounts.primary.email;
        }
      }

      const result = await deleteEvent(
        targetCreds,
        targetCalendarId,
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
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      // Determine which account to use for deleting events
      let targetCreds = creds;
      let targetCalendarId = args.calendarId || 'primary';

      if (context?.accounts) {
        const userMessage =
          context.history[context.history.length - 1]?.content || '';
        const determinedAccount = determineTargetAccount(
          userMessage,
          context.accounts
        );

        if (determinedAccount && typeof determinedAccount === 'object') {
          targetCreds = determinedAccount.creds;
          targetCalendarId = determinedAccount.email;
        } else {
          // Default to primary account
          targetCreds = context.accounts.primary.creds;
          targetCalendarId = context.accounts.primary.email;
        }
      }

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
            targetCreds,
            targetCalendarId,
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
    try {
      console.log('🔍 [getAvailability Handler] Starting with params:', {
        timeMin: ensureRfc3339(args.timeMin),
        timeMax: ensureRfc3339(args.timeMax),
        calendarIds: args.calendarIds,
        credsKeys: creds ? Object.keys(creds) : 'null',
      });

      onProgress?.({
        type: 'progress',
        content: 'Checking calendar availability...',
      });

      const result = await getAvailability(
        creds,
        ensureRfc3339(args.timeMin)!,
        ensureRfc3339(args.timeMax)!,
        args.calendarIds
      );

      const availabilityMessage = result.available
        ? 'Time slot is available!'
        : `Time slot is not available. Found ${result.busyPeriods.length} conflicting event(s).`;

      onProgress?.({
        type: 'progress',
        content: availabilityMessage,
      });

      return {
        ...result,
        message: availabilityMessage,
      };
    } catch (error: any) {
      console.error('[Calendar Handler] Get availability error:', error);

      onProgress?.({
        type: 'error',
        content: `Failed to check availability: ${error.message}`,
      });

      return {
        error: true,
        message: error.message,
        details: error,
        available: false,
        busyPeriods: [],
        calendars: {},
      };
    }
  },
};
