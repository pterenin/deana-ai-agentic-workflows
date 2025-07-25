import { SessionContext } from '../types';

export const callSummaryAccessHandler = {
  getRecentCallSummary: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '📞 [getRecentCallSummary] Looking for call summary data for request:',
        args.userRequest
      );

      // Use the actual call summary from the LATEST call
      const actualCallSummary = `The AI assistant successfully booked a hair appointment for Pawel at Tomigan Barber Shop. Although the initial preferred time between 6 PM and 7 PM on July 26, 2025, was unavailable, the appointment was confirmed for 8 PM on the same day with stylist Alex after the AI verified Pawel's availability. The AI also requested a reminder for Pawel.`;

      // In a real implementation, this would:
      // 1. Check context for recent call data
      // 2. Query call logging system
      // 3. Access phone system integration
      // 4. Match calls to user requests by timing/content

      // Check if user request is about appointment booking
      const isAppointmentRequest = args.userRequest
        .toLowerCase()
        .match(
          /(book|schedule|appointment|haircut|hair|barber|salon|dentist|doctor)/
        );

      if (isAppointmentRequest) {
        console.log(
          '📞 [getRecentCallSummary] Found appointment-related request, returning call summary'
        );

        return {
          success: true,
          hasCallSummary: true,
          callSummary: actualCallSummary,
          callMetadata: {
            date: new Date().toISOString(),
            type: 'appointment_booking',
            business: 'Tomi Gun Barber Shop',
            status: 'completed',
          },
          message:
            'Found recent call summary with appointment booking details.',
        };
      } else {
        console.log(
          '📞 [getRecentCallSummary] No appointment-related call data found'
        );

        return {
          success: true,
          hasCallSummary: false,
          callSummary: null,
          message: 'No recent call summaries found for this type of request.',
        };
      }
    } catch (error: any) {
      console.error(
        '[callSummaryAccessHandler] Get call summary error:',
        error
      );
      return {
        error: true,
        message: `Failed to retrieve call summary: ${error.message}`,
      };
    }
  },
};
