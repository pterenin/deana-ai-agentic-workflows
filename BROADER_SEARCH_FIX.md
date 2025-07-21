# Broader Time Range Search Fix

## 🐛 **Issue Identified**

When users asked to delete a meeting without specifying a time (e.g., "Delete meeting 'Test'"), the agent was only searching for today's events and finding 0 results. The "Test" meeting was likely scheduled for a different day (tomorrow, next week, etc.).

**Example:**

```
User: "Delete meeting 'Test'"
Agent: Searches only today (2025-07-20) → Finds 0 events
Result: "I couldn't find any events matching your deletion request"
```

## ✅ **Solution: Broader Time Range Search**

### **When No Time is Specified**

The agent now searches **current and upcoming weeks** instead of just today:

- **Before**: Searched only today when no time specified
- **After**: Searches from today to next Sunday when no time specified

### **Time Range Logic**

```typescript
// When user specifies time: Use that specific range
"delete tomorrow's meeting" → timeMin="TOMORROW", timeMax="TOMORROW"

// When user doesn't specify time: Use broader range
"delete meeting Test" → timeMin="TODAY", timeMax="NEXT_WEEK_END"
```

## 🔧 **Implementation Details**

### **Files Modified:**

1. **`src/agents/prompts/mainAgentPrompt.ts`** - Added broader search instructions
2. **`src/agents/utils/dateUtils.ts`** - Added next week end calculation
3. **`test-broader-search.js`** - Test script for the new functionality

### **Key Changes:**

#### **1. Enhanced Date Context**

```typescript
return {
  today: todayStr,
  tomorrow: tomorrowStr,
  yesterday: yesterdayStr,
  nextWeekEnd: nextWeekEndStr, // NEW
  currentTime: now.toISOString(),
};
```

#### **2. Next Week End Calculation**

```typescript
// Calculate next week end (Sunday of next week)
const nextWeekEnd = new Date(now);
const daysUntilNextSunday = (7 - nextWeekEnd.getDay()) % 7;
if (daysUntilNextSunday === 0) {
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7); // If today is Sunday, go to next Sunday
} else {
  nextWeekEnd.setDate(nextWeekEnd.getDate() + daysUntilNextSunday);
}
```

#### **3. Updated Agent Instructions**

```
**TIME RANGE FOR EVENT SEARCHES:**
- When user specifies a time (today, tomorrow, yesterday, next week), use that specific time range
- When user does NOT specify a time (e.g., "delete meeting Test"), search current and upcoming weeks
- For events without time specification, use: timeMin="TODAY_DATE_T00:00:00-07:00", timeMax="NEXT_WEEK_END_T23:59:59-07:00"
- This ensures we find events even if they're scheduled for later in the week or next week
```

## 🔄 **Workflow Examples**

### **Example 1: No Time Specified**

```
User: "Delete meeting 'Test'"

Agent Flow:
1. No time specified → Use broader range
2. getEvents(timeMin="2025-07-20T00:00:00-07:00", timeMax="2025-07-27T23:59:59-07:00")
3. Finds "Test" meeting scheduled for 2025-07-21 (tomorrow)
4. deleteEvent(eventId="test_meeting_id")
5. Returns: "I've successfully deleted 1 out of 1 events."
```

### **Example 2: Specific Time**

```
User: "Delete tomorrow's meeting 'Test'"

Agent Flow:
1. Time specified → Use specific range
2. getEvents(timeMin="2025-07-21T00:00:00-07:00", timeMax="2025-07-21T23:59:59-07:00")
3. Finds "Test" meeting for tomorrow
4. deleteEvent(eventId="test_meeting_id")
5. Returns: "I've successfully deleted 1 out of 1 events."
```

### **Example 3: Yesterday's Meeting**

```
User: "Delete yesterday's meeting with Vlada"

Agent Flow:
1. Time specified → Use specific range
2. getEvents(timeMin="2025-07-19T00:00:00-07:00", timeMax="2025-07-19T23:59:59-07:00")
3. Finds "meeting with Vlada" from yesterday
4. deleteEvent(eventId="vlada_meeting_id")
5. Returns: "I've successfully deleted 1 out of 1 events."
```

## 📊 **Time Range Coverage**

### **Current Date Context (2025-07-20):**

- **Today**: 2025-07-20
- **Tomorrow**: 2025-07-21
- **Yesterday**: 2025-07-19
- **Next Week End**: 2025-07-27 (next Sunday)

### **Search Ranges:**

- **No time specified**: 2025-07-20 to 2025-07-27 (8 days)
- **Today**: 2025-07-20 to 2025-07-20 (1 day)
- **Tomorrow**: 2025-07-21 to 2025-07-21 (1 day)
- **Yesterday**: 2025-07-19 to 2025-07-19 (1 day)

## 🧪 **Testing**

### **Test Script:**

```bash
node test-broader-search.js
```

### **Manual Testing:**

```bash
# Start server
npm run dev

# Test broader search
curl -X POST http://localhost:3060/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Delete meeting Test"}'
```

## 📊 **Expected Logs**

With the broader search, you should now see:

```
[Date Context] Current date: 2025-07-20, Tomorrow: 2025-07-21, Yesterday: 2025-07-19, Next Week End: 2025-07-27
[Main Agent] Calling function: getEvents
[Main Agent] getEvents returned events: [{id: 'test_meeting_id', summary: 'Test', ...}]
[Main Agent] Detected deletion intent, storing events for deletion: [...]
[Backend Chaining] Processing deletion for events: [...]
[findEventsToDelete] Found matching event: Test ID: test_meeting_id
[Calendar Handler] deleteEvent called with args: {eventId: 'test_meeting_id', ...}
```

## 🎯 **Benefits**

### **For Users:**

- **Find events regardless of when they're scheduled**: "delete meeting Test" works even if Test is tomorrow
- **No need to specify time**: Natural language deletion without time constraints
- **Better success rate**: Higher chance of finding the intended event
- **Flexible search**: Works for events scheduled in current or upcoming weeks

### **For Developers:**

- **Intelligent time range selection**: Automatically chooses appropriate search range
- **Comprehensive coverage**: Ensures events aren't missed due to narrow time windows
- **Clear logic**: Easy to understand when broader vs. specific ranges are used

### **For System:**

- **Higher success rate**: More events found and deleted successfully
- **Better user experience**: Users don't need to specify exact times
- **Robust search**: Handles various scheduling scenarios

## 🚀 **Next Steps**

1. **Test the broader search** with real calendar data
2. **Monitor success rate** of deletion requests
3. **Consider extending range** if needed (e.g., 2 weeks instead of 1)
4. **Add more intelligent matching** for event names

The broader time range search should now find events even when they're scheduled for different days! 🎉
