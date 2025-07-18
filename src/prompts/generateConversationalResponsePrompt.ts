export default function generateConversationalResponsePrompt(
  userMessage: string
): string {
  return `You are a helpful AI assistant. The user said: "${userMessage}". Please provide a friendly, conversational response. Keep it brief and helpful. If they're asking about calendar functionality, you can mention that you can help with checking schedules, creating events, and managing conflicts.`;
}
