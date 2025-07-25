import axios from 'axios';
import { getEvents, createEvent } from '../activities/calendar';

// Helper function to parse actual confirmed time from phone call transcript
function parseActualTimeFromTranscript(transcript: string): string | null {
  console.log(
    '[parseActualTimeFromTranscript] Parsing transcript:',
    transcript
  );

  // Enhanced regex patterns to catch confirmed appointment times
  const timePatterns = [
    /confirmed.*?(?:for|at|on).*?(\d{1,2})\s*(?:o'clock|PM|AM)/gi,
    /appointment.*?(?:confirmed|finalized|booked|set).*?(?:for|at|on).*?(\d{1,2})\s*(?:o'clock|PM|AM)/gi,
    /(?:confirmed|finalized|booked|set).*?(?:for|at|on).*?(\d{1,2})\s*(?:o'clock|PM|AM)/gi,
    /we have.*?(?:confirmed|appointment).*?(?:for|at|on).*?(\d{1,2})\s*(?:o'clock|PM|AM)/gi,
    /(?:at|for)\s*(\d{1,2})\s*(?:PM|AM).*?(?:with|Tom|stylist)/gi,
    /(\d{1,2})\s*(?:PM|AM).*?(?:confirmed|Tom|stylist|available)/gi,
    /available.*?(?:at|for)\s*(\d{1,2})\s*PM/gi,
    /(\d{1,2})\s*(?:o'clock)?.*?(?:PM|AM)/gi,
  ];

  const allMatches = [];

  for (const pattern of timePatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const hour = parseInt(match[1]);
      if (hour >= 1 && hour <= 12) {
        // Convert to 24-hour format (assume PM for appointments)
        const hour24 = hour === 12 ? 12 : hour + 12;
        const timeStr = `${hour24.toString().padStart(2, '0')}:00`;
        allMatches.push({
          time: timeStr,
          hour: hour,
          context: match[0],
        });
        console.log(
          `[parseActualTimeFromTranscript] Found potential time: ${hour} -> ${timeStr} in context: "${match[0]}"`
        );
      }
    }
  }

  if (allMatches.length > 0) {
    // Return the last/most recent confirmed time (usually the final confirmation)
    const finalTime = allMatches[allMatches.length - 1];
    console.log(
      `[parseActualTimeFromTranscript] Using final confirmed time: ${finalTime.time}`
    );
    return finalTime.time;
  }

  console.log(
    '[parseActualTimeFromTranscript] No confirmed time found in transcript'
  );
  return null;
}

// Helper function to convert 24-hour time to 12-hour format for user-friendly display
function convertTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${ampm}`;
}

// Helper function to validate if phone call was actually successful
function validateCallSuccess(
  callData: any,
  transcript: string
): { success: boolean; message: string } {
  console.log('[validateCallSuccess] Validating call:', {
    status: callData?.status,
    endedReason: callData?.endedReason,
    summary: callData?.summary || 'No summary',
    transcriptLength: transcript?.length || 0,
    customerNumber: callData?.customer?.number,
  });

  // Check if call ended successfully
  if (callData?.status !== 'ended') {
    return {
      success: false,
      message: `Call failed - status: ${callData?.status || 'unknown'}`,
    };
  }

  // Check for call failure reasons
  const endedReason = callData?.endedReason;
  const customerNumber = callData?.customer?.number || 'unknown number';

  if (
    endedReason === 'no-answer' ||
    endedReason === 'busy' ||
    endedReason === 'failed'
  ) {
    return {
      success: false,
      message: `There was a problem booking the appointment. The number ${customerNumber} did not answer or the call failed.`,
    };
  }

  if (
    endedReason === 'customer-ended-call' &&
    (!transcript || transcript.trim().length < 20)
  ) {
    return {
      success: false,
      message: `There was a problem booking the appointment. The number ${customerNumber} got disconnected before completing the booking.`,
    };
  }

  // Check if we have a meaningful transcript
  if (!transcript || transcript.trim().length < 10) {
    return {
      success: false,
      message: `There was a problem booking the appointment. The number ${customerNumber} did not answer or got disconnected.`,
    };
  }

  // Check if we have a summary (indicates successful call processing)
  if (!callData?.summary || callData.summary.trim().length < 10) {
    return {
      success: false,
      message: `There was a problem booking the appointment. The number ${customerNumber} did not answer or got disconnected.`,
    };
  }

  // Check for explicit booking failure in transcript or summary
  const failureKeywords =
    /sorry|cannot|unable|closed|not available|no appointments|fully booked/i;
  if (
    failureKeywords.test(transcript) ||
    failureKeywords.test(callData?.summary || '')
  ) {
    return {
      success: false,
      message: `The appointment could not be booked. The business ${customerNumber} indicated they are not available or fully booked.`,
    };
  }

  console.log('[validateCallSuccess] Call validation passed');
  return {
    success: true,
    message: 'Call completed successfully',
  };
}

// Simple extraction for demo; replace with robust NLP/date parsing as needed
function extractAppointmentDetails(userRequest: string) {
  // Example: "Book a hair appointment tomorrow at 4pm"
  const serviceMatch = userRequest.match(
    /hair|nail|doctor|dentist|appointment|barber|cut|massage/i
  );
  const timeMatch = userRequest.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);

  // Handle common misspellings and variations
  const tomorrow = /tomm?orr?ow|next day/i.test(userRequest);
  const today = /today|now/i.test(userRequest);

  console.log('[extractAppointmentDetails] Date parsing:', {
    userRequest,
    today,
    tomorrow,
    todayMatch: userRequest.match(/today|now/i),
    tomorrowMatch: userRequest.match(/tomm?orr?ow|next day/i),
  });

  // Fix: Properly handle today vs tomorrow vs default
  const date = today
    ? new Date() // TODAY - current date
    : tomorrow
    ? (() => {
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        return tomorrowDate;
      })() // TOMORROW - next day
    : new Date(); // DEFAULT to TODAY, not tomorrow

  let hour = 16; // default 4pm
  let minute = 0;

  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    // Handle AM/PM conversion
    if (timeMatch[3]) {
      const ampm = timeMatch[3].toLowerCase();

      // Handle special case: if hour is already in 24-hour format (13-23) with pm, it's redundant
      if (hour >= 13 && hour <= 23 && ampm === 'pm') {
        // Keep the 24-hour format as is (e.g., "19pm" becomes 19:00)
        // No conversion needed
      } else if (ampm === 'pm' && hour < 12) {
        hour += 12;
      } else if (ampm === 'am' && hour === 12) {
        hour = 0;
      }
      // For AM times other than 12am, keep the hour as is
    } else if (hour >= 1 && hour <= 7) {
      // Only assume PM for times 1-7 when NO AM/PM is specified
      hour += 12;
    }

    if (timeMatch[2]) {
      minute = parseInt(timeMatch[2].slice(1), 10);
    }
  }

  // Set the specific time
  date.setHours(hour, minute, 0, 0);

  // Get date components AFTER setting the time to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    service: serviceMatch ? serviceMatch[0] : 'hair appointment',
    date: `${year}-${month}-${day}`,
    start_time: date.toTimeString().slice(0, 5),
    end_time:
      (hour + 1).toString().padStart(2, '0') +
      ':' +
      minute.toString().padStart(2, '0'),
    hair_dresser: 'Tom', // default stylist
    calendar_availability: 'available',
    fullStartDateTime: date, // Include full date object for easier manipulation
  };
}

export async function bookAppointmentAgent(
  userRequest: string,
  creds: any,
  email?: string,
  onProgress?: (update: any) => void
) {
  try {
    const details = extractAppointmentDetails(userRequest);

    // Validate that we have a valid date
    if (!details.date || !details.fullStartDateTime) {
      throw new Error(
        'Could not parse date from the request. Please specify a valid date like "tomorrow" or "today".'
      );
    }

    // 1. Check calendar for conflicts
    const calendarId = email || 'tps8327@gmail.com'; // use provided email or fallback
    const date = details.date;
    const startISO = `${date}T${details.start_time}:00-07:00`;
    const endISO = `${date}T${details.end_time}:00-07:00`;

    onProgress?.({
      type: 'progress',
      content: `Checking calendar availability for ${
        details.service
      } on ${details.fullStartDateTime.toLocaleDateString()} at ${
        details.start_time
      }...`,
    });

    const events = await getEvents(creds, calendarId, startISO, endISO);
    if (events && events.length > 0) {
      // Conflict: propose 3 alternatives
      const requestedDateTime = new Date(startISO);
      const duration =
        (new Date(endISO).getTime() - requestedDateTime.getTime()) / 60000;
      const alternatives = [
        {
          start: new Date(requestedDateTime.getTime() - 60 * 60000),
          end: new Date(
            requestedDateTime.getTime() - 60 * 60000 + duration * 60000
          ),
          label: '1 hour earlier',
        },
        {
          start: new Date(requestedDateTime.getTime() + 60 * 60000),
          end: new Date(
            requestedDateTime.getTime() + 60 * 60000 + duration * 60000
          ),
          label: '1 hour later',
        },
        {
          start: new Date(requestedDateTime.getTime() + 120 * 60000),
          end: new Date(
            requestedDateTime.getTime() + 120 * 60000 + duration * 60000
          ),
          label: '2 hours later',
        },
      ];
      // Check which alternatives are available
      const availableAlternatives = [];
      for (let alt of alternatives) {
        const altStartISO = alt.start.toISOString();
        const altEndISO = alt.end.toISOString();
        const altEvents = await getEvents(
          creds,
          calendarId,
          altStartISO,
          altEndISO
        );
        if (!altEvents || altEvents.length === 0) {
          availableAlternatives.push({
            ...alt,
            startISO: altStartISO,
            endISO: altEndISO,
            timeDisplay: `${alt.start.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })} - ${alt.end.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}`,
          });
        }
      }
      return {
        conflict: true,
        alternatives: availableAlternatives,
        message: `The requested time is not available. Here are ${
          availableAlternatives.length
        } alternative time slots: ${availableAlternatives
          .map((alt, i) => `\n${i + 1}. ${alt.label}: ${alt.timeDisplay}`)
          .join('')}. Please select one or suggest a different time.`,
      };
    }
    // 2. Start the call
    const vapiResponse = await axios.post(
      'https://api.vapi.ai/call',
      {
        phoneNumberId: 'a301522e-1c53-44f4-9fbe-e5433a3256f6',
        assistantId: '00d671c2-589c-4946-8cde-ad75b5009cbb',
        customer: { number: '+16049108101' },
        type: 'outboundPhoneCall',
        assistant: {
          voice: { provider: 'vapi', voiceId: 'Paige' },
          firstMessage: `Hey I'd like to book a ${details.service} appointment`,
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `Diana is an intelligent personal assistant specializing in outbound calling and scheduling appointments. Ava’s task for this call is to book a ${details.service} for her client, Pavel, at Tomy Gun Barbershop. She will speak with a representative and follow these instructions:\n\n1. Preferred Appointment Time:\n   - Book an appointment between ${details.start_time} - ${details.end_time} on ${details.date}.\n   - If available, request ${details.hair_dresser} as the stylist. If they are unavailable, any other available stylist is fine.\n\n2. Availability Check:\n   - If no slots are available within the preferred timeframe, check for alternative openings outside of Pavel's calendar conflicts.\n   - Review Pavel's schedule here: ${details.calendar_availability} to ensure there are no conflicts before confirming the appointment.\n\n3. Confirmation Details:\n   - Confirm the date, time, and stylist name before finalizing.\n   - If no appointments are available, ask when the next earliest opening is and offer to book that instead.\n\n4. Closing the Call:\n   - Thank the representative for their time and confirm that Pavel will receive a reminder of the appointment.`,
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: 'Bearer 3981fd0c-e2f3-4200-a43d-107b6abf1680',
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('[vapiResponse] - ', vapiResponse.data);
    const callId = vapiResponse.data.id;
    // 3. Poll for call completion
    let status = '';
    let transcript = '';
    let poll: any = { data: {} };
    while (status !== 'ended') {
      await new Promise((res) => setTimeout(res, 5000)); // wait 5 seconds
      poll = await axios.get(`https://api.vapi.ai/call/${callId}`, {
        headers: {
          Authorization: 'Bearer 3981fd0c-e2f3-4200-a43d-107b6abf1680',
        },
      });
      status = poll.data.status;
      transcript = poll.data.transcript;
      console.log('[poll] - ', poll.data);
    }
    // 4. Validate call success before creating calendar event
    const callValidation = validateCallSuccess(poll.data, transcript);

    if (!callValidation.success) {
      console.log(
        '[bookAppointmentAgent] Call validation failed:',
        callValidation
      );

      onProgress?.({
        type: 'error',
        content: `Failed to book appointment: ${callValidation.message}`,
      });

      return {
        error: true,
        message: callValidation.message,
        appointment: null,
        transcript,
        callDetails: poll.data,
      };
    }

    // 5. If confirmed, create calendar event using ACTUAL confirmed time from transcript
    if (/confirm|booked|scheduled|appointment is set|yes/i.test(transcript)) {
      onProgress?.({ type: 'progress', content: 'Creating calendar event...' });

      // Parse the ACTUAL confirmed time from the transcript
      const actualTime = parseActualTimeFromTranscript(transcript);
      let actualStartISO = startISO; // Default to original if parsing fails
      let actualEndISO = endISO;

      if (actualTime) {
        console.log(
          '[bookAppointmentAgent] Original requested time:',
          details.start_time
        );
        console.log(
          '[bookAppointmentAgent] Actual confirmed time from transcript:',
          actualTime
        );

        // Create new ISO strings with the actual confirmed time
        actualStartISO = `${details.date}T${actualTime}:00-07:00`;
        const actualEndHour = String(
          parseInt(actualTime.split(':')[0]) + 1
        ).padStart(2, '0');
        const actualEndMinute = actualTime.split(':')[1];
        actualEndISO = `${details.date}T${actualEndHour}:${actualEndMinute}:00-07:00`;

        console.log('[bookAppointmentAgent] Using actual calendar times:', {
          start: actualStartISO,
          end: actualEndISO,
        });
      }

      await createEvent(creds, calendarId, {
        start: actualStartISO,
        end: actualEndISO,
        summary: `${details.service} appointment`,
        timeZone: 'America/Los_Angeles',
      });

      // Check if time was changed and prepare notification message
      let timeChangeNotification = '';
      if (actualTime && actualTime !== details.start_time) {
        const originalTime12hr = convertTo12Hour(details.start_time);
        const actualTime12hr = convertTo12Hour(actualTime);
        timeChangeNotification = ` Please note that the appointment time was adjusted from your original request of ${originalTime12hr} to ${actualTime12hr} based on availability confirmed during the call.`;

        console.log('[bookAppointmentAgent] Time change detected:', {
          original: originalTime12hr,
          actual: actualTime12hr,
          notification: timeChangeNotification,
        });
      }

      return {
        transcript,
        callDetails: poll.data,
        appointment: details,
        timeChangeNotification, // Include this for the AI to use in response
      };
    }
    return { transcript, callDetails: poll.data, appointment: details };
  } catch (error: any) {
    onProgress?.({
      type: 'error',
      content: `Failed to book appointment: ${error.message}`,
    });

    // Return error response instead of throwing
    return {
      error: true,
      message: error.message,
      appointment: null,
    };
  }
}
