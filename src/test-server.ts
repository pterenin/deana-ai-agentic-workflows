import express from 'express';
import cors from 'cors';

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working', body: req.body });
});

const server = app.listen(port, () => {
  console.log(`[Test Server] Server running on port ${port}`);
  console.log(`[Test Server] Health check: http://localhost:${port}/health`);
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('Shutting down test server...');
  server.close(() => {
    process.exit(0);
  });
});
