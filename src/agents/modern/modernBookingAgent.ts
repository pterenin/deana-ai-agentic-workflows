import OpenAI from 'openai';
import {
  modernBookingTools,
  ModernBookingToolExecutor,
} from './modernBookingTools';

export interface BookingAgentContext {
  sessionId: string;
  conversationHistory: any[];
  lastConflict?: {
    alternatives: any[];
    originalRequest: string;
  };
}

export class ModernBookingAgent {
  private openai: OpenAI;
  private toolExecutor: ModernBookingToolExecutor;

  constructor(
    private creds: any,
    private email?: string,
    private phone?: string,
    private timezone?: string,
    private clientNowISO?: string,
    private onProgress?: (update: any) => void,
    private userName?: string
  ) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('[ModernBookingAgent] Initialized with', {
      phone,
      timezone,
      clientNowISO,
    });
    this.toolExecutor = new ModernBookingToolExecutor(
      creds,
      email,
      phone,
      timezone,
      clientNowISO,
      onProgress,
      this.userName
    );
  }

  async processBookingRequest(
    userMessage: string,
    context: BookingAgentContext
  ): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(context);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...context.conversationHistory,
      { role: 'user', content: userMessage },
    ];

    this.onProgress?.({
      type: 'progress',
      content: 'Processing booking request with modern agent...',
    });

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: modernBookingTools,
        tool_choice: 'auto',
        temperature: 0.1,
      });

      const responseMessage = completion.choices[0].message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        // Execute tools
        const toolResults = [];

        for (const toolCall of responseMessage.tool_calls) {
          this.onProgress?.({
            type: 'progress',
            content: `Executing ${toolCall.function.name}...`,
          });

          try {
            const args = JSON.parse(toolCall.function.arguments);
            // Provide the original user message to the tool executor so downstream can use raw phrasing
            this.toolExecutor.originalUserMessage = userMessage;

            const result = await this.toolExecutor.executeFunction(
              toolCall.function.name,
              args
            );

            // If booking tool reports failure without a conflict, short-circuit and reply immediately
            if (
              toolCall.function.name === 'bookAppointment' &&
              result &&
              result.success === false &&
              !result.conflict
            ) {
              const failureMessage =
                result.message ||
                'The booking could not be completed based on the call results.';
              return {
                response: failureMessage,
                context,
                toolResults: [
                  {
                    tool_call_id: toolCall.id,
                    role: 'tool' as const,
                    content: JSON.stringify(result),
                  },
                ],
              };
            }

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(result),
            });

            // Handle conflicts by updating context
            if (result.conflict && result.alternatives) {
              context.lastConflict = {
                alternatives: result.alternatives,
                originalRequest: userMessage,
              };
            }
          } catch (error: any) {
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify({ error: true, message: error.message }),
            });
          }
        }

        // Get final response after tool execution
        const finalMessages = [...messages, responseMessage, ...toolResults];

        const finalCompletion = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: finalMessages,
          temperature: 0.1,
        });

        const finalResponse = finalCompletion.choices[0].message.content;

        return {
          response: finalResponse,
          toolResults,
          context,
          usage: finalCompletion.usage,
        };
      } else {
        // No tools called - direct response
        return {
          response: responseMessage.content,
          context,
          usage: completion.usage,
        };
      }
    } catch (error: any) {
      this.onProgress?.({
        type: 'error',
        content: `Booking agent error: ${error.message}`,
      });

      return {
        response: `I encountered an error while processing your booking request: ${error.message}. Please try again.`,
        error: true,
        context,
      };
    }
  }

  private buildSystemPrompt(context: BookingAgentContext): string {
    const currentDate = new Date().toISOString().split('T')[0];
    const basePrompt = `You are a professional appointment booking assistant. Your role is to help users book appointments through a structured workflow.

USER PROFILE:
${this.userName ? `- User Name: ${this.userName}` : ''}

**CRITICAL WORKFLOW RULES:**
1. For new booking requests, ALWAYS use the 'bookAppointment' tool
2. For alternative time selections, ALWAYS use the 'selectAlternativeTime' tool
3. NEVER create calendar events directly - the tools handle the complete workflow
4. The workflow is: check availability → make voice call → create calendar event

**BOOKING WORKFLOW:**
1. When user requests an appointment, extract the service, date, and time
2. Call 'bookAppointment' tool which will:
   - Check calendar availability
   - If available: make voice call to book appointment
   - If call successful: automatically create calendar event
   - If conflict: return alternative time options
3. If alternatives are offered and user selects one, use 'selectAlternativeTime' tool

**ALTERNATIVE SELECTION:**
- User can select by time: "9am", "10am", "2pm"
- User can select by position: "first", "second", "third"
- Always use 'selectAlternativeTime' tool for selections

**RESPONSE STYLE:**
- Be conversational and helpful
- Explain what's happening during the booking process
- If conflicts arise, clearly present alternatives
- Confirm successful bookings with appointment details

**TIME CHANGE NOTIFICATIONS:**
- If the booking tool returns a message about time adjustments, acknowledge it clearly
- Always emphasize the FINAL confirmed time to avoid confusion
- Example: "Your appointment has been successfully booked for today at 8 PM with Thomas. Please note that the appointment time was adjusted from your original request of 6:00 PM to 8:00 PM based on availability confirmed during the call."

Current date: ${currentDate}`;

    if (context.lastConflict) {
      const alternativesText = context.lastConflict.alternatives
        .map(
          (alt: any, i: number) => `${i + 1}. ${alt.label}: ${alt.timeDisplay}`
        )
        .join('\n');

      return (
        basePrompt +
        `

**CURRENT CONTEXT:**
The user previously requested an appointment that had a time conflict. Alternative times were offered:
${alternativesText}

If the user is selecting an alternative, use the 'selectAlternativeTime' tool.`
      );
    }

    return basePrompt;
  }
}
