# 🤖 Agentic Workflow Streaming Guide

This guide explains how to implement and use streaming progress updates for agentic workflows in your Deana AI calendar assistant.

## Overview

The streaming functionality allows you to show real-time progress updates as the agent processes requests, providing a much better user experience compared to waiting for the entire response to complete.

## How It Works

### 1. Server-Sent Events (SSE)

The system uses Server-Sent Events to stream progress updates from the server to the client in real-time.

### 2. Progress Steps

The agent workflow is broken down into 5 main steps:

1. **Initialization** - Setting up the agent and date context
2. **Analysis** - Analyzing the user's request
3. **Execution** - Executing functions (calendar operations)
4. **Resolution** - Handling conflicts and finding alternatives
5. **Finalization** - Generating the final response

### 3. Event Types

The system sends different types of events:

- `thinking` - Initial processing message
- `progress` - Step-by-step progress updates
- `response` - Final response with results
- `error` - Error messages
- `complete` - Completion signal

## API Endpoints

### Streaming Endpoint

```
POST /api/chat/stream
```

**Request Body:**

```json
{
  "message": "create meeting coffee tomorrow at 3 pm",
  "sessionId": "unique-session-id",
  "creds": {}
}
```

**Response:** Server-Sent Events stream

### Regular Endpoint (Backward Compatibility)

```
POST /api/chat
```

Returns the complete response without streaming.

## Implementation Examples

### 1. HTML/JavaScript Example

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Streaming Agent Test</title>
  </head>
  <body>
    <input type="text" id="messageInput" placeholder="Enter your request" />
    <button onclick="sendMessage()">Send</button>

    <div id="progress"></div>
    <div id="response"></div>

    <script>
      async function sendMessage() {
        const message = document.getElementById('messageInput').value;

        const response = await fetch('http://localhost:3060/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId: 'test' }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) return;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            lines.forEach((line) => {
              if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                handleEvent(data);
              }
            });

            readStream();
          });
        }

        readStream();
      }

      function handleEvent(data) {
        switch (data.type) {
          case 'progress':
            document.getElementById('progress').innerHTML = `${data.content} (${
              data.data?.step || 0
            }/${data.data?.total || 5})`;
            break;
          case 'response':
            document.getElementById('response').innerHTML = data.content;
            break;
        }
      }
    </script>
  </body>
</html>
```

### 2. React Component Example

See `StreamingAgentExample.jsx` for a complete React implementation with:

- Real-time progress updates
- Progress bar visualization
- Message history
- Request cancellation
- Error handling

### 3. Node.js Example

```javascript
const fetch = require('node-fetch');

async function testStreaming() {
  const response = await fetch('http://localhost:3060/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'create meeting coffee tomorrow at 3 pm',
      sessionId: 'test',
    }),
  });

  const text = await response.text();
  const lines = text.split('\n');

  lines.forEach((line) => {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(`${data.type}: ${data.content}`);
    }
  });
}

testStreaming();
```

## Progress Update Structure

Each progress update includes:

```json
{
  "type": "progress",
  "content": "Checking calendar availability...",
  "data": {
    "step": 3,
    "total": 5,
    "functionName": "createEvent"
  },
  "timestamp": "2025-07-19T02:45:30.123Z"
}
```

## Customizing Progress Updates

### Adding New Progress Steps

1. **In the main agent** (`src/agents/mainAgent.ts`):

```typescript
onProgress?.({
  type: 'progress',
  content: 'Your custom message',
  data: { step: 2, total: 5, customData: 'value' },
});
```

2. **In function handlers**:

```typescript
createEvent: async (
  args: any,
  creds: any,
  onProgress?: (update: any) => void
) => {
  onProgress?.({ type: 'progress', content: 'Checking availability...' });
  // ... rest of function
};
```

### Custom Event Types

You can add custom event types by sending them through the progress callback:

```typescript
onProgress?.({
  type: 'custom',
  content: 'Custom event message',
  data: { customField: 'value' },
});
```

## Error Handling

The streaming system includes comprehensive error handling:

1. **Network errors** - Connection failures are caught and reported
2. **Parsing errors** - Invalid JSON is handled gracefully
3. **Function errors** - Errors in agent functions are streamed as error events
4. **Cancellation** - Requests can be cancelled using AbortController

## Best Practices

### 1. User Experience

- Show progress indicators for long-running operations
- Provide clear status messages
- Allow users to cancel requests
- Handle errors gracefully with user-friendly messages

### 2. Performance

- Use appropriate timeouts for streaming connections
- Implement reconnection logic for dropped connections
- Buffer progress updates to avoid overwhelming the UI

### 3. Security

- Validate session IDs
- Implement rate limiting
- Sanitize user input
- Use HTTPS in production

## Testing

### 1. HTML Test Client

Open `test-streaming-client.html` in your browser to test the streaming functionality with a visual interface.

### 2. Command Line Test

Run `node test-streaming-simple.js` to see progress updates in the terminal.

### 3. React Example

Use the `StreamingAgentExample.jsx` component in your React application.

## Troubleshooting

### Common Issues

1. **No progress updates showing**

   - Check that the server is running on port 3060
   - Verify the streaming endpoint is accessible
   - Check browser console for errors

2. **Connection errors**

   - Ensure CORS is properly configured
   - Check network connectivity
   - Verify the server is accepting POST requests

3. **Progress bar not updating**
   - Check that progress events are being sent
   - Verify the UI is properly handling progress events
   - Check for JavaScript errors

### Debug Mode

Enable debug logging by checking the server console for detailed progress information.

## Production Considerations

1. **Load Balancing** - Ensure streaming connections are properly handled
2. **Monitoring** - Add metrics for streaming performance
3. **Fallbacks** - Provide non-streaming fallbacks for older browsers
4. **Caching** - Implement appropriate caching strategies
5. **Security** - Add authentication and authorization

## Conclusion

The streaming agentic workflow provides a much better user experience by showing real-time progress updates. This guide covers the implementation details and best practices for using this functionality in your applications.

For more examples and advanced usage, see the provided code files and test the functionality using the included test clients.
