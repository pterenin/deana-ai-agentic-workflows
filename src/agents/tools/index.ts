import type { ChatCompletionTool } from 'openai/resources/chat/completions';
// Export all tools
export { calendarTools } from './calendarTools';
export { conflictTools } from './conflictTools';
export { conflictResolutionTools } from './conflictResolutionTools';
export { emailTools } from './emailTools';
// no direct re-export of handlers here

// Combine all tools for the main agent
import { calendarTools } from './calendarTools';
import { conflictTools } from './conflictTools';
import { conflictResolutionTools } from './conflictResolutionTools';
import { emailTools } from './emailTools';
import { appointmentIntegrationTools } from './appointmentIntegrationTools';
import { callSummaryAccessTool } from './callSummaryAccessTool';
import { sendEmail as sendEmailHandler } from '../handlers/sendEmailHandler';
// General call tool (inline to avoid module resolution issues)
const generalCallTools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'placeGeneralCall',
      description:
        'Place a general-purpose outbound phone call (non-booking) via Vapi. Use this to call contacts to deliver messages or ask simple questions.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description:
              'Natural language description of the call goal, e.g., "Call Vlada and tell her about my appointment and that I will be busy today"',
          },
          phone: {
            type: 'string',
            description: 'Target phone number in E.164 format',
          },
        },
        required: ['task', 'phone'],
      },
    },
  },
];

export const sendEmailTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'sendEmail',
    description:
      'Send an email to a specified address with a subject and body.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient email address.',
        },
        subject: {
          type: 'string',
          description: 'The subject of the email.',
        },
        body: {
          type: 'string',
          description: 'The body content of the email.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
};

export const allTools: ChatCompletionTool[] = [
  ...calendarTools,
  ...conflictTools,
  ...conflictResolutionTools,
  ...emailTools,
  ...appointmentIntegrationTools,
  ...generalCallTools,
  callSummaryAccessTool,
  sendEmailTool,
];
