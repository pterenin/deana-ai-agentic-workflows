# Event Deletion Workflow Guide

## 🎯 Overview

The agent now supports deleting calendar events by their IDs. When users ask to delete events, the agent can:

1. **Get events** to see what's available
2. **Identify specific events** by name or time
3. **Delete single events** by ID
4. **Delete multiple events** at once
5. **Handle confirmations** from users

## 🔧 New Capabilities

### **1. Single Event Deletion**

```typescript
// Function: deleteEvent
{
  eventId: "6nfg7f9cfrplf5u5bko7s49nn9",
  calendarId: "tps8327@gmail.com"
}
```

### **2. Multiple Events Deletion**

```typescript
// Function: deleteMultipleEvents
{
  eventIds: ["6nfg7f9cfrplf5u5bko7s49nn9", "rm1pc16ebuh6m3if0d77uea3e0"],
  calendarId: "tps8327@gmail.com"
}
```

## 📋 User Interaction Examples

### **Scenario 1: Delete Specific Event**

```
User: "delete the Test meeting"
Agent: Uses deleteEvent with eventId="6nfg7f9cfrplf5u5bko7s49nn9"
```

### **Scenario 2: Delete Multiple Events**

```
User: "delete all meetings tomorrow"
Agent:
1. Calls getEvents for tomorrow
2. Gets event IDs: ["6nfg7f9cfrplf5u5bko7s49nn9", "rm1pc16ebuh6m3if0d77uea3e0"]
3. Calls deleteMultipleEvents with those IDs
```

### **Scenario 3: Confirmation Flow**

```
User: "show me tomorrow's meetings"
Agent: Lists events with IDs
User: "delete them"
Agent: Deletes all listed events using their IDs
```

### **Scenario 4: Delete by Name**

```
User: "delete the test33 meeting"
Agent: Uses deleteEvent with eventId="rm1pc16ebuh6m3if0d77uea3e0"
```

## 🛠️ Implementation Details

### **Event ID Mapping**

From your calendar data:

- **"Test" meeting** → ID: `6nfg7f9cfrplf5u5bko7s49nn9`
- **"test33" meeting** → ID: `rm1pc16ebuh6m3if0d77uea3e0`

### **Error Handling**

- **Invalid IDs**: Rejected with clear error messages
- **Missing Events**: 404 errors handled gracefully
- **Permission Issues**: 403 errors with helpful messages
- **Partial Failures**: Multiple deletion reports success/failure counts

### **Progress Updates**

- Shows progress during deletion operations
- Reports individual event deletion status
- Provides summary of results

## 🧪 Testing

### **Test Scripts**

```bash
# Test error handling
node test-error-handling.js

# Test deletion workflow
node test-deletion-workflow.js
```

### **Manual Testing**

```bash
# Start the server
npm run dev

# Test with curl
curl -X POST http://localhost:3060/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "delete the Test meeting"}'
```

## 📝 Agent Prompt Updates

The agent prompt now includes:

### **Deletion Examples**

- Delete specific events by name
- Delete multiple events at once
- Handle user confirmations
- Use event IDs from previous queries

### **Workflow Instructions**

- Get events first to identify what to delete
- Use event IDs for precise deletion
- Handle both single and multiple deletions
- Provide clear feedback on results

## 🔄 Workflow Steps

### **1. Event Discovery**

```
User: "show me tomorrow's meetings"
Agent: getEvents() → Returns events with IDs
```

### **2. Event Identification**

```
Agent: Maps event names to IDs
- "Test" → 6nfg7f9cfrplf5u5bko7s49nn9
- "test33" → rm1pc16ebuh6m3if0d77uea3e0
```

### **3. Deletion Execution**

```
User: "delete the Test meeting"
Agent: deleteEvent(eventId="6nfg7f9cfrplf5u5bko7s49nn9")
```

### **4. Confirmation**

```
User: "yes, delete them"
Agent: deleteMultipleEvents(eventIds=[...])
```

## 🎯 Benefits

### **For Users:**

- **Natural language deletion**: "delete the Test meeting"
- **Bulk operations**: "delete all meetings tomorrow"
- **Confirmation support**: "yes, delete them"
- **Clear feedback**: Progress updates and results

### **For Developers:**

- **Robust error handling**: Graceful failure handling
- **Progress tracking**: Real-time operation updates
- **Flexible API**: Single or multiple event deletion
- **Comprehensive logging**: Debug information

### **For System:**

- **Reliable operations**: Proper validation and error handling
- **Scalable design**: Handles both single and bulk operations
- **User-friendly**: Clear messages and progress updates

## 🚀 Usage Examples

### **Real User Interactions**

**Example 1:**

```
User: "What meetings do I have tomorrow?"
Agent: "You have 2 meetings tomorrow:
1. Test (3:00 PM - 4:00 PM)
2. test33 (5:00 PM - 6:00 PM)"

User: "delete the Test meeting"
Agent: "I've deleted the Test meeting for you."
```

**Example 2:**

```
User: "delete all meetings tomorrow"
Agent: "I've deleted both meetings for tomorrow:
- Test meeting
- test33 meeting"
```

**Example 3:**

```
User: "show me my meetings"
Agent: "Here are your meetings: [list with IDs]"

User: "delete them"
Agent: "I've deleted all the meetings you listed."
```

## 🔧 Technical Implementation

### **Files Modified:**

1. **`src/agents/prompts/mainAgentPrompt.ts`** - Added deletion examples and instructions
2. **`src/agents/tools/calendarTools.ts`** - Added `deleteMultipleEvents` function
3. **`src/agents/handlers/calendarHandlers.ts`** - Added `deleteMultipleEvents` handler
4. **`test-deletion-workflow.js`** - Test script for deletion functionality

### **New Functions:**

- `deleteEvent` - Delete single event by ID
- `deleteMultipleEvents` - Delete multiple events by IDs

### **Error Handling:**

- Input validation for event IDs
- Graceful handling of API errors
- Progress updates during operations
- Comprehensive result reporting

The deletion workflow is now fully integrated and ready for use! 🎉
