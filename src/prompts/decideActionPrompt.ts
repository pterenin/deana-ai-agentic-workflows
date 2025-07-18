import { getTodayStart, getTodayEnd } from '../utils/date-utils';

const getNowTime = () => {
  const now = new Date();
  const isoString = now.toISOString();
  return isoString;
};

export default function decideActionPrompt(userMessage: string): string {
  return `You are an AI assistant.
Decide what action to take for this user message: "${userMessage}".
Possible actions: get_events, create_event, update_event, delete_event, resolve_conflict, other.

Now is ${getNowTime()}.
Today starts at ${getTodayStart()} and ends at ${getTodayEnd()} (in America/New_York timezone).

If the user message refers to a specific date or time range (e.g., "today", "tomorrow", "this Friday", "next week"), extract the start and end as ISO 8601 strings (isoStart, isoEnd).
- isoStart should be the beginning of the period in America/New_York timezone (e.g., 00:00:00 of the day).
- isoEnd should be the end of the period in America/New_York timezone (e.g., 23:59:59 of the day).

Respond in strict JSON format: { "action": string, "isoStart"?: string, "isoEnd"?: string }.
If no time is indicated, omit isoStart and isoEnd.

Do NOT wrap your response in a code block or add any extra text.

Examples:
User: "Do I have meetings today?"
Response: { "action": "get_events", "isoStart": "${getTodayStart()}", "isoEnd": "${getTodayEnd()}" }

User: "Create an event for next Monday"
Response: { "action": "create_event", "isoStart": "2024-06-24T00:00:00.000Z", "isoEnd": "2024-06-24T23:59:59.999Z" }

User: "What's on my calendar?"
Response: { "action": "get_events" }
`;
}
