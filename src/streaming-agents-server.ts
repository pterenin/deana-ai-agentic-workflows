import express from 'express';
import cors from 'cors';
import { runMainAgent } from './agents/mainAgent';
import {
  ModernBookingAgent,
  BookingAgentContext,
} from './agents/modern/modernBookingAgent';

import { AccountInfo, SessionContext } from './agents/types';

// Helper function to remove timezone abbreviations from responses
function removeTimezoneAbbreviations(content: string): string {
  if (!content) return content;

  // Remove common timezone abbreviations in parentheses only
  // This preserves AM/PM while removing timezone info
  return content
    .replace(
      /\s*\((PDT|PST|UTC|EST|EDT|CST|CDT|MST|MDT|GMT|BST|CET|JST|IST)\)/g,
      ''
    )
    .replace(/\s*\([A-Z]{3,4}\)/g, '');
}

const app = express();
const PORT = process.env.PORT || 3060;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory conversation context with enhanced session data
const conversationContexts = new Map<string, SessionContext>();

// Helper function to get account by title or default to primary
function getAccountByTitle(
  accounts: { primary: AccountInfo; secondary: AccountInfo | null },
  title?: string
): AccountInfo {
  if (!title) return accounts.primary;

  const titleLower = title.toLowerCase();
  const primaryTitle = accounts.primary.title.toLowerCase();
  const secondaryTitle = accounts.secondary?.title.toLowerCase();

  // Check if user specified primary account by title
  if (titleLower === primaryTitle || titleLower === 'primary') {
    return accounts.primary;
  }

  // Check if user specified secondary account by title
  if (
    accounts.secondary &&
    (titleLower === secondaryTitle || titleLower === 'secondary')
  ) {
    return accounts.secondary;
  }

  // Default to primary if no match
  return accounts.primary;
}

// Enhanced main agent runner that uses modern booking for booking intents
async function runEnhancedMainAgent(
  userMessage: string,
  context: SessionContext,
  onProgress?: (update: any) => void
): Promise<any> {
  // Get default account (primary) for backward compatibility
  const defaultAccount = context.accounts?.primary;
  const defaultCreds = defaultAccount?.creds;
  const defaultEmail = defaultAccount?.email;

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

    // Use modern booking agent with default credentials
    const modernBookingAgent = new ModernBookingAgent(
      defaultCreds,
      defaultEmail,
      context.userPhone,
      context.userTimeZone,
      context.clientNowISO,
      onProgress
    );
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
      defaultCreds,
      defaultEmail,
      context,
      onProgress
    );
  }
}

// Streaming endpoint for multi-step agent responses
app.post('/api/chat/stream', async (req, res) => {
  const {
    message,
    sessionId = 'default',
    email,
    phone,
    timezone,
    clientNowISO,
    primary_account,
    secondary_account,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!primary_account || !primary_account.email || !primary_account.creds) {
    return res.status(400).json({
      error: 'Primary account with email and credentials is required',
    });
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
    let context: SessionContext = conversationContexts.get(sessionId) || {
      sessionId,
      history: [],
    };

    // Update context with account information
    context.accounts = {
      primary: primary_account,
      secondary: secondary_account || null,
    };
    context.userEmail = email;
    context.userPhone = phone;
    context.userTimeZone = timezone || 'America/Los_Angeles';
    context.clientNowISO = clientNowISO;
    console.log('[Streaming Server] Incoming phone from request body:', phone);
    console.log(
      '[Streaming Server] Incoming timezone from request body:',
      timezone
    );
    console.log(
      '[Streaming Server] Incoming clientNowISO from request body:',
      clientNowISO
    );
    console.log(
      '[Streaming Server] Session userPhone set to:',
      context.userPhone
    );
    context.sessionId = sessionId;

    conversationContexts.set(sessionId, context);

    // Add current message to context
    context.history.push({ role: 'user', content: message });

    console.log(
      `[Streaming Server] Processing message for session ${sessionId}:`,
      message
    );
    console.log(
      `[Streaming Server] Accounts: Primary (${primary_account.title}: ${
        primary_account.email
      })${
        secondary_account
          ? `, Secondary (${secondary_account.title}: ${secondary_account.email})`
          : ''
      }`
    );

    // Send initial "thinking" message
    res.write(
      `data: ${JSON.stringify({
        type: 'thinking',
        content: 'Processing your request...',
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Run the enhanced agent with progress updates
    const result = await runEnhancedMainAgent(message, context, (update) => {
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
    });

    // Send the main response (with timezone removal)
    const cleanedContent = removeTimezoneAbbreviations(
      result.response || result.content
    );
    res.write(
      `data: ${JSON.stringify({
        type: 'response',
        content: cleanedContent,
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
    email,
    primary_account,
    secondary_account,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!primary_account || !primary_account.email || !primary_account.creds) {
    return res.status(400).json({
      error: 'Primary account with email and credentials is required',
    });
  }

  try {
    // Get or create conversation context
    let context: SessionContext = conversationContexts.get(sessionId) || {
      sessionId,
      history: [],
    };

    // Update context with account information
    context.accounts = {
      primary: primary_account,
      secondary: secondary_account || null,
    };
    context.userEmail = email;
    context.sessionId = sessionId;

    conversationContexts.set(sessionId, context);

    // Add current message to context
    context.history.push({ role: 'user', content: message });

    console.log(
      `[Server] Processing message for session ${sessionId}:`,
      message
    );
    console.log(
      `[Server] Accounts: Primary (${primary_account.title}: ${
        primary_account.email
      })${
        secondary_account
          ? `, Secondary (${secondary_account.title}: ${secondary_account.email})`
          : ''
      }`
    );

    // Run the enhanced agent
    const result = await runEnhancedMainAgent(message, context);

    // Add agent response to context
    context.history.push({
      role: 'assistant',
      content: result.response || result.content,
    });

    console.log(`[Server] Agent result:`, result);

    res.json({
      success: true,
      message: result.response || result.content,
      sessionId,
      context: context,
    });
  } catch (error) {
    console.error('[Server] Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get conversation history
app.get('/api/conversation/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const context = conversationContexts.get(sessionId);

  if (!context) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json({
    sessionId,
    context: context,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Streaming Agents Server running on port ${PORT}`);
  console.log(`📡 Stream endpoint: http://localhost:${PORT}/api/chat/stream`);
  console.log(`📡 Chat endpoint: http://localhost:${PORT}/api/chat`);
});
