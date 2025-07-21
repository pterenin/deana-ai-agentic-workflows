import type { ChatCompletionTool } from 'openai/resources/chat/completions';
// Conflict resolution tools and function schemas
export const conflictTools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'findAlternativeTimeSlots',
      description:
        'Find alternative time slots around a requested time when there are conflicts',
      parameters: {
        type: 'object',
        properties: {
          requestedTime: {
            type: 'string',
            description: 'The originally requested time in ISO format',
          },
          duration: {
            type: 'number',
            default: 60,
            description: 'Duration of the meeting in minutes',
          },
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID to check',
          },
        },
        required: ['requestedTime'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEventAtAlternative',
      description: 'Create an event at a specific alternative time slot',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Event title/summary',
          },
          startISO: {
            type: 'string',
            description: 'Start time in ISO format',
          },
          endISO: {
            type: 'string',
            description: 'End time in ISO format',
          },
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID to create event in',
          },
          timeZone: {
            type: 'string',
            default: 'America/Los_Angeles',
            description: 'Timezone for the event',
          },
        },
        required: ['summary', 'startISO', 'endISO'],
      },
    },
  },
];
