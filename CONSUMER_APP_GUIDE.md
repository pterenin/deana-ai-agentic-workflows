# 🚀 Consumer App Integration Guide

This guide shows you how to integrate the Deana AI streaming agentic workflow into your consumer applications.

## 📋 What You Get

### **Complete Express.js Application**

- ✅ **Streaming Chat Interface** - Real-time progress updates
- ✅ **Beautiful UI** - Modern, responsive design
- ✅ **Session Management** - Track conversation history
- ✅ **Error Handling** - Graceful error recovery
- ✅ **Production Ready** - Security, monitoring, deployment guides

### **Key Features**

- 🤖 **AI Calendar Assistant** - Natural language calendar management
- 📊 **Real-time Progress** - See what the AI is doing step-by-step
- 🕐 **Conflict Resolution** - Automatic alternative time slot suggestions
- 📱 **Mobile Responsive** - Works on all devices
- 🔄 **Request Cancellation** - Cancel long-running operations

## 🚀 Quick Start

### **1. Start the Agent Server**

```bash
# In the main project directory
npx ts-node src/streaming-agents-server.ts
```

### **2. Start the Consumer App**

```bash
# Option A: Use the quick start script
cd examples
./quick-start.sh

# Option B: Manual setup
cd examples
npm install
npm start
```

### **3. Open Your Browser**

Go to: `http://localhost:3000`

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │    │  Express App     │    │  Agent Server   │
│   (Port 3000)   │◄──►│  (Port 3000)     │◄──►│  (Port 3060)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Data Flow:**

1. **User** types message in web interface
2. **Express App** proxies request to Agent Server
3. **Agent Server** processes with streaming updates
4. **Express App** forwards streaming response to browser
5. **Browser** displays real-time progress and results

## 📡 API Integration

### **Streaming Endpoint**

```javascript
// Frontend JavaScript
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'create meeting coffee tomorrow at 3 pm',
    sessionId: 'unique-session-id',
    creds: {}, // OAuth credentials
  }),
});

// Handle Server-Sent Events
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
```

### **Event Types**

```javascript
function handleEvent(data) {
  switch (data.type) {
    case 'thinking':
      // "Processing your request..."
      break;
    case 'progress':
      // "Checking calendar availability... (3/5)"
      break;
    case 'response':
      // Final response with alternatives
      break;
    case 'error':
      // Error message
      break;
    case 'complete':
      // Stream completed
      break;
  }
}
```

## 🎨 UI Components

### **Progress Bar**

```html
<div class="progress-container">
  <div class="progress-bar">
    <div class="progress-fill" style="width: 60%"></div>
  </div>
  <div class="progress-text">Checking availability... (3/5)</div>
  <button class="cancel-button">Cancel</button>
</div>
```

### **Alternative Time Slots**

```html
<div class="alternatives">
  <h4>🕐 Alternative Time Slots:</h4>
  <div class="alternatives-grid">
    <button class="alternative-option">
      1 hour earlier: 2:00 PM - 3:00 PM
    </button>
    <button class="alternative-option">1 hour later: 4:00 PM - 5:00 PM</button>
  </div>
</div>
```

## 🔧 Customization

### **1. Styling**

The app uses CSS-in-JS. Customize colors, fonts, and layout in `public/index.html`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --error-color: #dc3545;
}
```

### **2. Progress Steps**

Customize progress messages in the agent server:

```typescript
// In src/agents/mainAgent.ts
onProgress?.({
  type: 'progress',
  content: 'Your custom message',
  data: { step: 2, total: 5, customData: 'value' },
});
```

### **3. Event Handling**

Add custom event types:

```javascript
function handleEvent(data) {
  switch (data.type) {
    case 'custom':
      // Handle custom events
      break;
    // ... existing cases
  }
}
```

## 🔒 Security

### **Authentication**

```javascript
// Add to ExpressIntegration.js
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Verify token
  next();
};

app.post('/api/chat/stream', authenticateUser, async (req, res) => {
  // ... existing code
});
```

### **Rate Limiting**

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## 🚀 Production Deployment

### **1. Environment Setup**

```bash
NODE_ENV=production
PORT=3000
AGENT_SERVER_URL=https://your-agent-server.com
REDIS_URL=redis://your-redis-server:6379
```

### **2. Session Storage (Redis)**

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

app.post('/api/sessions', async (req, res) => {
  const sessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  await redis.setex(
    sessionId,
    3600,
    JSON.stringify({
      id: sessionId,
      createdAt: new Date(),
      messages: [],
    })
  );
  res.json({ sessionId });
});
```

### **3. Process Manager (PM2)**

```bash
npm install -g pm2
pm2 start ExpressIntegration.js --name "deana-consumer"
pm2 save
pm2 startup
```

## 🧪 Testing

### **Manual Testing**

```bash
# Test streaming endpoint
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "create meeting coffee tomorrow at 3 pm"}'

# Test regular endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "what meetings do I have tomorrow?"}'
```

### **Automated Testing**

```javascript
// test/chat.test.js
const request = require('supertest');
const app = require('../ExpressIntegration');

describe('Chat API', () => {
  test('should handle streaming requests', async () => {
    const response = await request(app)
      .post('/api/chat/stream')
      .send({ message: 'test message' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });
});
```

## 📊 Monitoring

### **Application Logs**

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});
```

### **Performance Monitoring**

```javascript
const responseTime = require('response-time');

app.use(
  responseTime((req, res, time) => {
    console.log(`${req.method} ${req.url} - ${time}ms`);
  })
);
```

## 🐛 Troubleshooting

### **Common Issues**

1. **Agent Server Not Running**

   ```
   Error: Failed to connect to agent server
   ```

   **Solution:** Ensure agent server is running on port 3060

2. **CORS Errors**

   ```
   Access to fetch at 'http://localhost:3000/api/chat/stream' from origin 'http://localhost:3000' has been blocked by CORS policy
   ```

   **Solution:** Check CORS configuration

3. **No Progress Updates**
   ```
   No progress updates showing
   ```
   **Solution:** Check browser console and verify SSE implementation

### **Debug Mode**

```javascript
const debug = require('debug')('deana:express');

app.post('/api/chat/stream', async (req, res) => {
  debug('Received streaming request:', req.body);
  // ... rest of code
});
```

## 📁 File Structure

```
examples/
├── ExpressIntegration.js          # Main Express app
├── package.json                   # Dependencies
├── quick-start.sh                # Quick start script
├── EXPRESS_SETUP_GUIDE.md        # Detailed setup guide
└── public/
    └── index.html                # Web interface
```

## 🎯 Use Cases

### **1. Calendar Management**

- Schedule meetings with natural language
- Check availability
- Handle scheduling conflicts
- Find alternative time slots

### **2. Productivity Apps**

- Integrate into existing productivity tools
- Add AI-powered scheduling to your app
- Provide intelligent calendar insights

### **3. Customer Support**

- AI-powered scheduling assistance
- Real-time progress updates
- Conflict resolution for appointments

### **4. Enterprise Applications**

- Meeting room booking
- Resource scheduling
- Team coordination

## 🔗 Integration Examples

### **React Integration**

See `examples/ReactIntegration.jsx` for a complete React component.

### **Vue.js Integration**

```javascript
// Vue.js component example
export default {
  data() {
    return {
      messages: [],
      isLoading: false,
      progress: { step: 0, total: 5, content: '' },
    };
  },
  methods: {
    async sendMessage(message) {
      // Implementation similar to Express example
    },
  },
};
```

### **Mobile Apps**

```javascript
// React Native example
const sendMessage = async (message) => {
  const response = await fetch('http://your-server.com/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId: 'mobile-session' }),
  });

  // Handle streaming response
};
```

## 📚 Resources

- [Server-Sent Events Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [Google Calendar API](https://developers.google.com/calendar)

## 🤝 Support

For help and questions:

1. Check the troubleshooting section
2. Review server logs
3. Check browser developer tools
4. Verify network connectivity

---

**Ready to build amazing AI-powered calendar applications! 🚀**
