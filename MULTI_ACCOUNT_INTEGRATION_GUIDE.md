# Multi-Account Gmail Integration Guide

This guide explains how the system now supports multiple Gmail accounts (primary and secondary) for calendar and email operations.

## Overview

The system has been updated to handle requests with two Gmail accounts:

- **Primary Account**: The main account (required)
- **Secondary Account**: An optional additional account

Each account contains:

- `title`: A user-friendly name (e.g., "Work", "Personal")
- `email`: The Gmail address (used as calendar ID)
- `creds`: OAuth2 credentials for API access

## Request Structure

The frontend now sends requests with this structure:

```javascript
{
  message: "Do I have meetings today?",
  sessionId: "session_123",
  email: "user@example.com",
  primary_account: {
    email: "user@personal.com",
    title: "Personal",
    creds: {
      access_token: "...",
      refresh_token: "...",
      expires_at: "...",
      client_id: "..."
    }
  },
  secondary_account: {
    email: "user@work.com",
    title: "Work",
    creds: {
      access_token: "...",
      refresh_token: "...",
      expires_at: "...",
      client_id: "..."
    }
  }
}
```

## Account Selection Logic

The system intelligently determines which account to use based on user requests:

### 1. Explicit Account References

- "Create a meeting in my **work** calendar" → Uses Work account
- "Create a meeting in my **personal** calendar" → Uses Personal account
- "Create a meeting in my **secondary** calendar" → Uses secondary account
- "Create a meeting in my **primary** calendar" → Uses primary account

### 2. Multi-Account Queries

When user asks broad questions without specifying an account:

- "Do I have meetings today?" → Checks **both** calendars
- "What's on my schedule?" → Checks **both** calendars
- "Am I free this afternoon?" → Checks **both** calendars

### 3. Default Behavior

- Meeting creation defaults to **primary account** if not specified
- Single-account operations default to **primary account**

## Response Format

### Single Account Response

```json
{
  "events": [...],
  "count": 3,
  "account": {
    "title": "Work",
    "email": "user@work.com"
  }
}
```

### Multi-Account Response

```json
{
  "events": [...],
  "count": 5,
  "breakdown": {
    "primary": {
      "title": "Personal",
      "email": "user@personal.com",
      "events": [...],
      "count": 2
    },
    "secondary": {
      "title": "Work",
      "email": "user@work.com",
      "events": [...],
      "count": 3
    }
  }
}
```

## Implementation Details

### 1. Express Integration (`examples/ExpressIntegration.js`)

- Validates that `primary_account` is present in requests
- Stores account information in session management
- Forwards account data to the agent server

### 2. Streaming Server (`src/streaming-agents-server.ts`)

- Receives and validates account information
- Stores accounts in session context
- Passes context to calendar handlers

### 3. Calendar Handlers (`src/agents/handlers/calendarHandlers.ts`)

- Enhanced with multi-account support
- Intelligent account selection based on user input
- Support for both single and multi-account operations

### 4. Session Management

Account information is stored per session:

```typescript
interface SessionContext {
  sessionId: string;
  history: any[];
  accounts?: {
    primary: AccountInfo;
    secondary: AccountInfo | null;
  };
  userEmail?: string;
  lastBookingConflict?: any;
}
```

## Usage Examples

### Creating Meetings

```
User: "Create a meeting tomorrow at 2pm in my work calendar"
→ Uses Work account credentials and calendar

User: "Schedule a dentist appointment for Friday"
→ Uses Primary account (default)
```

### Checking Calendars

```
User: "Do I have meetings today?"
Response: "You have 1 meeting in your Personal calendar and 2 meetings in your Work calendar."

User: "What meetings do I have in my work calendar?"
→ Only checks Work calendar
```

### Rescheduling

```
User: "Reschedule my work meeting to 3pm"
→ Finds meeting in Work calendar and reschedules using Work account
```

## Key Features

1. **Account Title Recognition**: Recognizes user-defined titles (not hardcoded)
2. **Intelligent Defaults**: Uses primary account when no specific account mentioned
3. **Multi-Calendar Queries**: Checks both calendars for broad questions
4. **Session Persistence**: Account information stored per session
5. **Backward Compatibility**: Still works with single-account setups

## Error Handling

- Returns error if `primary_account` is missing
- Gracefully handles missing `secondary_account`
- Falls back to primary account if secondary account referenced but not available
- Provides clear error messages for credential issues

## Testing

To test the multi-account functionality:

1. Start the Express server: `npm run example`
2. Start the agent server: `npm run streaming-server`
3. Send requests with the new account structure
4. Verify account selection logic works correctly
5. Test both single and multi-account queries

The system maintains backward compatibility while adding powerful multi-account support for Gmail calendar and email operations.
