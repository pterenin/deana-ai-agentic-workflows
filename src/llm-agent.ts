import OpenAI from 'openai';
import decideActionPrompt from './prompts/decideActionPrompt';
import summarizeCalendarEventsPrompt from './prompts/summarizeCalendarEventsPrompt';
import generateConversationalResponsePrompt from './prompts/generateConversationalResponsePrompt';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function decideAction(
  userMessage: string
): Promise<{ action: string; isoStart?: string; isoEnd?: string }> {
  const prompt = decideActionPrompt(userMessage);
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 60,
    temperature: 0,
  });
  let content = resp.choices[0].message?.content?.trim() || '{}';
  // Remove Markdown code block if present
  if (content.startsWith('```')) {
    content = content
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/```$/, '')
      .trim();
  }
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    return { action: content };
  }
}

export async function summarizeCalendarEvents(
  events: any,
  conflicts: any = null
): Promise<string> {
  const prompt = summarizeCalendarEventsPrompt(events, conflicts);
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.6,
  });
  return resp.choices[0].message?.content?.trim() || '';
}

export async function generateConversationalResponse(
  userMessage: string
): Promise<string> {
  const prompt = generateConversationalResponsePrompt(userMessage);
  const resp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
    temperature: 0.7,
  });
  return (
    resp.choices[0].message?.content?.trim() ||
    'Hello! How can I help you today?'
  );
}
