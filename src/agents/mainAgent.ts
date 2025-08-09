import OpenAI from 'openai';
import { allTools } from './tools';
import { allHandlers } from './handlers';
import { getMainAgentPrompt } from './prompts/mainAgentPrompt';
import { getCurrentDateContext } from './utils/dateUtils';
import { bookAppointmentAgent } from './bookAppointmentAgent';

// Helper function to remove timezone abbreviations from responses
function removeTimezoneAbbreviations(content: string): string {
  // Remove common timezone abbreviations in parentheses only
  // This preserves AM/PM while removing timezone info
  return content
    .replace(
      /\s*\((PDT|PST|UTC|EST|EDT|CST|CDT|MST|MDT|GMT|BST|CET|JST|IST)\)/g,
      ''
    ) // Remove specific timezone abbreviations in parentheses
    .replace(/\s*\([A-Z]{3,4}\)/g, ''); // Remove other 3-4 letter abbreviations in parentheses (but not AM/PM)
}

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
  email?: string,
  context?: any,
  onProgress?: (update: { type: string; content: string; data?: any }) => void
): Promise<any> {
  // Booking intent detection (simple)
  const bookingIntent =
    /book.*(appointment|hair|barber|cut|massage|nail|doctor|dentist)/i.test(
      userMessage
    );
  if (bookingIntent) {
    onProgress?.({
      type: 'progress',
      content: 'Detected booking intent. Delegating to BookAppointmentAgent...',
    });
    console.log(
      '[runMainAgent] Passing phone to booking agent:',
      context?.userPhone
    );
    // Check if user is selecting an alternative
    if (
      context &&
      context.lastBookingConflict &&
      context.lastBookingConflict.alternatives
    ) {
      // Try to match user selection to an alternative
      let selectedAlt = null;

      // First, try ordinal matching (first, second, third, 1, 2, 3)
      const altMatch = userMessage.match(
        /(1|first|one|2|second|two|3|third|three)/i
      );
      if (altMatch) {
        const idx =
          altMatch[1] === '1' || /first|one/i.test(altMatch[1])
            ? 0
            : altMatch[1] === '2' || /second|two/i.test(altMatch[1])
            ? 1
            : altMatch[1] === '3' || /third|three/i.test(altMatch[1])
            ? 2
            : null;
        if (idx !== null && context.lastBookingConflict.alternatives[idx]) {
          selectedAlt = context.lastBookingConflict.alternatives[idx];
        }
      }

      // If no ordinal match, try time-based matching (9am, 10am, etc.)
      if (!selectedAlt) {
        const timeMatch = userMessage.match(/(\d{1,2})(:\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
          let requestedHour = parseInt(timeMatch[1], 10);
          const requestedMinute = timeMatch[2]
            ? parseInt(timeMatch[2].slice(1), 10)
            : 0;

          // Handle AM/PM conversion
          if (timeMatch[3]) {
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && requestedHour < 12) {
              requestedHour += 12;
            } else if (ampm === 'am' && requestedHour === 12) {
              requestedHour = 0;
            }
          } else if (requestedHour >= 1 && requestedHour <= 7) {
            // Assume PM for times 1-7 without AM/PM specified
            requestedHour += 12;
          }

          // Find matching alternative by comparing times
          for (const alt of context.lastBookingConflict.alternatives) {
            const altTime = new Date(alt.startISO);
            if (
              altTime.getHours() === requestedHour &&
              altTime.getMinutes() === requestedMinute
            ) {
              selectedAlt = alt;
              break;
            }
          }
        }
      }
      if (selectedAlt) {
        // Re-invoke booking agent with selected alternative time
        const altUserRequest = `Book a hair appointment at ${selectedAlt.start.toLocaleTimeString(
          'en-US',
          { hour: 'numeric', minute: '2-digit', hour12: true }
        )} on ${selectedAlt.start.toLocaleDateString('en-US')}`;
        const result = await bookAppointmentAgent(
          altUserRequest,
          creds,
          email,
          context?.userPhone,
          onProgress,
          context?.userTimeZone,
          context?.clientNowISO,
          userMessage,
          context?.userName
        );
        if (result.conflict) {
          // Still a conflict (should be rare)
          return {
            response: result.message,
            alternatives: result.alternatives,
            context: { lastBookingConflict: result },
          };
        }
        // Proceed as normal with call, event, and summary
        const { transcript, callDetails, appointment } = result;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = `You are a helpful assistant. Summarize the following call transcript for the user, confirming the appointment details in a friendly, human way.\n\nAppointment details: ${JSON.stringify(
          appointment,
          null,
          2
        )}\n\nCall transcript: ${transcript}`;
        let completion;
        try {
          completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
          });
        } catch (err) {
          return {
            response:
              "Sorry, I couldn't connect to the language model. Please check your API key and try again.",
            transcript,
            callDetails,
            appointment,
          };
        }
        const message = completion.choices?.[0]?.message?.content;
        return {
          response: message,
          transcript,
          callDetails,
          appointment,
        };
      } else {
        // User did not select a valid alternative
        return {
          response:
            'Please select one of the available alternative time slots by saying "first", "second", or "third".',
          alternatives: context.lastBookingConflict.alternatives,
          context: { lastBookingConflict: context.lastBookingConflict },
        };
      }
    }
    // Normal booking flow
    const result = await bookAppointmentAgent(
      userMessage,
      creds,
      email,
      context?.userPhone,
      onProgress,
      context?.userTimeZone,
      context?.clientNowISO,
      userMessage,
      context?.userName
    );

    // Handle errors from booking agent
    if (result.error) {
      return {
        response: `I'm sorry, I encountered an issue while trying to book your appointment: ${result.message}. Please try again with a more specific request, like "Book a hair appointment tomorrow at 2pm".`,
      };
    }

    if (result.conflict) {
      // Return alternatives and store in context
      return {
        response: result.message,
        alternatives: result.alternatives,
        context: { lastBookingConflict: result },
      };
    }
    // Proceed as normal with call, event, and summary
    const { transcript, callDetails, appointment } = result;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are a helpful assistant. Summarize the following call transcript for the user, confirming the appointment details in a friendly, human way.\n\nAppointment details: ${JSON.stringify(
      appointment,
      null,
      2
    )}\n\nCall transcript: ${transcript}`;
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (err) {
      return {
        response:
          "Sorry, I couldn't connect to the language model. Please check your API key and try again.",
        transcript,
        callDetails,
        appointment,
      };
    }
    const message = completion.choices?.[0]?.message?.content;
    return {
      response: message,
      transcript,
      callDetails,
      appointment,
    };
  }
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
    // Inject user profile context so the agent can answer questions like "What is my name?"
    if (
      context?.userName ||
      context?.userEmail ||
      context?.userPhone ||
      context?.userTimeZone
    ) {
      const profileLines = [
        context?.userName ? `- User Name: ${context.userName}` : null,
        context?.userEmail ? `- User Email: ${context.userEmail}` : null,
        context?.userPhone ? `- User Phone: ${context.userPhone}` : null,
        context?.userTimeZone
          ? `- User Timezone: ${context.userTimeZone}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
      messages.unshift({
        role: 'system',
        content: `USER PROFILE:\n${profileLines}`,
      });
    }
    if (context?.history) {
      // Filter out messages with null/undefined content to prevent OpenAI errors
      const validHistory = context.history.filter(
        (msg: any) => msg && msg.content && typeof msg.content === 'string'
      );
      messages.push(...validHistory);
      // Always add the current user message
      messages.push({ role: 'user', content: userMessage });
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

          // Inject email into function args if provided
          if (email && !functionArgs.calendarId) {
            functionArgs.calendarId = email;
          }

          // Inject email as 'from' parameter for sendEmail calls
          if (email && functionName === 'sendEmail' && !functionArgs.from) {
            functionArgs.from = email;
          }
          // Inject phone/task defaults for general call tool
          if (functionName === 'placeGeneralCall') {
            // Always override with trusted values from the session/user input
            if (context?.userPhone) {
              functionArgs.phone = context.userPhone;
            }
            functionArgs.task = userMessage;
          }
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
          if (functionName === 'createEventAtAlternative') {
            // Check if there was a recent conflict with attendees in the conversation history
            const recentMessages = messages.slice(-10); // Check last 10 messages
            let attendeesFromConflict: string[] = [];

            for (const msg of recentMessages) {
              if (msg.role === 'tool' && msg.content) {
                try {
                  const toolResult = JSON.parse(msg.content);
                  if (
                    toolResult.conflict &&
                    toolResult.originalEvent &&
                    toolResult.originalEvent.attendees
                  ) {
                    attendeesFromConflict =
                      toolResult.originalEvent.attendees.map((a: any) =>
                        typeof a === 'string' ? a : a.email
                      );
                    console.log(
                      'DEBUG: Found attendees from recent conflict:',
                      attendeesFromConflict
                    );
                    break;
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            }

            // Merge attendees from conflict with any provided attendees
            let existingAttendees = [];
            if (functionArgs.attendees) {
              existingAttendees = functionArgs.attendees.map((a: any) =>
                typeof a === 'string' ? a : a.email
              );
            }
            const allAttendees = Array.from(
              new Set([...existingAttendees, ...attendeesFromConflict])
            );
            if (allAttendees.length > 0) {
              functionArgs.attendees = allAttendees;
            }
            console.log(
              'DEBUG: functionArgs for createEventAtAlternative:',
              JSON.stringify(functionArgs, null, 2)
            );
          }
          if (functionHandlers[functionName as keyof typeof functionHandlers]) {
            // Pass context to calendar handlers and other functions that support it
            const contextSupportedFunctions = [
              'getEvents',
              'createEvent',
              'createEventWithContacts',
              'updateEvent',
              'deleteEvent',
              'deleteMultipleEvents',
              'createEventAtAlternative',
              'rescheduleEvent',
              'proposeRescheduleOptions',
              'checkTimeSlotAvailability',
              'placeGeneralCall',
              'askWhichEmailAccount',
              'sendEmailWithAccount',
              'findContactInAccount',
              'parseCallSummaryForBooking',
              'createEventFromCallBooking',
              'getRecentCallSummary',
              'webSearch',
              'webGet',
            ];
            const supportsContext =
              contextSupportedFunctions.includes(functionName);

            const result = supportsContext
              ? await (
                  functionHandlers[
                    functionName as keyof typeof functionHandlers
                  ] as any
                )(functionArgs, creds, onProgress, context)
              : await (
                  functionHandlers[
                    functionName as keyof typeof functionHandlers
                  ] as any
                )(functionArgs, creds, onProgress);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: JSON.stringify(result),
            });
            // If the tool result is an error or needs user input, handle gracefully
            if (result && (result.error || result.needsUserInput)) {
              // Non-fatal for web browsing tools: allow the agent to answer without live data
              const nonFatalTools = new Set(['webSearch', 'webGet']);
              if (!nonFatalTools.has(functionName)) {
                return {
                  content:
                    result.message ||
                    'There was an issue processing your request.',
                  toolResults,
                };
              }
              // For webSearch/webGet failures, continue reasoning without early return
              onProgress?.({
                type: 'progress',
                content: `Continuing without live web data due to a temporary issue.`,
              });
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
        // Post-process to remove timezone abbreviations
        const cleanedContent = removeTimezoneAbbreviations(
          responseMessage.content
        );
        return {
          content: cleanedContent,
        };
      }
      // If neither, break
      break;
    }
    // Fallback: return the last response content or a generic message
    const fallbackContent =
      lastResponse?.content || 'Sorry, I was unable to process your request.';
    return {
      content: removeTimezoneAbbreviations(fallbackContent),
    };
  } catch (error) {
    console.error('[Main Agent] Error:', error);
    throw error;
  }
}
