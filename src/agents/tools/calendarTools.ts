import type { ChatCompletionTool } from 'openai/resources/chat/completions';
// Calendar-related tools and function schemas
export const calendarTools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'getEvents',
      description: 'Get events from Google Calendar for a specific time range',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID to query',
          },
          timeMin: {
            type: 'string',
            description: 'Start time in ISO format',
          },
          timeMax: {
            type: 'string',
            description: 'End time in ISO format',
          },
        },
        required: ['timeMin', 'timeMax'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEvent',
      description: 'Create a simple event in Google Calendar',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID to create event in',
          },
          summary: {
            type: 'string',
            description: 'Event title/summary',
          },
          start: {
            type: 'string',
            description: 'Start time in ISO format',
          },
          end: {
            type: 'string',
            description: 'End time in ISO format',
          },
          timeZone: {
            type: 'string',
            default: 'America/Los_Angeles',
            description: 'Timezone for the event',
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'updateEvent',
      description: 'Update an existing event in Google Calendar',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID containing the event',
          },
          eventId: {
            type: 'string',
            description: 'ID of the event to update',
          },
          summary: {
            type: 'string',
            description: 'New event title/summary',
          },
          start: {
            type: 'string',
            description: 'New start time in ISO format',
          },
          end: {
            type: 'string',
            description: 'New end time in ISO format',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'deleteEvent',
      description: 'Delete an event from Google Calendar',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID containing the event',
          },
          eventId: {
            type: 'string',
            description: 'ID of the event to delete',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'deleteMultipleEvents',
      description: 'Delete multiple events from Google Calendar by their IDs',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
            default: 'tps8327@gmail.com',
            description: 'Calendar ID containing the events',
          },
          eventIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of event IDs to delete',
          },
        },
        required: ['eventIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendProgressUpdate',
      description:
        'Send a progress update to the user about what the agent is currently doing',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The progress message to send to the user',
          },
          step: {
            type: 'string',
            description:
              'Current step in the process (e.g., "finding", "updating", "checking")',
          },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'findContactEmailByName',
      description:
        "Find a contact's email address by name using Google Contacts (People API)",
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name of the contact to search for',
          },
        },
        required: ['name'],
      },
    },
  },
];
