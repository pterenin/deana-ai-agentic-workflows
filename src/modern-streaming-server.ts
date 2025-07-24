import express from 'express';
import cors from 'cors';
import {
  ModernAgentOrchestrator,
  ProgressUpdate,
} from './agents/modern/modernAgentRunner';

const app = express();
const PORT = process.env.PORT || 3060;

// Middleware
app.use(cors());
app.use(express.json());

// Environment validation
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Modern Agent Orchestrator
const orchestrator = new ModernAgentOrchestrator();

// Structured logging
class Logger {
  static info(message: string, data?: any) {
    console.log(
      `[${new Date().toISOString()}] INFO: ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  }

  static error(message: string, error?: any) {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
  }

  static warn(message: string, data?: any) {
    console.warn(
      `[${new Date().toISOString()}] WARN: ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  }
}

// Mock credentials (in production, these should come from secure storage)
const mockCredentials = {
  google_access_token: process.env.GOOGLE_ACCESS_TOKEN || 'mock_access_token',
  google_refresh_token:
    process.env.GOOGLE_REFRESH_TOKEN || 'mock_refresh_token',
  google_client_id: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
  google_client_secret:
    process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
};

// Validate credentials (allow mock credentials for development)
function validateCredentials(): boolean {
  const required = [
    'GOOGLE_ACCESS_TOKEN',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    Logger.warn(
      `Missing environment variables: ${missing.join(
        ', '
      )} - using mock credentials for development`
    );
    return true; // Allow mock credentials in development
  }

  return true;
}

// Generate session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Streaming endpoint (supports both GET and POST)
const handleStreamingRequest = async (
  req: express.Request,
  res: express.Response
) => {
  // Support both GET (query params) and POST (body)
  const {
    message,
    sessionId: providedSessionId,
    creds,
  } = req.method === 'GET' ? req.query : req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message parameter is required' });
    return;
  }

  if (!validateCredentials()) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const sessionId = (providedSessionId as string) || generateSessionId();

  Logger.info('Processing streaming request', {
    sessionId,
    messageLength: message.length,
    hasCredentials: !!mockCredentials.google_access_token,
  });

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Progress callback for streaming updates
  const onProgress = (update: ProgressUpdate) => {
    const data = {
      type: update.type,
      content: update.content,
      data: update.data,
      timestamp: update.timestamp.toISOString(),
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Use credentials from request if provided, otherwise use mock credentials
    const requestCredentials = creds || mockCredentials;

    // Process request with modern orchestrator
    const result = await orchestrator.processRequest(
      message,
      requestCredentials,
      sessionId,
      onProgress
    );

    // Send final result
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: result.response,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Send execution trace for debugging (optional)
    if (process.env.NODE_ENV === 'development') {
      res.write(
        `data: ${JSON.stringify({
          type: 'debug',
          executionTrace: result.executionTrace,
          usage: result.usage,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    }

    Logger.info('Request completed successfully', {
      sessionId,
      executionSteps: result.executionTrace?.length || 0,
      usage: result.usage,
    });
  } catch (error: any) {
    Logger.error('Request failed', {
      sessionId,
      error: error.message,
      stack: error.stack,
    });

    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  } finally {
    res.write(
      `data: ${JSON.stringify({
        type: 'final',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    res.end();
  }
};

// Support both GET and POST for streaming
app.get('/api/chat/stream', handleStreamingRequest);
app.post('/api/chat/stream', handleStreamingRequest);

// Non-streaming endpoint for compatibility
app.post('/api/chat', async (req, res) => {
  const { message, sessionId: providedSessionId } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  if (!validateCredentials()) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  const sessionId = providedSessionId || generateSessionId();

  Logger.info('Processing non-streaming request', {
    sessionId,
    messageLength: message.length,
  });

  try {
    const result = await orchestrator.processRequest(
      message,
      mockCredentials,
      sessionId
    );

    res.json({
      response: result.response,
      sessionId,
      timestamp: new Date().toISOString(),
      usage: result.usage,
    });

    Logger.info('Non-streaming request completed', {
      sessionId,
      executionSteps: result.executionTrace?.length || 0,
    });
  } catch (error: any) {
    Logger.error('Non-streaming request failed', {
      sessionId,
      error: error.message,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasGoogleCredentials: validateCredentials(),
    },
  };

  res.json(health);
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    Logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
    });

    res.status(500).json({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
);

// Start server
app.listen(PORT, () => {
  Logger.info(`🚀 Modern Streaming Agents Server running on port ${PORT}`);
  Logger.info(`📡 SSE endpoint: http://localhost:${PORT}/api/chat/stream`);
  Logger.info(`📡 Regular endpoint: http://localhost:${PORT}/api/chat`);
  Logger.info(`🏥 Health endpoint: http://localhost:${PORT}/health`);

  // Environment check
  if (!validateCredentials()) {
    Logger.warn(
      'Server started but Google credentials are not properly configured'
    );
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});
