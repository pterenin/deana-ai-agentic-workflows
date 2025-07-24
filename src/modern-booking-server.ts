import express from 'express';
import cors from 'cors';
import {
  ModernBookingAgent,
  BookingAgentContext,
} from './agents/modern/modernBookingAgent';

const app = express();
const PORT = process.env.PORT || 3061;

// Middleware
app.use(cors());
app.use(express.json());

// Store conversation contexts
const conversationContexts = new Map<string, BookingAgentContext>();

// Mock credentials (allow mock for development)
const mockCredentials = {
  google_access_token: process.env.GOOGLE_ACCESS_TOKEN || 'mock_access_token',
  google_refresh_token:
    process.env.GOOGLE_REFRESH_TOKEN || 'mock_refresh_token',
  google_client_id: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
  google_client_secret:
    process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
};

// Streaming endpoint for modern booking agent
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

  // Send initial thinking signal
  res.write(
    `data: ${JSON.stringify({
      type: 'thinking',
      content: 'Processing your booking request...',
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  // Get or create conversation context
  let context = conversationContexts.get(sessionId);
  if (!context) {
    context = {
      sessionId,
      conversationHistory: [],
    };
    conversationContexts.set(sessionId, context);
  }

  // Create progress callback
  const onProgress = (update: any) => {
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
    // Create modern booking agent
    const bookingAgent = new ModernBookingAgent(mockCredentials, onProgress);

    // Process the booking request
    const result = await bookingAgent.processBookingRequest(message, context);

    // Update conversation history
    context.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response || 'No response' }
    );

    // Send the main response
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: result.response,
        alternatives: result.context?.lastConflict?.alternatives || [],
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Send completion signal
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  } catch (error: any) {
    console.error('[Modern Booking Server] Error:', error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content:
          'Sorry, I encountered an error processing your booking request.',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }

  // End the stream
  res.end();
});

// Non-streaming endpoint
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get or create conversation context
    let context = conversationContexts.get(sessionId);
    if (!context) {
      context = {
        sessionId,
        conversationHistory: [],
      };
      conversationContexts.set(sessionId, context);
    }

    // Create modern booking agent
    const bookingAgent = new ModernBookingAgent(mockCredentials);

    // Process the booking request
    const result = await bookingAgent.processBookingRequest(message, context);

    // Update conversation history
    context.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response || 'No response' }
    );

    res.json({
      content: result.response,
      alternatives: result.context?.lastConflict?.alternatives || [],
      sessionId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[Modern Booking Server] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    agent: 'modern-booking-agent',
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('[Modern Booking Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Modern Booking Server running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/chat/stream`);
  console.log(`📡 Regular endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🔧 Modern Agent Architecture: Enforces proper booking workflow`);
  console.log(`✅ Workflow: Check Availability → Voice Call → Calendar Event`);
});
