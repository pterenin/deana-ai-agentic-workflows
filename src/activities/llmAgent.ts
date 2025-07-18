import {
  decideAction,
  summarizeCalendarEvents,
  generateConversationalResponse,
} from '../llm-agent';

export async function llmDecideAction(
  userMessage: string
): Promise<{ action: string; isoStart?: string; isoEnd?: string }> {
  return decideAction(userMessage);
}

export async function llmSummarizeCalendarEvents(
  events: any,
  conflicts: any = null
): Promise<string> {
  return summarizeCalendarEvents(events, conflicts);
}

export async function llmGenerateConversationalResponse(
  userMessage: string
): Promise<string> {
  return generateConversationalResponse(userMessage);
}
