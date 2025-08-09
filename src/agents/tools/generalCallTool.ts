import axios from 'axios';
import OpenAI from 'openai';

export interface GeneralCallArgs {
  task: string; // e.g., "Call Vlada and tell her about my appointment and that I will be busy today"
  phone: string; // E.164 number to call
}

export async function runGeneralCall(
  args: GeneralCallArgs,
  onProgress?: (u: any) => void,
  userName?: string
) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Basic phone normalization/validation
  const sanitizedPhone = (args.phone || '').toString().trim();
  if (
    !sanitizedPhone.startsWith('+') ||
    sanitizedPhone.replace(/\D/g, '').length < 8
  ) {
    throw new Error(`Invalid phone number provided: ${args.phone}`);
  }

  onProgress?.({ type: 'progress', content: 'Preparing call content...' });

  const prompt = `Please generate a first message and a system message for a Vapi assistant to perform the following task.

Task: ${args.task}

Caller context: ${
    userName
      ? `The assistant is calling on behalf of ${userName}.`
      : 'The assistant is calling on behalf of the client.'
  }

Constraints:
- Assistant name is Deana
- Use a warm, professional tone
- If a caller name is provided, the firstMessage MUST clearly say you are calling on behalf of ${
    userName || 'the client'
  }
- The systemMessage MUST include that the caller/client name is ${
    userName || 'the client'
  } so downstream behavior reflects the correct identity
- Return ONLY strict JSON with keys {"firstMessage": string, "systemMessage": string}
- Do not include markdown or extra text`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });
  const content = completion.choices?.[0]?.message?.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to generate call content');
  const parsed = JSON.parse(jsonMatch[0]);
  const firstMessage: string = parsed.firstMessage;
  const systemMessage: string = parsed.systemMessage;

  onProgress?.({ type: 'progress', content: 'Starting phone call...' });

  const startResp = await axios.post(
    'https://api.vapi.ai/call',
    {
      phoneNumberId: 'a301522e-1c53-44f4-9fbe-e5433a3256f6',
      assistantId: 'fc5a5e7c-e97f-4c6f-b682-d6c57f21a359',
      customer: { number: sanitizedPhone },
      type: 'outboundPhoneCall',
      assistant: {
        voice: { provider: 'vapi', voiceId: 'Paige' },
        firstMessage: firstMessage,
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{ role: 'system', content: systemMessage }],
        },
      },
    },
    {
      headers: {
        Authorization: 'Bearer 3981fd0c-e2f3-4200-a43d-107b6abf1680',
        'Content-Type': 'application/json',
      },
    }
  );

  const callId = startResp.data.id;
  let status = startResp.data.status;
  if (status)
    onProgress?.({ type: 'progress', content: `Call status: ${status}` });

  // Poll until ended
  let transcript = '';
  while (status !== 'ended') {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await axios.get(`https://api.vapi.ai/call/${callId}`, {
      headers: { Authorization: 'Bearer 3981fd0c-e2f3-4200-a43d-107b6abf1680' },
    });
    status = poll.data.status;
    transcript = poll.data.transcript || transcript;
    onProgress?.({ type: 'progress', content: `Call status: ${status}` });
  }

  return { success: true, transcript };
}
