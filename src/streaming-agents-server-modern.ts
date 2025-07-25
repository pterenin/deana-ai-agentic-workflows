import express from 'express';
import cors from 'cors';
import { runMainAgent } from './agents/mainAgent';
import {
  ModernBookingAgent,
  BookingAgentContext,
} from './agents/modern/modernBookingAgent';

const app = express();
const PORT = process.env.PORT || 3060;

// Middleware
app.use(cors());
app.use(express.json());

// Store conversation contexts
const conversationContexts = new Map<string, any>();

// Enhanced main agent runner that uses modern booking for booking intents
async function runEnhancedMainAgent(
  userMessage: string,
  creds: any,
  context: any,
  onProgress?: (update: any) => void
): Promise<any> {
  // Detect booking intent
  const bookingIntent =
    /book.*(appointment|hair|barber|cut|massage|nail|doctor|dentist)/i.test(
      userMessage
    );
  const alternativeSelection =
    context?.lastBookingConflict &&
    /(\d{1,2})(am|pm)|first|second|third|1st|2nd|3rd/i.test(userMessage);

  if (bookingIntent || alternativeSelection) {
    onProgress?.({
      type: 'progress',
      content: 'Detected booking request. Using modern booking workflow...',
    });

    // Create modern booking agent context
    const bookingContext: BookingAgentContext = {
      sessionId: context.sessionId || 'default',
      conversationHistory: context.history || [],
      lastConflict: context.lastBookingConflict,
    };

    // Use modern booking agent
    const modernBookingAgent = new ModernBookingAgent(creds, context.email || "default@example.com", onProgress);
    const result = await modernBookingAgent.processBookingRequest(
      userMessage,
      bookingContext
    );

    // Update main context with booking results
    if (result.context?.lastConflict) {
      context.lastBookingConflict = result.context.lastConflict;
    }

    return {
      response: result.response,
      alternatives: result.context?.lastConflict?.alternatives || [],
      conflict: !!result.context?.lastConflict,
      context: context,
      toolResults: result.toolResults,
      usage: result.usage,
    };
  } else {
    // Use original main agent for non-booking requests
    return await runMainAgent(userMessage, creds, context, onProgress);
  }
}

// Streaming endpoint
app.get('/api/chat/stream', async (req, res) => {
  const { message, sessionId: providedSessionId } = req.query;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message parameter is required' });
    return;
  }

  const sessionId = (providedSessionId as string) || 'default';

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  console.log(
    `[Enhanced Server] Processing message for session ${sessionId}: ${message}`
  );

  // Get or create conversation context
  let context = conversationContexts.get(sessionId);
  if (!context) {
    context = {
      sessionId,
      history: [],
    };
    conversationContexts.set(sessionId, context);
  }

  // Send initial thinking signal
  res.write(
    `data: ${JSON.stringify({
      type: 'thinking',
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Progress callback
  const onProgress = (update: any) => {
    console.log('🔍 [Enhanced Server] Progress update:', update);
    res.write(
      `data: ${JSON.stringify({
        type: update.type,
        content: update.content,
        data: update.data,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  };

  try {
    // Use enhanced main agent with modern booking integration
    const mockCredentials = {
      access_token: process.env.GOOGLE_ACCESS_TOKEN || 'mock_access_token',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || 'mock_refresh_token',
      expires_at: process.env.GOOGLE_EXPIRES_AT || '1234567890',
    };

    const result = await runEnhancedMainAgent(
      message,
      mockCredentials,
      context,
      onProgress
    );

    // Send the main response
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: result.response,
        alternatives: result.alternatives || [],
        conflict: result.conflict || false,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Update conversation history
    context.history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response || result.content }
    );

    // Send completion signal
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  } catch (error: any) {
    console.error('[Enhanced Server] Error:', error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }

  // End the stream
  res.end();
});

// Regular endpoint for backward compatibility
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default', creds } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get or create conversation context
    let context = conversationContexts.get(sessionId);
    if (!context) {
      context = {
        sessionId,
        history: [],
      };
      conversationContexts.set(sessionId, context);
    }

    console.log(
      `[Enhanced Server] Processing message for session ${sessionId}: ${message}`
    );

    const mockCredentials = creds || {
      access_token: process.env.GOOGLE_ACCESS_TOKEN || 'mock_access_token',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || 'mock_refresh_token',
      expires_at: process.env.GOOGLE_EXPIRES_AT || '1234567890',
    };

    // Use enhanced main agent
    const result = await runEnhancedMainAgent(
      message,
      mockCredentials,
      context
    );

    // Update conversation history
    context.history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response || result.content }
    );

    res.json({
      content: result.response || result.content,
      alternatives: result.alternatives || [],
      conflict: result.conflict || false,
      sessionId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[Enhanced Server] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    agent: 'enhanced-main-agent-with-modern-booking',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Streaming Server running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/chat/stream`);
  console.log(`📡 Regular endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🎯 Enhanced with Modern Booking Agent Integration`);
  console.log(
    `✅ Workflow: Booking Intent → Modern Agent → Voice Call → Calendar Event`
  );
  console.log(`🔧 Non-booking requests use original main agent`);
});
