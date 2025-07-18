import 'dotenv/config';
import express from 'express';
import { WorkflowClient, Connection } from '@temporalio/client';
import { deanaWorkflow } from './workflows/deanaWorkflow';

const app = express();
app.use(express.json());

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Periodic memory usage logging
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(
    '[Memory]',
    `rss: ${Math.round(mem.rss / 1024 / 1024)}MB, heapUsed: ${Math.round(
      mem.heapUsed / 1024 / 1024
    )}MB, heapTotal: ${Math.round(mem.heapTotal / 1024 / 1024)}MB`
  );
}, 10000);

const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

app.post('/assistant', async (req, res) => {
  try {
    const { message, googleTokens } = req.body;
    if (!message || !googleTokens) {
      return res.status(400).json({ error: 'Missing message or googleTokens' });
    }

    // Connect to Temporal
    const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
    const client = new WorkflowClient({
      connection,
      namespace: TEMPORAL_NAMESPACE,
    });

    // Start the workflow
    const workflowId = `deana-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const handle = await client.start(deanaWorkflow, {
      taskQueue: 'deana',
      workflowId,
      args: [{ creds: googleTokens, userMessage: message }],
    });

    console.log(`Started workflow ${workflowId}`);

    // Wait for the result
    const result = await handle.result();

    res.json({ success: true, workflowId, result });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

const PORT = process.env.PORT || 3050;
app.listen(PORT, () => {
  console.log(`Deana Assistant API listening on port ${PORT}`);
});
