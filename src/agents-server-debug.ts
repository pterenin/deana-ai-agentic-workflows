import express from 'express';
import cors from 'cors';

console.log('[Debug] Starting agents server...');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

console.log('[Debug] Express app created');

// Store conversation context (in production, use a proper database)
const conversationContexts = new Map<string, any>();

app.post('/api/chat', async (req, res) => {
  try {
    console.log('[Debug] Received chat request');
    const { message, creds, conversationId } = req.body;

    if (!message || !creds) {
      return res
        .status(400)
        .json({ error: 'Message and credentials are required' });
    }

    // Get or create conversation context
    const context = conversationContexts.get(conversationId) || { history: [] };

    console.log(`[Debug] Processing message: ${message}`);
    console.log(`[Debug] Conversation ID: ${conversationId}`);

    // For now, just echo back the message
    const result = {
      content: `Echo: ${message}`,
    };

    // Update conversation context
    context.history.push({ role: 'user', content: message });
    context.history.push({ role: 'assistant', content: result.content });
    conversationContexts.set(conversationId, context);

    console.log(`[Debug] Echo result:`, result);

    res.json({
      success: true,
      message: result.content,
      conversationId,
      context: context,
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
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

console.log('[Debug] About to start server...');

const server = app.listen(port, () => {
  console.log(`[Debug] Server running on port ${port}`);
  console.log(`[Debug] Health check: http://localhost:${port}/health`);
});

console.log('[Debug] Server started');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Debug] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Debug] Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('Shutting down debug agents server...');
  server.close(() => {
    process.exit(0);
  });
});

console.log('[Debug] Event handlers set up');
