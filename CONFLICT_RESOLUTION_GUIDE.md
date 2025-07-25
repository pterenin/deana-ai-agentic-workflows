# Intelligent Conflict Resolution System

This system automatically detects scheduling conflicts between Personal and Work calendars and provides an intelligent workflow to resolve them.

## 🎯 **Workflow Overview**

1. **Multi-Calendar Check** → Detects conflicts between calendars
2. **Conflict Notification** → Alerts user about overlapping events
3. **Rescheduling Proposal** → Asks to reschedule secondary calendar event
4. **Alternative Generation** → Finds 3 available time slots
5. **User Selection** → User chooses from options or suggests own time
6. **Final Rescheduling** → Updates event and resolves conflict

## 🔍 **Conflict Detection**

The system automatically detects overlaps when checking both calendars:

```javascript
// Detects overlaps between Personal and Work calendar events
if (primaryStart < secondaryEnd && secondaryStart < primaryEnd) {
  // Conflict detected!
}
```

**Example Response:**

> "You've got a couple of meetings lined up today. Here's what's on your schedule:
>
> In your Personal calendar: A Personal Meeting from 4:45 PM to 5:45 PM.
> In your Work calendar: An Office meeting from 5:00 PM to 6:00 PM.
>
> It looks like there's a bit of overlap between your personal and work commitments, so you might want to manage the timing accordingly."

## 🤖 **AI-Driven Resolution**

### Step 1: Conflict Detection & Notification

AI automatically notices the overlap and asks:

> "I notice your Personal Meeting (4:45-5:45 PM) overlaps with your Office meeting (5:00-6:00 PM). Would you like me to reschedule the Office meeting from your Work calendar?"

### Step 2: Generate Alternatives (if user agrees)

Uses `proposeRescheduleOptions` tool:

- Generates 3 time slots around the original event
- Checks availability across BOTH calendars
- Only suggests truly available slots

**Example:**

> "I found 3 available times to reschedule your Office meeting:
>
> 1. 1 hour earlier: 3:00 PM to 4:00 PM
> 2. 1 hour later: 6:00 PM to 7:00 PM
> 3. 2 hours later: 7:00 PM to 8:00 PM
>
> Which option would you prefer, or would you like to suggest a different time?"

### Step 3: User Selection & Rescheduling

- User picks option: "I'll take option 2"
- AI uses `rescheduleEvent` tool
- Performs final availability check
- Updates the event
- Confirms success

## 🛠️ **Technical Implementation**

### New Tools Added:

**1. `proposeRescheduleOptions`**

- Generates alternative time slots
- Checks availability across both calendars
- Returns only available options

**2. `rescheduleEvent`**

- Final availability verification
- Updates event in correct calendar
- Uses appropriate credentials

**3. `checkTimeSlotAvailability`**

- Verifies availability across all calendars
- Used for custom user suggestions

### Enhanced Calendar Response:

```javascript
{
  events: [...],
  count: 5,
  conflicts: [/* conflict details */], // 🆕 New field
  breakdown: {
    primary: { /* Personal calendar */ },
    secondary: { /* Work calendar */ }
  }
}
```

## 🎨 **User Experience Examples**

### Scenario 1: Simple Conflict

**User:** "How does my day look?"
**AI:**

1. Shows both calendars
2. Detects overlap
3. Offers to reschedule Work event
4. Provides 3 alternatives
5. Reschedules based on selection

### Scenario 2: Custom Time Suggestion

**User:** "Can you move it to 8 PM instead?"
**AI:**

1. Uses `checkTimeSlotAvailability`
2. Confirms 8 PM is free
3. Reschedules to 8 PM
4. Confirms completion

### Scenario 3: No Available Alternatives

**AI:** "I checked for alternative times but couldn't find any available slots in the next few hours. Would you like me to look at different time ranges or would you prefer to manually choose a time?"

## 🔐 **Smart Account Handling**

- **Primary Account Events**: Generally kept as-is
- **Secondary Account Events**: Offered for rescheduling
- **Credential Management**: Uses correct OAuth credentials for each calendar
- **Cross-Calendar Checking**: Ensures new time doesn't conflict with either calendar

## 🚀 **Benefits**

1. **Automatic Detection**: No manual conflict checking needed
2. **Intelligent Suggestions**: Only shows truly available times
3. **Multi-Calendar Aware**: Considers both personal and work schedules
4. **User Choice**: User maintains control over final decisions
5. **Seamless Integration**: Works with existing calendar workflows

The system makes scheduling conflicts a thing of the past by proactively identifying and resolving them with minimal user effort!
