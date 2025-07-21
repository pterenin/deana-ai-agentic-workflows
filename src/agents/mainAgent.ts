import OpenAI from 'openai';
import { allTools } from './tools';
import { allHandlers } from './handlers';
import { getMainAgentPrompt } from './prompts/mainAgentPrompt';
import { getCurrentDateContext } from './utils/dateUtils';

// Helper function to find events to delete based on user request
function findEventsToDelete(events: any[], userRequest: string): any[] {
  const requestLower = userRequest.toLowerCase();

  // Extract event names/descriptions from the request
  const eventNames = [];

  // Look for quoted strings (e.g., "meeting with Vlada")
  const quotedMatches = userRequest.match(/"([^"]+)"/g);
  if (quotedMatches) {
    eventNames.push(
      ...quotedMatches.map((match) => match.slice(1, -1).toLowerCase())
    );
  }

  // Look for common patterns
  if (requestLower.includes('vlada')) eventNames.push('vlada');
  if (requestLower.includes('test')) eventNames.push('test');
  if (requestLower.includes('coffee')) eventNames.push('coffee');
  if (requestLower.includes('meeting')) eventNames.push('meeting');

  console.log('[findEventsToDelete] Looking for events matching:', eventNames);
  console.log(
    '[findEventsToDelete] Available events:',
    events.map((e: any) => e.summary)
  );

  const matchingEvents = [];

  for (const event of events) {
    const eventSummary = (event.summary || '').toLowerCase();
    const eventDescription = (event.description || '').toLowerCase();

    // Check if any of the event names match
    const matches = eventNames.some(
      (name) => eventSummary.includes(name) || eventDescription.includes(name)
    );

    // If no specific names found, but user wants to delete all events
    const deleteAll =
      requestLower.includes('all') ||
      requestLower.includes('them') ||
      requestLower.includes('everything');

    if (matches || (deleteAll && eventNames.length === 0)) {
      matchingEvents.push(event);
      console.log(
        '[findEventsToDelete] Found matching event:',
        event.summary,
        'ID:',
        event.id
      );
    } else {
      console.log(
        '[findEventsToDelete] Event does not match:',
        event.summary,
        '(looking for:',
        eventNames.join(', '),
        ')'
      );
    }
  }

  console.log(
    '[findEventsToDelete] Total matching events:',
    matchingEvents.length
  );
  return matchingEvents;
}

// Helper function to find event to reschedule based on user request
function findEventToReschedule(events: any[], userRequest: string): any | null {
  const requestLower = userRequest.toLowerCase();

  // Check if user wants to reschedule "all meetings" or "all events"
  const isAllMeetings =
    requestLower.includes('all meeting') ||
    requestLower.includes('all event') ||
    requestLower.includes('every meeting') ||
    requestLower.includes('every event');

  if (isAllMeetings && events.length > 0) {
    console.log(
      '[findEventToReschedule] User requested to reschedule all meetings, returning first event:',
      events[0].summary
    );
    return events[0]; // Return the first event for now, we'll handle multiple events later
  }

  // Extract event names from the request
  const eventNames = [];

  // Look for quoted strings (e.g., "hello")
  const quotedMatches = userRequest.match(/"([^"]+)"/g);
  if (quotedMatches) {
    eventNames.push(
      ...quotedMatches.map((match) => match.slice(1, -1).toLowerCase())
    );
  }

  // Look for common patterns
  if (requestLower.includes('hello')) eventNames.push('hello');
  if (requestLower.includes('meeting')) eventNames.push('meeting');

  console.log(
    '[findEventToReschedule] Looking for events matching:',
    eventNames
  );
  console.log(
    '[findEventToReschedule] Available events:',
    events.map((e: any) => e.summary)
  );

  for (const event of events) {
    const eventSummary = (event.summary || '').toLowerCase();

    // Check if any of the event names match
    const matches = eventNames.some((name) => eventSummary.includes(name));

    if (matches) {
      console.log(
        '[findEventToReschedule] Found matching event:',
        event.summary,
        'ID:',
        event.id
      );
      return event;
    }
  }

  console.log('[findEventToReschedule] No matching events found');
  return null;
}

// Helper function to extract new time from user request
function extractNewTimeFromRequest(userRequest: string): {
  time?: string;
  hour?: number;
  minute?: number;
  isNextDay?: boolean;
  needsTime?: boolean;
} | null {
  const requestLower = userRequest.toLowerCase();

  // Look for time patterns like "3pm", "3:30pm", "15:00", etc.
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i, // 3:30pm, 10:45am
    /(\d{1,2})\s*(am|pm)/i, // 3pm, 10am
    /(\d{1,2}):(\d{2})/i, // 15:30, 10:45
  ];

  for (let i = 0; i < timePatterns.length; i++) {
    const pattern = timePatterns[i];
    const match = requestLower.match(pattern);
    if (match) {
      let hour = parseInt(match[1]);
      let minute = 0;
      let period = null;
      if (i === 0) {
        minute = parseInt(match[2]);
        period = match[3] ? match[3].toLowerCase() : null;
      } else if (i === 1) {
        period = match[2] ? match[2].toLowerCase() : null;
        minute = 0;
      } else if (i === 2) {
        minute = parseInt(match[2]);
        period = null;
      }
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      const timeString = `${hour}:${minute.toString().padStart(2, '0')}`;
      return { time: timeString, hour, minute };
    }
  }

  // If no time found, check for date keywords (e.g., "tomorrow")
  if (requestLower.includes('next day') || requestLower.includes('tomorrow')) {
    return { isNextDay: true, needsTime: true };
  }
  if (requestLower.includes('today')) {
    return { needsTime: true };
  }
  // If neither time nor date found, return null
  return null;
}

// Helper function to calculate new start time
function calculateNewStartTime(
  event: any,
  newTimeInfo: { hour: number; minute: number; isNextDay?: boolean }
): Date {
  const currentStart = new Date(event.start.dateTime);
  const newStart = new Date(currentStart);

  if (newTimeInfo.isNextDay) {
    // Move to next day, same time
    newStart.setDate(newStart.getDate() + 1);
  } else {
    // Change time on same day
    newStart.setHours(newTimeInfo.hour, newTimeInfo.minute, 0, 0);
  }

  return newStart;
}

// Helper function to calculate new end time
function calculateNewEndTime(event: any, newStartTime: Date): Date {
  const currentStart = new Date(event.start.dateTime);
  const currentEnd = new Date(event.end.dateTime);
  const duration = currentEnd.getTime() - currentStart.getTime();

  const newEnd = new Date(newStartTime.getTime() + duration);
  return newEnd;
}

// Helper function to format time for display
function formatTime(dateTimeString: string): string {
  const date = new Date(dateTimeString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Helper function to extract participant names from user input
function extractParticipantNames(userRequest: string): string[] {
  const names: string[] = [];
  // Look for 'with [Name]' pattern, case-insensitive
  const withPattern = /with ([A-Za-z][a-zA-Z]+)/gi;
  let match;
  while ((match = withPattern.exec(userRequest)) !== null) {
    names.push(match[1]);
  }
  // Look for quoted names
  const quotedPattern = /"([^"]+)"/g;
  while ((match = quotedPattern.exec(userRequest)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use the combined handlers from the handlers module
const functionHandlers = allHandlers;

// Helper function to run the main agent
export async function runMainAgent(
  userMessage: string,
  creds: any,
  context?: any,
  onProgress?: (update: { type: string; content: string; data?: any }) => void
): Promise<any> {
  try {
    onProgress?.({
      type: 'progress',
      content: 'Initializing agent...',
      data: { step: 'init', total: 5 },
    });
    const dateContext = getCurrentDateContext();
    const messages: any[] = [
      {
        role: 'system',
        content: getMainAgentPrompt(dateContext),
      },
    ];
    if (context?.history) {
      messages.push(...context.history);
    } else {
      messages.push({ role: 'user', content: userMessage });
    }
    let loopCount = 0;
    let lastResponse = null;
    while (loopCount < 5) {
      // Prevent infinite loops
      loopCount++;
      onProgress?.({
        type: 'progress',
        content:
          loopCount === 1
            ? 'Analyzing your request...'
            : 'Continuing agent reasoning...',
        data: { step: 'analyze', total: 5 },
      });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: allTools,
        tool_choice: 'auto',
      });
      const responseMessage = response.choices[0].message;
      lastResponse = responseMessage;
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        onProgress?.({
          type: 'progress',
          content: `Executing ${responseMessage.tool_calls.length} function(s)...`,
          data: { step: 'execute', total: 5 },
        });
        const toolResults = [];
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          onProgress?.({
            type: 'progress',
            content: `Calling ${functionName}...`,
            data: { step: 'function', functionName, total: 5 },
          });
          if (functionName === 'createEvent') {
            const participantNames = extractParticipantNames(userMessage);
            console.log('DEBUG: participantNames:', participantNames);
            let attendees: string[] = [];
            for (const name of participantNames) {
              onProgress?.({
                type: 'progress',
                content: `Looking up contact for participant: ${name}...`,
              });
              const contactResult =
                await functionHandlers.findContactEmailByName(
                  { name },
                  creds,
                  onProgress
                );
              if (contactResult && contactResult.email) {
                attendees.push(contactResult.email);
                onProgress?.({
                  type: 'progress',
                  content: `Found contact for ${name}: ${contactResult.email}`,
                });
              } else {
                onProgress?.({
                  type: 'progress',
                  content: `No contact found for ${name}.`,
                });
              }
            }
            console.log('DEBUG: attendees array after lookup:', attendees);
            // Always merge with any existing attendees from the tool call
            let existingAttendees = [];
            if (functionArgs.attendees) {
              existingAttendees = functionArgs.attendees.map((a: any) =>
                typeof a === 'string' ? a : a.email
              );
            }
            const allAttendees = Array.from(
              new Set([...existingAttendees, ...attendees])
            );
            if (allAttendees.length > 0) {
              functionArgs.attendees = allAttendees.map((email) => ({ email }));
            }
            console.log(
              'DEBUG: functionArgs for createEvent:',
              JSON.stringify(functionArgs, null, 2)
            );
            // After calling the handler and getting a successful result:
            // Instead of hardcoding an email step, feed the event details and conversation context back to the LLM
            // and let it decide if a sendEmail tool call is needed.
            // This is done by continuing the main agent loop with the new tool result and updated messages.
          }
          if (functionName === 'updateEvent') {
            const participantNames = extractParticipantNames(userMessage);
            console.log(
              'DEBUG: participantNames (updateEvent):',
              participantNames
            );
            let attendees: string[] = [];
            for (const name of participantNames) {
              onProgress?.({
                type: 'progress',
                content: `Looking up contact for participant: ${name}...`,
              });
              const contactResult =
                await functionHandlers.findContactEmailByName(
                  { name },
                  creds,
                  onProgress
                );
              if (contactResult && contactResult.email) {
                attendees.push(contactResult.email);
                onProgress?.({
                  type: 'progress',
                  content: `Found contact for ${name}: ${contactResult.email}`,
                });
              } else {
                onProgress?.({
                  type: 'progress',
                  content: `No contact found for ${name}.`,
                });
              }
            }
            console.log(
              'DEBUG: attendees array after lookup (updateEvent):',
              attendees
            );
            let existingAttendees = [];
            if (functionArgs.attendees) {
              existingAttendees = functionArgs.attendees.map((a: any) =>
                typeof a === 'string' ? a : a.email
              );
            }
            const allAttendees = Array.from(
              new Set([...existingAttendees, ...attendees])
            );
            if (allAttendees.length > 0) {
              functionArgs.attendees = allAttendees.map((email) => ({ email }));
            }
            console.log(
              'DEBUG: functionArgs for updateEvent:',
              JSON.stringify(functionArgs, null, 2)
            );
          }
          if (functionHandlers[functionName as keyof typeof functionHandlers]) {
            const result = await functionHandlers[
              functionName as keyof typeof functionHandlers
            ](functionArgs, creds, onProgress);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(result),
            });
            // If the tool result is an error or needs user input, break and return
            if (result && (result.error || result.needsUserInput)) {
              return {
                content:
                  result.message ||
                  'There was an issue processing your request.',
                toolResults,
              };
            }
          } else {
            return {
              content: `No handler found for function: ${functionName}`,
            };
          }
        }
        // Add the tool results to the conversation and continue the loop
        messages.push(responseMessage);
        messages.push(...toolResults);
        continue;
      }
      // If the LLM response is a user-facing message (not a tool call), return it
      if (responseMessage.content) {
        return {
          content: responseMessage.content,
        };
      }
      // If neither, break
      break;
    }
    // Fallback: return the last response content or a generic message
    return {
      content:
        lastResponse?.content || 'Sorry, I was unable to process your request.',
    };
  } catch (error) {
    console.error('[Main Agent] Error:', error);
    throw error;
  }
}
