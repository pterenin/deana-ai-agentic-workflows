import type { ChatCompletionTool } from 'openai/resources/chat/completions';
// Export all tools
export { calendarTools } from './calendarTools';
export { conflictTools } from './conflictTools';
export { conflictResolutionTools } from './conflictResolutionTools';
export { sendEmailHandler };

// Combine all tools for the main agent
import { calendarTools } from './calendarTools';
import { conflictTools } from './conflictTools';
import { conflictResolutionTools } from './conflictResolutionTools';
import { sendEmail as sendEmailHandler } from '../handlers/sendEmailHandler';

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
  sendEmailTool,
];
