import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { runGeneralCall } from './generalCallTool';

export const generalCallTools: ChatCompletionTool[] = [
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

// Handler wiring for main agent (optional utility)
export async function placeGeneralCallHandler(
  args: { task: string; phone: string },
  _creds: any,
  onProgress?: (u: any) => void
) {
  return await runGeneralCall(
    { task: args.task, phone: args.phone },
    onProgress
  );
}
