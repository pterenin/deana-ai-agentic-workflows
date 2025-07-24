import axios from 'axios';
import { getEvents, createEvent } from '../activities/calendar';

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

  // Default to tomorrow if no specific date is found
  const date = tomorrow
    ? (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      })()
    : today
    ? new Date()
    : (() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      })(); // Default to tomorrow

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
    // 4. If confirmed, create calendar event
    // (Assume confirmation if call status is 'ended' and transcript contains confirmation)
    if (/confirm|booked|scheduled|appointment is set|yes/i.test(transcript)) {
      onProgress?.({ type: 'progress', content: 'Creating calendar event...' });
      await createEvent(creds, calendarId, {
        start: startISO,
        end: endISO,
        summary: `${details.service} appointment`,
        timeZone: 'America/Los_Angeles',
      });
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
