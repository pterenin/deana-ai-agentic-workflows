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
// Normalize to E.164 format. If 10 digits, assume North America and prefix +1
function normalizePhoneNumber(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Already E.164
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;
  // 10 digits -> assume US/CA +1
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  // 11-15 digits -> prefix +
  if (digitsOnly.length >= 11 && digitsOnly.length <= 15)
    return `+${digitsOnly}`;
  return null;
}

// Try to extract a phone number-like sequence from free text
function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\+?\d[\d\s().-]{7,}\d/);
  return match ? match[0] : null;
}

export async function placeGeneralCallHandler(
  args: { task: string; phone?: string },
  _creds: any,
  onProgress?: (u: any) => void,
  context?: { userName?: string; userPhone?: string }
) {
  // Prefer phone number explicitly provided in the user's message
  const extracted = extractPhoneFromText(args.task || '');
  const extractedNormalized = normalizePhoneNumber(extracted || undefined);

  // Next, consider phone passed in args (if LLM provided)
  const argNormalized = normalizePhoneNumber(args.phone);

  // Finally, fall back to context number
  const contextNormalized = normalizePhoneNumber(context?.userPhone);

  const chosen = extractedNormalized || argNormalized || contextNormalized;

  if (!chosen) {
    return {
      error: true,
      message:
        'Please provide a valid phone number to call (e.g., +17789297656 or 778-929-7656).',
    };
  }

  // Strong validation: E.164
  if (!/^\+[1-9]\d{7,14}$/.test(chosen)) {
    return {
      error: true,
      message:
        'The phone number appears invalid. Please provide a valid number like +17789297656 (10-digit US/CA numbers are accepted and will be formatted automatically).',
    };
  }

  return await runGeneralCall(
    { task: args.task, phone: chosen },
    onProgress,
    context?.userName
  );
}
