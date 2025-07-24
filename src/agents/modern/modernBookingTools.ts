import { z } from 'zod';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
import { bookAppointmentAgent } from '../bookAppointmentAgent';

// Schema for booking appointment with proper workflow
export const BookAppointmentSchema = z.object({
  service: z.string().describe('Type of service (hair, nail, doctor, etc.)'),
  date: z.string().describe('Date in YYYY-MM-DD format'),
  time: z.string().describe('Time in HH:MM format (24-hour)'),
  duration: z.number().default(60).describe('Duration in minutes'),
});

export const SelectAlternativeSchema = z.object({
  selectedTime: z
    .string()
    .describe(
      'Selected alternative time (e.g., "9am", "10am", or "first", "second")'
    ),
  originalRequest: z.string().describe('Original booking request context'),
});

// Modern booking tools that enforce proper workflow
export const modernBookingTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      description:
        'Book an appointment by checking availability, making voice call, then creating calendar event',
      parameters: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Type of service (hair, nail, doctor, etc.)',
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format',
          },
          time: {
            type: 'string',
            description:
              'Time exactly as user specified (e.g., "8am", "2pm", "14:30"). Do NOT convert to 24-hour format.',
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes',
            default: 60,
          },
        },
        required: ['service', 'date', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'selectAlternativeTime',
      description:
        'Select an alternative time from previously offered options and proceed with booking workflow',
      parameters: {
        type: 'object',
        properties: {
          selectedTime: {
            type: 'string',
            description:
              'Selected alternative time (e.g., "9am", "10am", or "first", "second")',
          },
          originalRequest: {
            type: 'string',
            description: 'Original booking request context',
          },
        },
        required: ['selectedTime', 'originalRequest'],
      },
    },
  },
];

export class ModernBookingToolExecutor {
  constructor(
    private creds: any,
    private email?: string,
    private onProgress?: (update: any) => void
  ) {}

  async executeFunction(functionName: string, args: any): Promise<any> {
    this.onProgress?.({
      type: 'progress',
      content: `Executing ${functionName}...`,
    });

    switch (functionName) {
      case 'bookAppointment':
        return await this.handleBookAppointment(args);
      case 'selectAlternativeTime':
        return await this.handleSelectAlternativeTime(args);
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  private async handleBookAppointment(args: any): Promise<any> {
    const validated = BookAppointmentSchema.parse(args);

    // Create a natural language request for the booking agent
    const userRequest = `Book a ${validated.service} appointment on ${validated.date} at ${validated.time}`;

    this.onProgress?.({
      type: 'progress',
      content:
        'Starting booking workflow: checking availability, making call, then creating calendar event...',
    });

    try {
      const result = await bookAppointmentAgent(
        userRequest,
        this.creds,
        this.email,
        this.onProgress
      );

      if (result.error) {
        return {
          success: false,
          message: result.message,
          error: result.error,
        };
      }

      if (result.conflict) {
        return {
          success: false,
          conflict: true,
          message: result.message,
          alternatives: result.alternatives,
        };
      }

      // Success - the booking agent has completed the full workflow
      return {
        success: true,
        message:
          'Appointment successfully booked via voice call and added to calendar',
        transcript: result.transcript,
        appointment: result.appointment,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Booking failed: ${error.message}`,
        error: true,
      };
    }
  }

  private async handleSelectAlternativeTime(args: any): Promise<any> {
    const validated = SelectAlternativeSchema.parse(args);

    this.onProgress?.({
      type: 'progress',
      content: `Processing alternative time selection: ${validated.selectedTime}...`,
    });

    // Parse the selected time and create a new booking request
    const timeMatch = validated.selectedTime.match(
      /(\d{1,2})(:\d{2})?\s*(am|pm)?/i
    );
    const ordinalMatch = validated.selectedTime.match(
      /(first|second|third|1st|2nd|3rd)/i
    );

    let newRequest: string;

    if (timeMatch) {
      // Time-based selection (e.g., "9am")
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? timeMatch[2] : ':00';

      if (timeMatch[3]) {
        const ampm = timeMatch[3].toLowerCase();
        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      newRequest = `Book a hair appointment on ${dateStr} at ${hour
        .toString()
        .padStart(2, '0')}${minute}`;
    } else if (ordinalMatch) {
      // Ordinal selection (e.g., "second") - would need context from previous alternatives
      newRequest = `Book a hair appointment ${validated.selectedTime} option from alternatives`;
    } else {
      return {
        success: false,
        message: `Could not understand time selection: ${validated.selectedTime}. Please specify a time like "9am" or "second option".`,
      };
    }

    this.onProgress?.({
      type: 'progress',
      content:
        'Selected alternative time. Starting full booking workflow: availability check -> voice call -> calendar event...',
    });

    try {
      const result = await bookAppointmentAgent(
        newRequest,
        this.creds,
        this.email,
        this.onProgress
      );

      if (result.error) {
        return {
          success: false,
          message: result.message,
          error: result.error,
        };
      }

      if (result.conflict) {
        return {
          success: false,
          conflict: true,
          message: result.message,
          alternatives: result.alternatives,
        };
      }

      // Success - the booking agent has completed the full workflow
      return {
        success: true,
        message:
          'Alternative time selected and appointment successfully booked via voice call and added to calendar',
        transcript: result.transcript,
        appointment: result.appointment,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Alternative booking failed: ${error.message}`,
        error: true,
      };
    }
  }
}
