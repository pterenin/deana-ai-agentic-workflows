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
      name: 'getDualAccountEvents',
      description:
        'Get events from both primary and secondary calendars for a specific time range. Use this when the user asks about meetings without specifying which calendar (e.g., "Do I have meetings today?", "What\'s on my schedule?")',
      parameters: {
        type: 'object',
        properties: {
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
      name: 'getSpecificCalendarEvents',
      description:
        'Get events from a specific calendar when the user mentions a calendar title (e.g., "Do I have meetings in my work calendar?", "What\'s on my personal calendar?"). Use this when the user specifies which calendar they want to check.',
      parameters: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start time in ISO format',
          },
          timeMax: {
            type: 'string',
            description: 'End time in ISO format',
          },
          requestedCalendar: {
            type: 'string',
            description:
              'The calendar title or identifier mentioned by the user (e.g., "work", "personal", "home", etc.)',
          },
        },
        required: ['timeMin', 'timeMax', 'requestedCalendar'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEventWithContacts',
      description:
        'Create a calendar event and automatically invite contacts by name. Use this for meetings with specific people (e.g., "meeting with John", "lunch with Mike and Sarah"). This will look up contact emails and add them as attendees so the event appears in their calendars.',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
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
          contactNames: {
            type: 'array',
            description:
              'List of contact names to look up and invite (e.g., ["John", "Sarah"])',
            items: {
              type: 'string',
              description: 'Name of contact to look up and invite',
            },
          },
          additionalEmails: {
            type: 'array',
            description:
              'Additional email addresses to invite (for contacts not in Google Contacts)',
            items: {
              type: 'string',
              description: 'Email address to invite',
            },
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEvent',
      description:
        'Create a simple calendar event WITHOUT inviting other people. Use this for personal appointments, reminders, or events where you do not need to invite contacts (e.g., "doctor appointment", "gym session", "reminder to call mom").',
      parameters: {
        type: 'object',
        properties: {
          calendarId: {
            type: 'string',
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
          attendees: {
            type: 'array',
            description:
              'List of attendee email addresses to invite to the event',
            items: {
              type: 'string',
              description: 'Email address of attendee',
            },
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
  {
    type: 'function' as const,
    function: {
      name: 'getAvailability',
      description:
        'Check availability (free/busy) for specific calendars in a time range using Google Calendar FreeBusy API. More efficient than getEvents for pure availability checking.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'List of calendars to check availability for',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description:
                    'Calendar ID to check (e.g., email address or "primary")',
                },
              },
              required: ['id'],
            },
          },
          timeMin: {
            type: 'string',
            description: 'Start time of the interval in ISO format (RFC3339)',
          },
          timeMax: {
            type: 'string',
            description: 'End time of the interval in ISO format (RFC3339)',
          },
          timeZone: {
            type: 'string',
            description: 'Time zone for the response (default: UTC)',
            default: 'UTC',
          },
        },
        required: ['items', 'timeMin', 'timeMax'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createEventWithAvailabilityCheck',
      description:
        'Create an event after first checking availability using getAvailability. If the time is not available, proposes alternative time slots.',
      parameters: {
        type: 'object',
        properties: {
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
          calendarId: {
            type: 'string',
            description: 'Calendar ID to create event in (defaults to primary)',
            default: 'primary',
          },
          timeZone: {
            type: 'string',
            description: 'Timezone for the event',
            default: 'America/Los_Angeles',
          },
          attendees: {
            type: 'array',
            description: 'List of attendee email addresses',
            items: {
              type: 'string',
              description: 'Email address of attendee',
            },
          },
          calendarsToCheck: {
            type: 'array',
            description:
              'List of calendar IDs to check for conflicts (defaults to just the target calendar)',
            items: {
              type: 'string',
              description: 'Calendar ID to check for conflicts',
            },
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
  },
];
