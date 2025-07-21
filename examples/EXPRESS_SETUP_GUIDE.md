# 🚀 Express.js Consumer App Integration Guide

This guide shows you how to integrate the Deana AI streaming agentic workflow into your Node.js Express.js application.

## 📋 Prerequisites

1. **Node.js** (version 16 or higher)
2. **Deana AI Agent Server** running on port 3060
3. **Google Calendar API credentials** (for calendar operations)

## 🛠 Setup Instructions

### 1. **Install Dependencies**

```bash
cd examples
npm install
```

### 2. **Start the Agent Server**

First, make sure the Deana AI agent server is running:

```bash
# In the main project directory
npx ts-node src/streaming-agents-server.ts
```

You should see:

```
🚀 Streaming Agents Server running on port 3060
📡 SSE endpoint: http://localhost:3060/api/chat/stream
📡 Regular endpoint: http://localhost:3060/api/chat
```

### 3. **Start the Consumer App**

```bash
# In the examples directory
npm start
```

You should see:

```
🚀 Express App running on port 3000
📡 Chat endpoint: http://localhost:3000/api/chat
📡 Streaming endpoint: http://localhost:3000/api/chat/stream
🌐 Web interface: http://localhost:3000
```

### 4. **Access the Application**

Open your browser and go to: `http://localhost:3000`

## 🏗 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Browser   │    │  Express App     │    │  Agent Server   │
│   (Port 3000)   │◄──►│  (Port 3000)     │◄──►│  (Port 3060)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### **Flow:**

1. **User** sends message via web interface
2. **Express App** proxies request to Agent Server
3. **Agent Server** processes with streaming updates
4. **Express App** forwards streaming response to browser
5. **Browser** displays real-time progress and results

## 🔧 Configuration

### **Environment Variables**

Create a `.env` file in the examples directory:

```env
# Express App Configuration
PORT=3000
NODE_ENV=development

# Agent Server Configuration
AGENT_SERVER_URL=http://localhost:3060

# Google Calendar API (if needed)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

### **OAuth Integration**

To enable calendar operations, you'll need to add OAuth credentials:

```javascript
// In ExpressIntegration.js, update the creds object:
body: JSON.stringify({
  message,
  sessionId: currentSessionId || 'default',
  creds: {
    access_token: 'your_access_token',
    refresh_token: 'your_refresh_token',
    expires_at: 'expiration_timestamp',
  },
});
```

## 📡 API Endpoints

### **Streaming Chat**

```
POST /api/chat/stream
```

**Request:**

```json
{
  "message": "create meeting coffee tomorrow at 3 pm",
  "sessionId": "unique-session-id",
  "creds": {}
}
```

**Response:** Server-Sent Events stream

### **Regular Chat**

```
POST /api/chat
```

**Request:** Same as streaming
**Response:** Complete JSON response

### **Session Management**

```
POST /api/sessions          # Create new session
GET /api/sessions/:id       # Get session details
```

### **Health Check**

```
GET /health
```

## 🎨 Customization

### **1. Styling**

The web interface uses CSS-in-JS. You can customize the styles in `public/index.html`:

```css
/* Custom color scheme */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --error-color: #dc3545;
}
```

### **2. Progress Steps**

Customize progress steps in the agent server (`src/agents/mainAgent.ts`):

```typescript
onProgress?.({
  type: 'progress',
  content: 'Your custom message',
  data: { step: 2, total: 5, customData: 'value' },
});
```

### **3. Event Handling**

Add custom event types in the frontend:

```javascript
function handleEvent(data, assistantMessage) {
  switch (data.type) {
    case 'custom':
      // Handle custom events
      break;
    // ... existing cases
  }
}
```

## 🔒 Security Considerations

### **1. Authentication**

Add authentication middleware:

```javascript
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

### **2. Rate Limiting**

Add rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### **3. CORS Configuration**

Configure CORS for production:

```javascript
const cors = require('cors');

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
```

## 🚀 Production Deployment

### **1. Environment Setup**

```bash
# Production environment variables
NODE_ENV=production
PORT=3000
AGENT_SERVER_URL=https://your-agent-server.com
REDIS_URL=redis://your-redis-server:6379
```

### **2. Session Storage**

Replace in-memory sessions with Redis:

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Replace Map with Redis
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

### **3. Load Balancing**

Use a reverse proxy like Nginx:

```nginx
upstream express_app {
    server localhost:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://express_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **4. PM2 Process Manager**

```bash
npm install -g pm2
pm2 start ExpressIntegration.js --name "deana-consumer"
pm2 save
pm2 startup
```

## 🧪 Testing

### **1. Manual Testing**

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

### **2. Automated Testing**

Create test files:

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

## 🔍 Monitoring & Logging

### **1. Application Logs**

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

### **2. Performance Monitoring**

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

   **Solution:** Ensure the agent server is running on port 3060

2. **CORS Errors**

   ```
   Access to fetch at 'http://localhost:3000/api/chat/stream' from origin 'http://localhost:3000' has been blocked by CORS policy
   ```

   **Solution:** Check CORS configuration in Express app

3. **Streaming Not Working**
   ```
   No progress updates showing
   ```
   **Solution:** Check browser console for errors and verify SSE implementation

### **Debug Mode**

Enable debug logging:

```javascript
// Add to ExpressIntegration.js
const debug = require('debug')('deana:express');

app.post('/api/chat/stream', async (req, res) => {
  debug('Received streaming request:', req.body);
  // ... rest of code
});
```

## 📚 Additional Resources

- [Server-Sent Events MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- [Google Calendar API](https://developers.google.com/calendar)

## 🤝 Support

For issues and questions:

1. Check the troubleshooting section
2. Review the agent server logs
3. Check browser developer tools
4. Verify network connectivity between services

---

**Happy coding! 🚀**
