const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// In-memory session storage (use Redis in production)
const sessions = new Map();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Proxy endpoint to the streaming agent server
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
    // Forward the request to the agent server
    const agentResponse = await fetch('http://localhost:3060/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId,
        creds: creds || {}, // Add your OAuth credentials here
      }),
    });

    if (!agentResponse.ok) {
      throw new Error(`Agent server error: ${agentResponse.status}`);
    }

    // Stream the response from the agent server to the client
    const reader = agentResponse.body.getReader();
    const decoder = new TextDecoder();

    function readStream() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            res.end();
            return;
          }

          const chunk = decoder.decode(value);
          res.write(chunk); // Forward the SSE data directly

          readStream();
        })
        .catch((error) => {
          console.error('Error reading agent stream:', error);
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              content: 'Connection error',
              timestamp: new Date().toISOString(),
            })}\n\n`
          );
          res.end();
        });
    }

    readStream();
  } catch (error) {
    console.error('Error proxying to agent server:', error);
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'Failed to connect to agent server',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
    res.end();
  }
});

// Regular chat endpoint (non-streaming)
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default', creds } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const response = await fetch('http://localhost:3060/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId,
        creds: creds || {},
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error calling agent server:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Session management endpoints
app.post('/api/sessions', (req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  sessions.set(sessionId, {
    id: sessionId,
    createdAt: new Date(),
    messages: [],
  });
  res.json({ sessionId });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    agentServer: 'http://localhost:3060',
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Express App running on port ${PORT}`);
  console.log(`📡 Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(
    `📡 Streaming endpoint: http://localhost:${PORT}/api/chat/stream`
  );
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
});
