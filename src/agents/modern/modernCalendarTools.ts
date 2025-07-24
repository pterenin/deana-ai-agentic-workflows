import { z } from 'zod';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../../activities/calendar';
import { findContactEmailByName } from '../../activities/contacts';

// Zod schemas for validation
export const GetEventsSchema = z.object({
  calendarId: z.string(),
  timeMin: z.string().describe('Start time in ISO format'),
  timeMax: z.string().describe('End time in ISO format'),
});

export const CreateEventSchema = z.object({
  calendarId: z.string(),
  summary: z.string().describe('Event title/summary'),
  start: z.string().describe('Start time in ISO format'),
  end: z.string().describe('End time in ISO format'),
  timeZone: z.string().default('America/Los_Angeles'),
  attendees: z.array(z.object({ email: z.string() })).optional(),
});

export const UpdateEventSchema = z.object({
  calendarId: z.string(),
  eventId: z.string().describe('ID of the event to update'),
  summary: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const DeleteEventSchema = z.object({
  calendarId: z.string(),
  eventId: z.string().describe('ID of the event to delete'),
});

export const FindContactSchema = z.object({
  name: z.string().describe('The name of the contact to search for'),
});

// Modern tool definitions using OpenAI's function calling format
export const modernCalendarTools: ChatCompletionTool[] = [
  {
    type: 'function',
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
    type: 'function',
    function: {
      name: 'createEvent',
      description:
        'Create an event in Google Calendar with automatic conflict detection',
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
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
              },
              required: ['email'],
            },
            description: 'Event attendees',
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
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
    type: 'function',
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
    type: 'function',
    function: {
      name: 'findContactEmailByName',
      description:
        "Find a contact's email address by name using Google Contacts",
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

// Modern tool execution handlers with proper error handling and progress tracking
export class ModernCalendarToolExecutor {
  constructor(
    private creds: any,
    private onProgress?: (update: {
      type: string;
      content: string;
      data?: any;
    }) => void
  ) {}

  async executeFunction(functionName: string, args: any): Promise<any> {
    try {
      switch (functionName) {
        case 'getEvents':
          return await this.handleGetEvents(args);
        case 'createEvent':
          return await this.handleCreateEvent(args);
        case 'updateEvent':
          return await this.handleUpdateEvent(args);
        case 'deleteEvent':
          return await this.handleDeleteEvent(args);
        case 'findContactEmailByName':
          return await this.handleFindContact(args);
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error: any) {
      this.onProgress?.({
        type: 'error',
        content: `Function ${functionName} failed: ${error.message}`,
      });
      throw error;
    }
  }

  private async handleGetEvents(args: any) {
    const validated = GetEventsSchema.parse(args);

    this.onProgress?.({
      type: 'progress',
      content: 'Fetching calendar events...',
    });

    const events = await getEvents(
      this.creds,
      validated.calendarId,
      validated.timeMin,
      validated.timeMax
    );

    this.onProgress?.({
      type: 'progress',
      content: `Found ${events.length} events`,
    });

    return {
      events,
      count: events.length,
    };
  }

  private async handleCreateEvent(args: any) {
    const validated = CreateEventSchema.parse(args);

    // Check for conflicts first
    this.onProgress?.({
      type: 'progress',
      content: 'Checking calendar availability...',
    });

    const existingEvents = await getEvents(
      this.creds,
      validated.calendarId,
      validated.start,
      validated.end
    );

    if (existingEvents.length > 0) {
      // Generate alternatives
      this.onProgress?.({
        type: 'progress',
        content: 'Scheduling conflict detected, finding alternatives...',
      });

      const alternatives = await this.generateAlternatives(
        validated,
        existingEvents
      );

      return {
        conflict: true,
        conflictingEvents: existingEvents,
        alternatives,
        message: `Scheduling conflict detected. Here are available alternatives: ${alternatives
          .map((alt, i) => `\n${i + 1}. ${alt.label}: ${alt.timeDisplay}`)
          .join('')}`,
      };
    }

    // Create the event
    this.onProgress?.({
      type: 'progress',
      content: 'Creating calendar event...',
    });

    const result = await createEvent(this.creds, validated.calendarId, {
      start: validated.start,
      end: validated.end,
      summary: validated.summary,
      timeZone: validated.timeZone,
      attendees: validated.attendees,
    });

    this.onProgress?.({
      type: 'progress',
      content: 'Event created successfully!',
    });

    return result;
  }

  private async handleUpdateEvent(args: any) {
    const validated = UpdateEventSchema.parse(args);

    this.onProgress?.({
      type: 'progress',
      content: `Updating event "${validated.eventId}"...`,
    });

    const result = await updateEvent(
      this.creds,
      validated.calendarId,
      validated.eventId,
      {
        start: validated.start,
        end: validated.end,
        summary: validated.summary,
      }
    );

    this.onProgress?.({
      type: 'progress',
      content: 'Event updated successfully!',
    });

    return result;
  }

  private async handleDeleteEvent(args: any) {
    const validated = DeleteEventSchema.parse(args);

    this.onProgress?.({
      type: 'progress',
      content: `Deleting event "${validated.eventId}"...`,
    });

    const result = await deleteEvent(
      this.creds,
      validated.calendarId,
      validated.eventId
    );

    this.onProgress?.({
      type: 'progress',
      content: 'Event deleted successfully!',
    });

    return result;
  }

  private async handleFindContact(args: any) {
    const validated = FindContactSchema.parse(args);

    this.onProgress?.({
      type: 'progress',
      content: `Looking up contact: ${validated.name}...`,
    });

    const email = await findContactEmailByName(this.creds, validated.name);

    if (email) {
      this.onProgress?.({
        type: 'progress',
        content: `Found contact email: ${email}`,
      });
    } else {
      this.onProgress?.({
        type: 'progress',
        content: `No contact found for name: ${validated.name}`,
      });
    }

    return { email };
  }

  private async generateAlternatives(
    eventDetails: any,
    conflictingEvents: any[]
  ) {
    const requestedDateTime = new Date(eventDetails.start);
    const duration =
      (new Date(eventDetails.end).getTime() - requestedDateTime.getTime()) /
      60000;

    const alternativeSlots = [
      {
        start: new Date(requestedDateTime.getTime() - 60 * 60000), // 1 hour earlier
        end: new Date(
          requestedDateTime.getTime() - 60 * 60000 + duration * 60000
        ),
        label: '1 hour earlier',
      },
      {
        start: new Date(requestedDateTime.getTime() + 60 * 60000), // 1 hour later
        end: new Date(
          requestedDateTime.getTime() + 60 * 60000 + duration * 60000
        ),
        label: '1 hour later',
      },
      {
        start: new Date(requestedDateTime.getTime() + 120 * 60000), // 2 hours later
        end: new Date(
          requestedDateTime.getTime() + 120 * 60000 + duration * 60000
        ),
        label: '2 hours later',
      },
    ];

    const availableAlternatives = [];

    for (const alt of alternativeSlots) {
      const altStartISO = alt.start.toISOString();
      const altEndISO = alt.end.toISOString();

      const altEvents = await getEvents(
        this.creds,
        eventDetails.calendarId,
        altStartISO,
        altEndISO
      );

      if (altEvents.length === 0) {
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

    return availableAlternatives;
  }
}
