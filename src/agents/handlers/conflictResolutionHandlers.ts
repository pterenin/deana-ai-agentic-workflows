import {
  getAvailability,
  updateEvent,
  getEvents,
} from '../../activities/calendar';
import { SessionContext } from '../types';

// Helper function to generate alternative time slots around an event
function generateAlternativeSlots(
  originalStart: string,
  originalEnd: string,
  displayTimeZone?: string
): any[] {
  const startTime = new Date(originalStart);
  const endTime = new Date(originalEnd);
  const duration = endTime.getTime() - startTime.getTime();

  const alternatives = [
    {
      label: '1 hour earlier',
      start: new Date(startTime.getTime() - 60 * 60000),
      end: new Date(startTime.getTime() - 60 * 60000 + duration),
    },
    {
      label: '1 hour later',
      start: new Date(endTime.getTime() + 60 * 60000),
      end: new Date(endTime.getTime() + 60 * 60000 + duration),
    },
    {
      label: '2 hours later',
      start: new Date(endTime.getTime() + 120 * 60000),
      end: new Date(endTime.getTime() + 120 * 60000 + duration),
    },
  ];

  return alternatives.map((alt) => ({
    ...alt,
    startISO: alt.start.toISOString(),
    endISO: alt.end.toISOString(),
    timeDisplay: `${alt.start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: displayTimeZone,
    })} - ${alt.end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: displayTimeZone,
    })}`,
  }));
}

export const conflictResolutionHandlers = {
  proposeRescheduleOptions: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '🔧 [DEBUG proposeRescheduleOptions] =============================='
      );
      console.log('🔧 [DEBUG] Input args:', JSON.stringify(args, null, 2));
      console.log(
        '🔧 [DEBUG] Context accounts:',
        context?.accounts
          ? {
              primary: {
                title: context.accounts.primary.title,
                email: context.accounts.primary.email,
              },
              secondary: context.accounts.secondary
                ? {
                    title: context.accounts.secondary.title,
                    email: context.accounts.secondary.email,
                  }
                : null,
            }
          : 'No accounts'
      );
      console.log(
        '🔧 [DEBUG proposeRescheduleOptions] =============================='
      );

      onProgress?.({
        type: 'progress',
        content: `Finding alternative times for "${args.eventSummary}"...`,
      });

      // Generate 3 alternative time slots in the user's timezone (fallback to LA)
      const userTz = context?.userTimeZone || 'America/Los_Angeles';
      const alternatives = generateAlternativeSlots(
        args.originalStart,
        args.originalEnd,
        userTz
      );

      // Check availability for each alternative across both calendars
      const availableAlternatives = [];

      for (let i = 0; i < alternatives.length; i++) {
        const alt = alternatives[i];

        onProgress?.({
          type: 'progress',
          content: `Checking availability for option ${i + 1}: ${alt.label}...`,
        });

        // Check availability in both calendars
        let isAvailable = true;

        if (context?.accounts) {
          // Check primary calendar
          const primaryAvailability = await getAvailability(
            context.accounts.primary.creds,
            alt.startISO,
            alt.endISO,
            [context.accounts.primary.email]
          );

          // Check secondary calendar
          const secondaryAvailability = context.accounts.secondary
            ? await getAvailability(
                context.accounts.secondary.creds,
                alt.startISO,
                alt.endISO,
                [context.accounts.secondary.email]
              )
            : { available: true };

          isAvailable =
            primaryAvailability.available && secondaryAvailability.available;
        }

        if (isAvailable) {
          availableAlternatives.push({
            option: i + 1,
            label: alt.label,
            startISO: alt.startISO,
            endISO: alt.endISO,
            timeDisplay: alt.timeDisplay,
          });
        }
      }

      onProgress?.({
        type: 'progress',
        content: `Found ${availableAlternatives.length} available alternative time slots`,
      });

      // Persist reschedule context for multi-message flows
      if (context) {
        (context as any).rescheduleContext = {
          eventId: args.conflictingEventId,
          eventSummary: args.eventSummary,
          calendarEmail: args.calendarEmail,
          originalStart: args.originalStart,
          originalEnd: args.originalEnd,
          proposedOptions: availableAlternatives,
        };
      }

      return {
        success: true,
        conflictingEvent: {
          id: args.conflictingEventId,
          summary: args.eventSummary,
          originalStart: args.originalStart,
          originalEnd: args.originalEnd,
        },
        alternatives: availableAlternatives,
        message: `I found ${
          availableAlternatives.length
        } available times to reschedule "${args.eventSummary}":

${availableAlternatives
  .map((alt) => `${alt.option}. ${alt.label}: ${alt.timeDisplay}`)
  .join('\n')}

Which option would you prefer, or would you like to suggest a different time?`,
      };
    } catch (error: any) {
      console.error(
        '[Conflict Resolution] Propose reschedule options error:',
        error
      );
      return {
        error: true,
        message: `Failed to find alternative times: ${error.message}`,
      };
    }
  },

  rescheduleEvent: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      // Helper: determine if a datetime string includes timezone info
      const hasTimezone = (s: string): boolean => /Z|[+-]\d{2}:?\d{2}$/.test(s);

      // Helper: get timezone offset in minutes for a given UTC date and IANA tz
      const getTzOffsetMinutes = (utcDate: Date, timeZone: string): number => {
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone,
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const parts = dtf.formatToParts(utcDate);
        const filled: Record<string, string> = {};
        for (const p of parts) {
          if (p.type !== 'literal') filled[p.type] = p.value;
        }
        const asTs = Date.UTC(
          Number(filled.year),
          Number(filled.month) - 1,
          Number(filled.day),
          Number(filled.hour),
          Number(filled.minute),
          Number(filled.second)
        );
        // local(tz) = utc + offset → offset = local - utc
        return Math.round((asTs - utcDate.getTime()) / 60000);
      };

      // Helper: convert a naive local time string (YYYY-MM-DDTHH:mm[:ss]) in tz → ISO Z
      const toZonedIso = (localStr: string, timeZone: string): string => {
        const m = localStr.match(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
        );
        if (!m) {
          // Fallback: let Date parse and hope it has tz; then toISOString
          return new Date(localStr).toISOString();
        }
        const [_, y, mo, da, hh, mm, ss = '00'] = m;
        const utcGuess = Date.UTC(
          Number(y),
          Number(mo) - 1,
          Number(da),
          Number(hh),
          Number(mm),
          Number(ss)
        );
        const offsetMin = getTzOffsetMinutes(new Date(utcGuess), timeZone);
        const trueUtcTs = utcGuess - offsetMin * 60000;
        return new Date(trueUtcTs).toISOString();
      };

      // Helper: build an ISO window in a TZ from relative day offsets
      const buildWindowIso = (
        base: Date,
        timeZone: string,
        daysBack: number,
        daysForward: number
      ): { min: string; max: string } => {
        const baseLocal = new Date(base);
        const startLocal = new Date(baseLocal);
        startLocal.setDate(startLocal.getDate() - daysBack);
        const endLocal = new Date(baseLocal);
        endLocal.setDate(endLocal.getDate() + daysForward);
        const pad = (n: number) => String(n).padStart(2, '0');
        const toLocalYmd = (d: Date) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const min = toZonedIso(`${toLocalYmd(startLocal)}T00:00:00`, timeZone);
        const max = toZonedIso(`${toLocalYmd(endLocal)}T23:59:59`, timeZone);
        return { min, max };
      };

      const resolveCalendarEmail = (
        input: string | undefined,
        ctx?: SessionContext
      ): string | undefined => {
        if (!ctx?.accounts) return input;
        const lower = (input || '').toLowerCase();
        const primary = ctx.accounts.primary.email;
        const secondary = ctx.accounts.secondary?.email;
        if (input && (input === primary || input === secondary)) return input;
        if (lower.includes('work') && secondary) return secondary;
        if (lower.includes('personal') || lower.includes('primary'))
          return primary;
        // If input looks like an email but doesn't match, prefer secondary if present for "work" flows
        return input && input.includes('@') ? input : secondary || primary;
      };

      console.log('🔧 [DEBUG rescheduleEvent] ==============================');
      console.log('🔧 [DEBUG] Input args:', JSON.stringify(args, null, 2));

      onProgress?.({
        type: 'progress',
        content: `Rescheduling "${args.eventSummary}" to new time...`,
      });

      // Final availability check
      onProgress?.({
        type: 'progress',
        content: 'Performing final availability check...',
      });

      // Normalize times to RFC3339 and restore persisted context if needed
      const userTz = (context as any)?.userTimeZone || 'America/Los_Angeles';
      const persisted = (context as any)?.rescheduleContext;
      if (persisted) {
        args.eventSummary = args.eventSummary || persisted.eventSummary;
        args.calendarEmail = args.calendarEmail || persisted.calendarEmail;
        if (!args.eventId || /work_event_id|test|dummy/i.test(args.eventId)) {
          args.eventId = persisted.eventId;
        }
      }
      const normalizedStart = hasTimezone(args.newStart)
        ? args.newStart
        : toZonedIso(args.newStart, userTz);
      const normalizedEnd = hasTimezone(args.newEnd)
        ? args.newEnd
        : toZonedIso(args.newEnd, userTz);

      let isAvailable = true;
      if (context?.accounts) {
        const primaryCheck = await getAvailability(
          context.accounts.primary.creds,
          normalizedStart,
          normalizedEnd,
          [context.accounts.primary.email]
        );

        const hasUsableSecondary = !!(
          context.accounts.secondary &&
          context.accounts.secondary.email &&
          context.accounts.secondary.creds &&
          (context.accounts.secondary.creds as any).access_token
        );

        const secondaryCheck = hasUsableSecondary
          ? await getAvailability(
              context.accounts.secondary!.creds,
              normalizedStart,
              normalizedEnd,
              [context.accounts.secondary!.email]
            )
          : { available: true };

        isAvailable = primaryCheck.available && secondaryCheck.available;
      }

      if (!isAvailable) {
        return {
          error: true,
          message:
            'Sorry, that time slot is no longer available. Please choose a different time.',
        };
      }

      // Find the correct credentials for the calendar containing the event
      let targetCreds = creds;
      // Force calendar email from persisted context if present
      let resolvedCalendarEmail = resolveCalendarEmail(
        args.calendarEmail,
        context
      );
      const persistedForCalendar = (context as any)?.rescheduleContext
        ?.calendarEmail;
      if (persistedForCalendar) {
        resolvedCalendarEmail = resolveCalendarEmail(
          persistedForCalendar,
          context
        );
      }
      if (context?.accounts) {
        if (resolvedCalendarEmail === context.accounts.primary.email) {
          targetCreds = context.accounts.primary.creds;
          console.log(
            '🔧 [DEBUG] Using PRIMARY calendar creds for:',
            resolvedCalendarEmail
          );
        } else if (
          context.accounts.secondary &&
          resolvedCalendarEmail === context.accounts.secondary.email
        ) {
          targetCreds = context.accounts.secondary.creds;
          console.log(
            '🔧 [DEBUG] Using SECONDARY calendar creds for:',
            resolvedCalendarEmail
          );
        } else {
          // Fallback: if only primary exists, force to primary
          if (!context.accounts.secondary) {
            resolvedCalendarEmail = context.accounts.primary.email;
            targetCreds = context.accounts.primary.creds;
            console.log(
              '🔧 [DEBUG] Forcing calendar to PRIMARY (single-account):',
              resolvedCalendarEmail
            );
          } else {
            console.log(
              '🔧 [DEBUG] ⚠️  No matching calendar found for:',
              args.calendarEmail
            );
            console.log('🔧 [DEBUG] Available calendars:');
            console.log(
              '🔧 [DEBUG] - Primary:',
              context.accounts.primary.email
            );
            console.log(
              '🔧 [DEBUG] - Secondary:',
              context.accounts.secondary?.email || 'none'
            );
          }
        }
      }

      // Try to resolve the correct event ID from the original event time/context
      let resolvedEventId = args.eventId;
      if (resolvedCalendarEmail && targetCreds) {
        try {
          // Build search windows. Prefer ORIGINAL event day; otherwise widen around now.
          const originalStartISO = (context as any)?.rescheduleContext
            ?.originalStart;
          const now = new Date();
          const windows: Array<{ min: string; max: string; label: string }> =
            [];

          if (originalStartISO) {
            const ref = new Date(originalStartISO);
            const y = ref.getUTCFullYear();
            const mo = ref.getUTCMonth() + 1;
            const da = ref.getUTCDate();
            const pad = (n: number) => String(n).padStart(2, '0');
            const dayStartLocal = `${y}-${pad(mo)}-${pad(da)}T00:00:00`;
            const dayEndLocal = `${y}-${pad(mo)}-${pad(da)}T23:59:59`;
            windows.push({
              min: toZonedIso(dayStartLocal, userTz),
              max: toZonedIso(dayEndLocal, userTz),
              label: 'original-day',
            });
          }

          // Always include a relative window around now to catch direct reschedules without original context
          const wk = buildWindowIso(now, userTz, 7, 7);
          windows.push({ ...wk, label: '±7d-now' });

          onProgress?.({
            type: 'progress',
            content: 'Locating the exact event to reschedule...',
          });

          const requestedLower = (args.eventSummary || '').toLowerCase();
          const tokens: string[] = Array.from(
            new Set(
              requestedLower
                .split(/[^a-z0-9]+/g)
                .filter((t: string) => t && t.length > 2)
            )
          );

          const score = (sumLower: string, eventStartIso: string): number => {
            const tokenHits: number = tokens.reduce(
              (acc: number, t: string) => acc + (sumLower.includes(t) ? 1 : 0),
              0
            );
            const startTs = eventStartIso
              ? new Date(eventStartIso).getTime()
              : 0;
            const proximity = Math.abs(startTs - now.getTime());
            // Higher token hits, lower proximity is better
            return tokenHits * 1000000000 - proximity;
          };

          let candidates: any[] = [];

          for (const w of windows) {
            let eventsWin: any[] = [];
            try {
              eventsWin = await getEvents(
                targetCreds,
                resolvedCalendarEmail,
                w.min,
                w.max
              );
            } catch (e) {
              // If chosen calendar fails, try primary as fallback
              if (
                context?.accounts?.primary?.email &&
                resolvedCalendarEmail !== context.accounts.primary.email
              ) {
                console.warn(
                  '⚠️ [DEBUG] Retry event search with PRIMARY calendar'
                );
                eventsWin = await getEvents(
                  context.accounts.primary.creds,
                  context.accounts.primary.email,
                  w.min,
                  w.max
                );
                resolvedCalendarEmail = context.accounts.primary.email;
                targetCreds = context.accounts.primary.creds;
              } else {
                throw e;
              }
            }
            candidates.push(...eventsWin);
            // Early stop if too many
            if (candidates.length > 200) break;
          }

          // Evaluate candidates
          let best: any = null;
          let bestScore = -Infinity;
          for (const e of candidates) {
            const sumLower = (e.summary || '').toLowerCase();
            const startIso = e.start?.dateTime || e.start?.date || '';
            const s = score(sumLower, startIso);
            if (s > bestScore) {
              bestScore = s;
              best = e;
            }
          }

          const idExists = candidates.some((e: any) => e.id === args.eventId);
          if (!idExists && best?.id) {
            resolvedEventId = best.id;
            console.log(
              '🔧 [DEBUG] Resolved eventId by widened search:',
              resolvedEventId,
              'summary:',
              best.summary,
              'start:',
              best.start?.dateTime || best.start?.date
            );
          } else if (!idExists) {
            console.warn(
              '⚠️ [DEBUG] Could not resolve eventId by widened search'
            );
          }
        } catch (searchErr) {
          console.error(
            '⚠️ [DEBUG] Error while resolving eventId by search:',
            searchErr
          );
        }
      }

      // If we still have no usable eventId, surface a clear message requiring user input
      if (!resolvedEventId || /^(test|dummy)$/i.test(resolvedEventId)) {
        return {
          error: true,
          needsUserInput: true,
          message:
            "I couldn't locate the exact event to move. Please confirm the event title and which calendar it’s in (Personal or Work), or say 'list my events' for today so I can match it.",
        };
      }

      console.log('🔧 [DEBUG] Final rescheduling parameters:');
      console.log('🔧 [DEBUG] - Event ID:', resolvedEventId);
      console.log('🔧 [DEBUG] - Calendar Email:', resolvedCalendarEmail);
      console.log('🔧 [DEBUG] - New Start:', normalizedStart);
      console.log('🔧 [DEBUG] - New End:', normalizedEnd);
      console.log(
        '🔧 [DEBUG] - Target Creds Keys:',
        Object.keys(targetCreds || {})
      );

      // Update the event
      const result = await updateEvent(
        targetCreds,
        resolvedCalendarEmail || args.calendarEmail,
        resolvedEventId,
        {
          start: normalizedStart,
          end: normalizedEnd,
          summary: args.eventSummary,
        }
      );

      onProgress?.({
        type: 'progress',
        content: 'Event successfully rescheduled!',
      });

      // Persist last modified event for follow-up edits like duration changes
      try {
        if (context) {
          (context as any).lastModifiedEvent = {
            id: resolvedEventId,
            calendarEmail: resolvedCalendarEmail || args.calendarEmail,
            summary: args.eventSummary,
            newStart: normalizedStart,
            newEnd: normalizedEnd,
          };
        }
      } catch (_) {}

      return {
        success: true,
        message: `Perfect! I've rescheduled "${
          args.eventSummary
        }" to ${new Date(args.newStart).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })} - ${new Date(args.newEnd).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}. The conflict has been resolved!`,
        rescheduledEvent: {
          id: args.eventId,
          summary: args.eventSummary,
          newStart: args.newStart,
          newEnd: args.newEnd,
        },
      };
    } catch (error: any) {
      console.error('[Conflict Resolution] Reschedule event error:', error);
      return {
        error: true,
        message: `Failed to reschedule event: ${error.message}`,
      };
    }
  },

  checkTimeSlotAvailability: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      onProgress?.({
        type: 'progress',
        content: 'Checking availability across all calendars...',
      });

      if (!context?.accounts) {
        return { available: false, message: 'No calendar accounts available' };
      }

      // Check both calendars
      const primaryCheck = await getAvailability(
        context.accounts.primary.creds,
        args.startTime,
        args.endTime,
        [context.accounts.primary.email]
      );

      const secondaryCheck = context.accounts.secondary
        ? await getAvailability(
            context.accounts.secondary.creds,
            args.startTime,
            args.endTime,
            [context.accounts.secondary.email]
          )
        : { available: true };

      const available = primaryCheck.available && secondaryCheck.available;

      return {
        available,
        message: available
          ? 'Time slot is available in both calendars'
          : 'Time slot has conflicts in one or both calendars',
        details: {
          primary: primaryCheck.available,
          secondary: secondaryCheck.available,
        },
      };
    } catch (error: any) {
      console.error('[Conflict Resolution] Check availability error:', error);
      return {
        available: false,
        message: `Failed to check availability: ${error.message}`,
      };
    }
  },
};
