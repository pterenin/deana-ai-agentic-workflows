import { getAvailability, updateEvent } from '../../activities/calendar';
import { SessionContext } from '../types';

// Helper function to generate alternative time slots around an event
function generateAlternativeSlots(
  originalStart: string,
  originalEnd: string
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
    })} - ${alt.end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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

      // Generate 3 alternative time slots
      const alternatives = generateAlternativeSlots(
        args.originalStart,
        args.originalEnd
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
      console.log('🔧 [DEBUG rescheduleEvent] ==============================');
      console.log('🔧 [DEBUG] Input args:', JSON.stringify(args, null, 2));
      console.log('🔧 [DEBUG] Default creds keys:', Object.keys(creds || {}));
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
      console.log('🔧 [DEBUG rescheduleEvent] ==============================');

      onProgress?.({
        type: 'progress',
        content: `Rescheduling "${args.eventSummary}" to new time...`,
      });

      // Final availability check
      onProgress?.({
        type: 'progress',
        content: 'Performing final availability check...',
      });

      let isAvailable = true;
      if (context?.accounts) {
        const primaryCheck = await getAvailability(
          context.accounts.primary.creds,
          args.newStart,
          args.newEnd,
          [context.accounts.primary.email]
        );

        const secondaryCheck = context.accounts.secondary
          ? await getAvailability(
              context.accounts.secondary.creds,
              args.newStart,
              args.newEnd,
              [context.accounts.secondary.email]
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
      if (context?.accounts) {
        if (args.calendarEmail === context.accounts.primary.email) {
          targetCreds = context.accounts.primary.creds;
          console.log(
            '🔧 [DEBUG] Using PRIMARY calendar creds for:',
            args.calendarEmail
          );
        } else if (
          context.accounts.secondary &&
          args.calendarEmail === context.accounts.secondary.email
        ) {
          targetCreds = context.accounts.secondary.creds;
          console.log(
            '🔧 [DEBUG] Using SECONDARY calendar creds for:',
            args.calendarEmail
          );
        } else {
          console.log(
            '🔧 [DEBUG] ⚠️  No matching calendar found for:',
            args.calendarEmail
          );
          console.log('🔧 [DEBUG] Available calendars:');
          console.log('🔧 [DEBUG] - Primary:', context.accounts.primary.email);
          console.log(
            '🔧 [DEBUG] - Secondary:',
            context.accounts.secondary?.email || 'none'
          );
        }
      }

      console.log('🔧 [DEBUG] Final rescheduling parameters:');
      console.log('🔧 [DEBUG] - Event ID:', args.eventId);
      console.log('🔧 [DEBUG] - Calendar Email:', args.calendarEmail);
      console.log('🔧 [DEBUG] - New Start:', args.newStart);
      console.log('🔧 [DEBUG] - New End:', args.newEnd);
      console.log(
        '🔧 [DEBUG] - Target Creds Keys:',
        Object.keys(targetCreds || {})
      );

      // Update the event
      const result = await updateEvent(
        targetCreds,
        args.calendarEmail,
        args.eventId,
        {
          start: args.newStart,
          end: args.newEnd,
          summary: args.eventSummary,
        }
      );

      onProgress?.({
        type: 'progress',
        content: 'Event successfully rescheduled!',
      });

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
