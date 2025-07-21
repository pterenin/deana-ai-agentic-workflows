import express from 'express';
import cors from 'cors';
import { runMainAgent } from './agents/mainAgent';

const app = express();
const PORT = process.env.PORT || 3060;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory conversation context
const conversationContexts = new Map<string, any>();

// Streaming endpoint for multi-step agent responses
app.post('/api/chat/stream', async (req, res) => {
  const { message, sessionId = 'default', creds } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  try {
    // Get or create conversation context
    let context = conversationContexts.get(sessionId);
    if (!context) {
      context = { history: [] };
      conversationContexts.set(sessionId, context);
    }

    // Add current message to context
    context.history.push({ role: 'user', content: message });

    console.log(
      `[Streaming Server] Processing message for session ${sessionId}:`,
      message
    );

    // Send initial "thinking" message
    res.write(
      `data: ${JSON.stringify({
        type: 'thinking',
        content: 'Processing your request...',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Run the agent with progress updates
    const result = await runMainAgent(message, creds, context, (update) => {
      // Send progress update to client
      console.log('🔍 [Streaming Server] Progress update:', update);
      res.write(
        `data: ${JSON.stringify({
          type: update.type,
          content: update.content,
          data: update.data,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    });

    // Send the main response
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: result.content,
        alternatives: result.alternatives,
        conflict: result.conflict,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Add agent response to context
    context.history.push({ role: 'assistant', content: result.content });

    // Send completion signal
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  } catch (error) {
    console.error('[Streaming Server] Error:', error);

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
      context = { history: [] };
      conversationContexts.set(sessionId, context);
    }

    // Add current message to context
    context.history.push({ role: 'user', content: message });

    console.log(
      `[Agents Server] Processing message for session ${sessionId}:`,
      message
    );

    // Run the agent
    const result = await runMainAgent(message, creds, context);

    // Add agent response to context
    context.history.push({ role: 'assistant', content: result.content });

    console.log('[Agents Server] Agent result:', result);

    res.json({
      content: result.content,
      alternatives: result.alternatives,
      conflict: result.conflict,
    });
  } catch (error) {
    console.error('[Agents Server] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Streaming Agents Server running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/chat/stream`);
  console.log(`📡 Regular endpoint: http://localhost:${PORT}/api/chat`);
});
