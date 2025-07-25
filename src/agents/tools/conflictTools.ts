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
            description: 'Calendar ID to create event in',
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
        required: ['summary', 'startISO', 'endISO'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rescheduleEvent',
      description: 'Reschedule a specific event to a new time slot',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID of the event to reschedule',
          },
          calendarId: {
            type: 'string',
            description: 'Calendar ID where the event is located',
          },
          newStartTime: {
            type: 'string',
            description: 'New start time in ISO format',
          },
          newEndTime: {
            type: 'string',
            description: 'New end time in ISO format',
          },
          eventSummary: {
            type: 'string',
            description: 'Title/summary of the event being rescheduled',
          },
        },
        required: [
          'eventId',
          'calendarId',
          'newStartTime',
          'newEndTime',
          'eventSummary',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'showReschedulingOptions',
      description:
        'Show available time slots for rescheduling after user agrees to reschedule a conflicted event',
      parameters: {
        type: 'object',
        properties: {
          userAgreed: {
            type: 'boolean',
            description:
              'Whether the user agreed to reschedule the conflicted event',
          },
          conflictedEvent: {
            type: 'object',
            description:
              'The event that has a conflict and needs to be rescheduled',
            properties: {
              summary: {
                type: 'string',
                description: 'Title/summary of the conflicted event',
              },
              start: {
                type: 'object',
                description: 'Start time of the conflicted event',
                properties: {
                  dateTime: {
                    type: 'string',
                    description: 'Start time in ISO format',
                  },
                },
              },
              end: {
                type: 'object',
                description: 'End time of the conflicted event',
                properties: {
                  dateTime: {
                    type: 'string',
                    description: 'End time in ISO format',
                  },
                },
              },
              calendarId: {
                type: 'string',
                description: 'Calendar ID where the event is located',
              },
              id: {
                type: 'string',
                description: 'Event ID for rescheduling',
              },
            },
          },
        },
        required: ['userAgreed'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'selectTimeSlot',
      description:
        'Reschedule an event to a selected time slot after user chooses from alternatives or proposes their own time',
      parameters: {
        type: 'object',
        properties: {
          conflictedEvent: {
            type: 'object',
            description: 'The event that needs to be rescheduled',
            properties: {
              summary: {
                type: 'string',
                description: 'Title/summary of the event',
              },
              id: {
                type: 'string',
                description: 'Event ID',
              },
              calendarId: {
                type: 'string',
                description: 'Calendar ID where the event is located',
              },
            },
            required: ['summary', 'id', 'calendarId'],
          },
          selectedSlot: {
            type: 'object',
            description: 'The selected time slot for rescheduling',
            properties: {
              startISO: {
                type: 'string',
                description: 'New start time in ISO format',
              },
              endISO: {
                type: 'string',
                description: 'New end time in ISO format',
              },
              timeDisplay: {
                type: 'string',
                description:
                  'Human-readable time display (e.g., "2:00 PM - 3:00 PM")',
              },
            },
            required: ['startISO', 'endISO', 'timeDisplay'],
          },
        },
        required: ['conflictedEvent', 'selectedSlot'],
      },
    },
  },
];
