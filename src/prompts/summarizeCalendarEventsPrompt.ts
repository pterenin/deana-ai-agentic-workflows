export default function summarizeCalendarEventsPrompt(
  events: any,
  conflicts: any = null
): string {
  let prompt = `You are a helpful assistant. Summarize the following calendar events for a user in a friendly, easy-to-read way, suitable for voice output.\n\nEvents: ${JSON.stringify(
    events,
    null,
    2
  )}`;
  if (conflicts) {
    prompt += `\nConflicts: ${JSON.stringify(conflicts, null, 2)}`;
  }
  return prompt;
}
