import express from 'express';
import cors from 'cors';
import { runMainAgent } from './agents/mainAgent';

const app = express();
const port = process.env.PORT || 3060;

app.use(cors());
app.use(express.json());

// Store conversation context (in production, use a proper database)
const conversationContexts = new Map<string, any>();

app.post('/api/chat', async (req, res) => {
  try {
    const { message, creds, conversationId } = req.body;

    if (!message || !creds) {
      return res
        .status(400)
        .json({ error: 'Message and credentials are required' });
    }

    // Get or create conversation context
    const context = conversationContexts.get(conversationId) || { history: [] };

    console.log(`[Agents Server] Processing message: ${message}`);
    console.log(`[Agents Server] Conversation ID: ${conversationId}`);

    // Add current user message to context before calling agent
    context.history.push({ role: 'user', content: message });

    // Run the main agent
    const result = await runMainAgent(message, creds, context);

    // Update conversation context with agent response
    context.history.push({ role: 'assistant', content: result.content });
    conversationContexts.set(conversationId, context);

    console.log(`[Agents Server] Agent result:`, result);

    res.json({
      success: true,
      message: result.content,
      conversationId,
      context: context,
    });
  } catch (error) {
    console.error('[Agents Server] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get conversation history
app.get('/api/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const context = conversationContexts.get(conversationId);

  if (!context) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({
    conversationId,
    history: context.history,
  });
});

// Clear conversation history
app.delete('/api/conversation/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  conversationContexts.delete(conversationId);

  res.json({ success: true, message: 'Conversation cleared' });
});

const server = app.listen(port, () => {
  console.log(`[Agents Server] Server running on port ${port}`);
  console.log(`[Agents Server] Health check: http://localhost:${port}/health`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    '[Agents Server] Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  );
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Agents Server] Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('Shutting down agents server...');
  server.close(() => {
    process.exit(0);
  });
});
