import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const conflictResolutionTools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'proposeRescheduleOptions',
      description:
        'Generate 3 alternative timeslots for rescheduling a conflicting event from secondary calendar. Checks availability for each proposed slot.',
      parameters: {
        type: 'object',
        properties: {
          conflictingEventId: {
            type: 'string',
            description: 'ID of the conflicting event to reschedule',
          },
          eventSummary: {
            type: 'string',
            description: 'Summary/title of the event to reschedule',
          },
          originalStart: {
            type: 'string',
            description: 'Original start time in ISO format',
          },
          originalEnd: {
            type: 'string',
            description: 'Original end time in ISO format',
          },
          calendarEmail: {
            type: 'string',
            description:
              'Email of the calendar containing the conflicting event',
          },
        },
        required: [
          'conflictingEventId',
          'eventSummary',
          'originalStart',
          'originalEnd',
          'calendarEmail',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'rescheduleEvent',
      description:
        'Reschedule an event to a new time after user selects from proposed options or suggests their own time.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'ID of the event to reschedule',
          },
          calendarEmail: {
            type: 'string',
            description: 'Email of the calendar containing the event',
          },
          newStart: {
            type: 'string',
            description: 'New start time in ISO format',
          },
          newEnd: {
            type: 'string',
            description: 'New end time in ISO format',
          },
          eventSummary: {
            type: 'string',
            description: 'Summary/title of the event being rescheduled',
          },
        },
        required: [
          'eventId',
          'calendarEmail',
          'newStart',
          'newEnd',
          'eventSummary',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'checkTimeSlotAvailability',
      description:
        'Check if a specific time slot is available across both calendars before rescheduling.',
      parameters: {
        type: 'object',
        properties: {
          startTime: {
            type: 'string',
            description: 'Start time to check in ISO format',
          },
          endTime: {
            type: 'string',
            description: 'End time to check in ISO format',
          },
        },
        required: ['startTime', 'endTime'],
      },
    },
  },
];
