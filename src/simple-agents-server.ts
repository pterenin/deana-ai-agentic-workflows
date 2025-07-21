import express from 'express';
import cors from 'cors';

const app = express();
const port = 3003;

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

    console.log(`[Simple Agents Server] Processing message: ${message}`);
    console.log(`[Simple Agents Server] Conversation ID: ${conversationId}`);

    // For now, just echo back the message
    const result = {
      content: `Echo: ${message}`,
    };

    // Update conversation context
    context.history.push({ role: 'user', content: message });
    context.history.push({ role: 'assistant', content: result.content });
    conversationContexts.set(conversationId, context);

    console.log(`[Simple Agents Server] Echo result:`, result);

    res.json({
      success: true,
      message: result.content,
      conversationId,
      context: context,
    });
  } catch (error) {
    console.error('[Simple Agents Server] Error:', error);
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

const server = app.listen(port, () => {
  console.log(`[Simple Agents Server] Server running on port ${port}`);
  console.log(
    `[Simple Agents Server] Health check: http://localhost:${port}/health`
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    '[Simple Agents Server] Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  );
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[Simple Agents Server] Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('Shutting down simple agents server...');
  server.close(() => {
    process.exit(0);
  });
});
