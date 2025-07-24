# Client Integration Fix

## Problem

The client code is using the wrong HTTP method and parameter format when calling the modern streaming server.

## Root Cause

1. **Wrong HTTP Method**: Client uses POST, server expects GET
2. **Wrong Parameter Format**: Client sends JSON body, server expects query parameters
3. **Missing Credentials**: Server needs credentials passed correctly

## Solution

### Before (Broken)

```javascript
const assistantResponse = await fetch(`http://localhost:3060/api/chat/stream`, {
  method: 'POST', // ❌ Wrong method
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: text,
    sessionId: sessionId,
    creds: googleTokens,
  }),
});
```

### After (Fixed)

```javascript
// Encode message for URL
const encodedMessage = encodeURIComponent(text);
const encodedSessionId = encodeURIComponent(sessionId);

const assistantResponse = await fetch(
  `http://localhost:3060/api/chat/stream?message=${encodedMessage}&sessionId=${encodedSessionId}`,
  {
    method: 'GET', // ✅ Correct method
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  }
);
```

### Alternative: Use the POST endpoint

```javascript
const assistantResponse = await fetch(
  `http://localhost:3060/api/chat`, // ✅ Use POST endpoint
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      sessionId: sessionId,
    }),
  }
);
```

## Complete Fixed Client Code

```javascript
router.post('/chat', async (req, res) => {
  try {
    const { text, googleUserId } = req.body;

    if (!text || !googleUserId) {
      return res.status(400).json({
        error: 'Missing required fields: text and googleUserId',
      });
    }

    // Get Google tokens (existing code)
    const tokenResult = await pool.query(
      `SELECT access_token, refresh_token, scope, token_type, expires_at FROM user_google_tokens WHERE google_user_id = $1`,
      [googleUserId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error:
          'No Google tokens found for user. Please reconnect your Google account.',
      });
    }

    const tokens = tokenResult.rows[0];
    const sessionId = `user-${googleUserId}`;

    // ✅ OPTION 1: Use GET endpoint with query parameters
    const encodedMessage = encodeURIComponent(text);
    const encodedSessionId = encodeURIComponent(sessionId);

    const assistantResponse = await fetch(
      `http://localhost:3060/api/chat/stream?message=${encodedMessage}&sessionId=${encodedSessionId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      }
    );

    // ✅ OPTION 2: Use POST endpoint (simpler)
    /*
    const assistantResponse = await fetch(
      `http://localhost:3060/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
        }),
      }
    );

    if (!assistantResponse.ok) {
      throw new Error(`HTTP error! status: ${assistantResponse.status}`);
    }

    const result = await assistantResponse.json();

    // Log the interaction
    await pool.query(
      `INSERT INTO ai_chat_logs (user_question, ai_response, user_agent, user_ip)
       VALUES ($1, $2, $3, $4)`,
      [text, result.response, req.headers["user-agent"], req.ip]
    );

    return res.json({
      response: result.response,
      sessionId: result.sessionId,
      timestamp: result.timestamp,
    });
    */

    // Handle streaming response (existing code works with GET)
    if (!assistantResponse.ok) {
      throw new Error(`HTTP error! status: ${assistantResponse.status}`);
    }

    const reader = assistantResponse.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    // ... rest of your streaming code remains the same ...
  } catch (error) {
    console.error('Error in /chat endpoint:', error);
    res.status(500).json({
      error: 'Internal server error processing chat request',
    });
  }
});
```

## Key Changes

1. **Use GET method** with query parameters for streaming
2. **Properly encode** message and sessionId for URL
3. **Set correct headers** for SSE
4. **Alternative**: Use the simpler POST `/api/chat` endpoint for non-streaming

## Testing

```bash
# Test the fixed endpoint
curl "http://localhost:3060/api/chat/stream?message=book%20a%20hair%20appointment%20tomorrow%20at%208am&sessionId=test-session"
```
