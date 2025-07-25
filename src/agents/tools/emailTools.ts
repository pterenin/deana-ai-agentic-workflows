import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const emailTools: ChatCompletionTool[] = [
  {
    type: 'function' as const,
    function: {
      name: 'askWhichEmailAccount',
      description:
        "Ask the user which email account to use when sending an email. Use this when the user wants to send an email but hasn't specified which account (work/personal) to use.",
      parameters: {
        type: 'object',
        properties: {
          recipientName: {
            type: 'string',
            description: 'The name of the person the user wants to email',
          },
          emailPurpose: {
            type: 'string',
            description:
              'Brief description of what the email is for (e.g., "saying hi from new user")',
          },
        },
        required: ['recipientName', 'emailPurpose'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'sendEmailWithAccount',
      description:
        'Send an email using a specific account (work or personal). Use this after the user has selected which account to use.',
      parameters: {
        type: 'object',
        properties: {
          accountType: {
            type: 'string',
            enum: ['primary', 'secondary', 'work', 'personal'],
            description:
              'Which account to use - can be primary/secondary or the actual account title',
          },
          recipientName: {
            type: 'string',
            description: 'Name of the recipient to look up in contacts',
          },
          subject: {
            type: 'string',
            description: 'Email subject',
          },
          body: {
            type: 'string',
            description: 'Email body content',
          },
          recipientEmail: {
            type: 'string',
            description:
              'If recipient email is already known, use this instead of looking up by name',
          },
        },
        required: ['accountType', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'findContactInAccount',
      description:
        "Find a contact's email address in a specific account's contact list.",
      parameters: {
        type: 'object',
        properties: {
          accountType: {
            type: 'string',
            enum: ['primary', 'secondary', 'work', 'personal'],
            description: "Which account's contacts to search",
          },
          contactName: {
            type: 'string',
            description: 'Name of the contact to find',
          },
        },
        required: ['accountType', 'contactName'],
      },
    },
  },
];
