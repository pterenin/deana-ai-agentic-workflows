import express from 'express';
import cors from 'cors';
import { runMainAgent } from './agents/mainAgent';
import {
  ModernBookingAgent,
  BookingAgentContext,
} from './agents/modern/modernBookingAgent';
import { storeSessionCredentials } from './utils/sessionCredentialStore';

// Helper function to remove timezone abbreviations from responses
function removeTimezoneAbbreviations(content: string): string {
  if (!content) return content;

  // Remove common timezone abbreviations in parentheses only
  // This preserves AM/PM while removing timezone info
  return content
    .replace(
      /\s*\((PDT|PST|UTC|EST|EDT|CST|CDT|MST|MDT|GMT|BST|CET|JST|IST)\)/g,
      ''
    ) // Remove specific timezone abbreviations in parentheses
    .replace(/\s*\([A-Z]{3,4}\)/g, ''); // Remove other 3-4 letter abbreviations in parentheses (but not AM/PM)
}

const app = express();
const PORT = process.env.PORT || 3060;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory conversation context
const conversationContexts = new Map<string, any>();

// Enhanced main agent runner that uses modern booking for booking intents
async function runEnhancedMainAgent(
  userMessage: string,
  creds: any,
  email: string,
  context: any,
  onProgress?: (update: any) => void,
  primaryAccount?: any,
  secondaryAccount?: any
): Promise<any> {
  // Detect booking intent
  const bookingIntent =
    /book.*(appointment|hair|barber|cut|massage|nail|doctor|dentist)/i.test(
      userMessage
    );
  const alternativeSelection =
    context?.lastBookingConflict &&
    /(\d{1,2})(am|pm)|first|second|third|1st|2nd|3rd/i.test(userMessage);

  if (bookingIntent || alternativeSelection) {
    onProgress?.({
      type: 'progress',
      content: 'Detected booking request. Using modern booking workflow...',
    });

    // Create modern booking agent context
    const bookingContext: BookingAgentContext = {
      sessionId: context.sessionId || 'default',
      conversationHistory: context.history || [],
      lastConflict: context.lastBookingConflict,
    };

    // Use modern booking agent
    const modernBookingAgent = new ModernBookingAgent(creds, email, onProgress);
    const result = await modernBookingAgent.processBookingRequest(
      userMessage,
      bookingContext
    );

    // Update main context with booking results
    if (result.context?.lastConflict) {
      context.lastBookingConflict = result.context.lastConflict;
    }

    return {
      response: result.response,
      alternatives: result.context?.lastConflict?.alternatives || [],
      conflict: !!result.context?.lastConflict,
      context: context,
      toolResults: result.toolResults,
      usage: result.usage,
    };
  } else {
    // Use original main agent for non-booking requests
    return await runMainAgent(
      userMessage,
      creds,
      email,
      context,
      onProgress,
      primaryAccount,
      secondaryAccount
    );
  }
}

// Streaming endpoint for multi-step agent responses
app.post('/api/chat/stream', async (req, res) => {
  const {
    message,
    sessionId = 'default',
    creds,
    email,
    primary_account,
    secondary_account,
  } = req.body;

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
    // Get or create conversation context
    let context = conversationContexts.get(sessionId);
    if (!context) {
      context = { history: [], sessionId };
      conversationContexts.set(sessionId, context);
    }

    // Ensure sessionId is always in context
    context.sessionId = sessionId;

    // Store session credentials for easy access by functions
    if (primary_account || secondary_account) {
      storeSessionCredentials(sessionId, primary_account, secondary_account);
    }

    // Add current message to context
    context.history.push({ role: 'user', content: message });

    console.log(
      `[Streaming Server] Processing message for session ${sessionId}:`,
      message
    );

    // Send initial "thinking" message
    res.write(
      `data: ${JSON.stringify({
        type: 'thinking',
        content: 'Processing your request...',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Extract credentials from primary account
    const effectiveCreds = primary_account?.creds ||
      creds || {
        access_token: 'valid',
        refresh_token: 'valid',
        expires_at: '2025-12-31',
      };

    // Run the enhanced agent with progress updates
    const result = await runEnhancedMainAgent(
      message,
      effectiveCreds,
      email || primary_account?.email,
      context,
      (update) => {
        // Send progress update to client
        console.log('🔍 [Streaming Server] Progress update:', update);
        res.write(
          `data: ${JSON.stringify({
            type: update.type,
            content: update.content,
            data: update.data,
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
      },
      primary_account,
      secondary_account
    );

    // Send the main response (with timezone removal)
    const cleanedContent = removeTimezoneAbbreviations(
      result.response || result.content
    );
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: cleanedContent, // Apply timezone removal
        alternatives: result.alternatives,
        conflict: result.conflict,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Add agent response to context (with cleaned content)
    context.history.push({
      role: 'assistant',
      content: cleanedContent,
    });

    // Preserve conflict-related context data
    if (result.awaitingReschedulingDecision) {
      context.awaitingReschedulingDecision =
        result.awaitingReschedulingDecision;
      context.pendingReschedulingProposals =
        result.pendingReschedulingProposals;
      console.log('✅ [Streaming Server] Preserved rescheduling context:', {
        sessionId,
        proposalsCount: result.pendingReschedulingProposals?.length || 0,
      });
    }

    // Debug: Show current context state
    console.log('🔍 [Streaming Server] Current context state:', {
      sessionId,
      historyLength: context.history?.length || 0,
      hasReschedulingDecision: !!context.awaitingReschedulingDecision,
      hasPendingProposals: !!context.pendingReschedulingProposals,
    });

    // Send completion signal
    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  } catch (error) {
    console.error('[Streaming Server] Error:', error);

    // Send error message
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );
  }

  // End the stream
  res.end();
});

// Regular endpoint for backward compatibility
app.post('/api/chat', async (req, res) => {
  const {
    message,
    sessionId = 'default',
    creds,
    email,
    primary_account,
    secondary_account,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get or create conversation context
    let context = conversationContexts.get(sessionId);
    if (!context) {
      context = { history: [] };
      conversationContexts.set(sessionId, context);
    }

    console.log(
      `[Streaming Server] Processing message for session ${sessionId}:`,
      message
    );

    // Use enhanced main agent
    const result = await runEnhancedMainAgent(
      message,
      creds,
      email,
      context,
      undefined,
      primary_account,
      secondary_account
    );

    // Update conversation history
    context.history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.response || result.content }
    );

    res.json({
      content: result.response || result.content,
      alternatives: result.alternatives || [],
      conflict: result.conflict || false,
      sessionId,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[Streaming Server] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    agent: 'enhanced-streaming-server-with-modern-booking',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Streaming Server running on port ${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/chat/stream`);
  console.log(`📡 Regular endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🎯 Enhanced with Modern Booking Agent Integration`);
  console.log(
    `✅ Workflow: Booking Intent → Modern Agent → Voice Call → Calendar Event`
  );
  console.log(`🔧 Non-booking requests use original main agent`);
});
