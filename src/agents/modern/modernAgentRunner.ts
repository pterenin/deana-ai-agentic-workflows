import OpenAI from 'openai';
import { z } from 'zod';
import {
  modernCalendarTools,
  ModernCalendarToolExecutor,
} from './modernCalendarTools';
import { getCurrentDateContext } from '../utils/dateUtils';

// Environment variables for security
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Structured context management
export interface AgentContext {
  userId?: string;
  sessionId: string;
  dateContext: any;
  credentials: any;
  lastBookingConflict?: any;
  executionTrace: ExecutionStep[];
  startTime: Date;
}

export interface ExecutionStep {
  timestamp: Date;
  step: string;
  agent?: string;
  functionCalls?: any[];
  result?: any;
  duration?: number;
}

export interface ProgressUpdate {
  type: 'progress' | 'error' | 'function_call' | 'agent_handoff';
  content: string;
  data?: any;
  timestamp: Date;
}

// Agent configuration schema
const AgentConfigSchema = z.object({
  name: z.string(),
  instructions: z.string(),
  model: z.string().default('gpt-4o'),
  maxSteps: z.number().default(10),
  temperature: z.number().default(0.1),
  tools: z.array(z.any()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// Modern Agent Runner class
export class ModernAgentRunner {
  private openai: OpenAI;
  private toolExecutor: ModernCalendarToolExecutor;
  private context: AgentContext;
  private onProgress?: (update: ProgressUpdate) => void;

  constructor(
    context: AgentContext,
    onProgress?: (update: ProgressUpdate) => void
  ) {
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    this.context = context;
    this.onProgress = onProgress;
    this.toolExecutor = new ModernCalendarToolExecutor(
      context.credentials,
      (update) => this.emitProgress('progress', update.content, update)
    );
  }

  // Main execution method - replaces manual loop
  async run(agentConfig: AgentConfig, input: string): Promise<any> {
    const startTime = Date.now();
    this.emitProgress('progress', `Starting ${agentConfig.name}...`);

    try {
      // Add execution step to trace
      const executionStep: ExecutionStep = {
        timestamp: new Date(),
        step: 'agent_start',
        agent: agentConfig.name,
      };
      this.context.executionTrace.push(executionStep);

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(agentConfig.instructions),
        },
        {
          role: 'user',
          content: input,
        },
      ];

      let currentStep = 0;
      let finalResponse = '';
      let lastResponse: OpenAI.Chat.Completions.ChatCompletion | null = null;

      while (currentStep < agentConfig.maxSteps) {
        this.emitProgress(
          'progress',
          `Processing step ${currentStep + 1}/${agentConfig.maxSteps}...`
        );

        const response = await this.openai.chat.completions.create({
          model: agentConfig.model,
          messages,
          tools: agentConfig.tools || modernCalendarTools,
          tool_choice: 'auto',
          temperature: agentConfig.temperature,
        });

        lastResponse = response;
        const responseMessage = response.choices[0].message;
        messages.push(responseMessage);

        // Handle tool calls
        if (
          responseMessage.tool_calls &&
          responseMessage.tool_calls.length > 0
        ) {
          await this.handleToolCalls(responseMessage.tool_calls, messages);
          currentStep++;
          continue;
        }

        // No tool calls, we have a final response
        finalResponse = responseMessage.content || '';
        break;
      }

      // Add completion step to trace
      executionStep.result = finalResponse;
      executionStep.duration = Date.now() - startTime;

      this.emitProgress(
        'progress',
        `${agentConfig.name} completed successfully`
      );

      return {
        response: finalResponse,
        context: this.context,
        executionTrace: this.context.executionTrace,
        usage: lastResponse?.usage,
      };
    } catch (error: any) {
      this.emitProgress(
        'error',
        `${agentConfig.name} failed: ${error.message}`
      );
      throw new AgentExecutionError(error.message, this.context.executionTrace);
    }
  }

  // Handle tool calls with proper error handling and tracing
  private async handleToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ) {
    const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] =
      [];

    for (const toolCall of toolCalls) {
      const startTime = Date.now();

      this.emitProgress(
        'function_call',
        `Calling ${toolCall.function.name}...`,
        {
          functionName: toolCall.function.name,
          arguments: toolCall.function.arguments,
        }
      );

      try {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await this.toolExecutor.executeFunction(
          toolCall.function.name,
          args
        );

        // Add to trace
        this.context.executionTrace.push({
          timestamp: new Date(),
          step: 'function_call',
          functionCalls: [{ name: toolCall.function.name, args, result }],
          duration: Date.now() - startTime,
        });

        toolResults.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      } catch (error: any) {
        this.emitProgress(
          'error',
          `Tool ${toolCall.function.name} failed: ${error.message}`
        );

        toolResults.push({
          role: 'tool',
          content: JSON.stringify({ error: error.message }),
          tool_call_id: toolCall.id,
        });
      }
    }

    messages.push(...toolResults);
  }

  // Build system prompt with context injection
  private buildSystemPrompt(baseInstructions: string): string {
    const dateContext = this.context.dateContext;

    return `${baseInstructions}

CURRENT CONTEXT:
- Date: ${dateContext.today}
- Tomorrow: ${dateContext.tomorrow}
- Session ID: ${this.context.sessionId}
- Current time: ${dateContext.currentTime}

EXECUTION GUIDELINES:
- Use the provided tools for all calendar operations
- Always validate inputs and handle errors gracefully
- Provide clear, actionable responses to users
- When conflicts arise, offer specific alternatives

TRACING: This execution is being traced for debugging and optimization purposes.`;
  }

  // Emit progress updates with structured data
  private emitProgress(
    type: ProgressUpdate['type'],
    content: string,
    data?: any
  ) {
    this.onProgress?.({
      type,
      content,
      data,
      timestamp: new Date(),
    });
  }

  // Agent handoff implementation
  async handoffTo(
    targetAgentConfig: AgentConfig,
    context: string
  ): Promise<any> {
    this.emitProgress(
      'agent_handoff',
      `Handing off to ${targetAgentConfig.name}...`
    );

    // Create new runner for target agent
    const targetRunner = new ModernAgentRunner(this.context, this.onProgress);

    // Add handoff to trace
    this.context.executionTrace.push({
      timestamp: new Date(),
      step: 'agent_handoff',
      agent: targetAgentConfig.name,
    });

    return await targetRunner.run(targetAgentConfig, context);
  }
}

// Custom error class for better error handling
export class AgentExecutionError extends Error {
  constructor(message: string, public executionTrace: ExecutionStep[]) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}

// Agent configuration factory
export class AgentConfigFactory {
  static createMainAgent(): AgentConfig {
    return {
      name: 'MainCalendarAgent',
      instructions: `You are Deana, an intelligent calendar management assistant.

HAIR APPOINTMENT BOOKING WORKFLOW:
- When asked to book a hair appointment, first check the calendar for conflicts
- If conflicts exist, propose 3 alternative time slots
- Only proceed with booking after confirming availability
- After successful booking, create a calendar event
- Provide a friendly confirmation with appointment details

CORE RESPONSIBILITIES:
- Understand natural language calendar requests
- Use appropriate tools for calendar operations
- Handle conflicts gracefully with alternatives
- Provide clear, helpful responses
- Maintain conversation context`,
      model: 'gpt-4o',
      maxSteps: 10,
      temperature: 0.1,
      tools: modernCalendarTools,
    };
  }

  static createBookingAgent(): AgentConfig {
    return {
      name: 'BookingAgent',
      instructions: `You are a specialized booking assistant for appointments.

RESPONSIBILITIES:
- Check calendar availability for requested times
- Generate alternative time slots when conflicts exist
- Interface with voice calling systems for appointment booking
- Create calendar events after successful bookings
- Provide detailed booking confirmations

WORKFLOW:
1. Validate requested appointment time
2. Check calendar for conflicts
3. If conflicts exist, propose alternatives
4. Once time is confirmed, proceed with booking
5. Create calendar event
6. Provide confirmation details`,
      model: 'gpt-4o',
      maxSteps: 8,
      temperature: 0.1,
      tools: modernCalendarTools,
    };
  }
}

// Usage example and orchestrator
export class ModernAgentOrchestrator {
  private mainAgent: AgentConfig;
  private bookingAgent: AgentConfig;

  constructor() {
    this.mainAgent = AgentConfigFactory.createMainAgent();
    this.bookingAgent = AgentConfigFactory.createBookingAgent();
  }

  async processRequest(
    userMessage: string,
    creds: any,
    sessionId: string,
    onProgress?: (update: ProgressUpdate) => void
  ): Promise<any> {
    // Create context
    const context: AgentContext = {
      sessionId,
      dateContext: getCurrentDateContext(),
      credentials: creds,
      executionTrace: [],
      startTime: new Date(),
    };

    // Create runner
    const runner = new ModernAgentRunner(context, onProgress);

    // Detect booking intent
    const bookingIntent =
      /book.*(appointment|hair|barber|cut|massage|nail|doctor|dentist)/i.test(
        userMessage
      );

    if (bookingIntent) {
      // Use specialized booking agent
      return await runner.handoffTo(this.bookingAgent, userMessage);
    } else {
      // Use main agent
      return await runner.run(this.mainAgent, userMessage);
    }
  }
}
