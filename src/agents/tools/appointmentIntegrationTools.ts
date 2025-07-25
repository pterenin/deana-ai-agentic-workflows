import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const appointmentIntegrationTools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'parseCallSummaryForBooking',
      description:
        'Parse a phone call summary or transcript to extract actual booking details made during the call. Use this when a user mentions booking an appointment and there might be recent call data with actual booking results.',
      parameters: {
        type: 'object',
        properties: {
          callSummary: {
            type: 'string',
            description:
              'The call summary or transcript text to parse for booking information',
          },
          originalRequest: {
            type: 'string',
            description: "The user's original booking request for context",
          },
        },
        required: ['callSummary', 'originalRequest'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEventFromCallBooking',
      description:
        "Create a calendar event using actual booking details extracted from a phone call, not the user's original request. Use this when call summary shows different booking details than originally requested.",
      parameters: {
        type: 'object',
        properties: {
          actualDate: {
            type: 'string',
            description:
              'The actual date booked during the call (e.g., "2025-07-26")',
          },
          actualTime: {
            type: 'string',
            description:
              'The actual time booked during the call (e.g., "15:00")',
          },
          appointmentType: {
            type: 'string',
            description: 'Type of appointment (e.g., "hair appointment")',
          },
          location: {
            type: 'string',
            description:
              'Business name or location (e.g., "Tomi Gun Barber Shop")',
          },
          stylistName: {
            type: 'string',
            description: 'Name of the service provider (e.g., "Tom")',
          },
          originalRequest: {
            type: 'string',
            description: "User's original request for reference",
          },
          calendarId: {
            type: 'string',
            description:
              'Calendar ID to create event in (email address). Omit to let system decide which calendar to use.',
          },
        },
        required: ['actualDate', 'actualTime', 'appointmentType'],
      },
    },
  },
];
