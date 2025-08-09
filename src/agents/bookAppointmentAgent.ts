import axios from 'axios';
import OpenAI from 'openai';
import { getAvailability, createEvent } from '../activities/calendar';

// Get YYYY-MM-DD for a given Date in a specific IANA timezone
function formatDateISOInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

// Normalize a user-provided phone number to E.164 if possible
function normalizePhoneNumber(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If already in E.164 and valid-ish, accept
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  // Strip non-digits
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return null;
  // Simple heuristic: 10 digits -> assume US/CA and prefix +1
  if (digitsOnly.length === 10) return `+1${digitsOnly}`;
  // 11-15 digits -> prefix +
  if (digitsOnly.length >= 11 && digitsOnly.length <= 15)
    return `+${digitsOnly}`;
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

// Use LLM to extract the actual confirmed start time from the call summary
async function extractConfirmedTimeFromSummary(
  summary: string
): Promise<string | null> {
  try {
    if (!summary || summary.trim().length === 0) return null;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You will be given a phone call summary about booking an appointment. Extract the confirmed START time of the appointment.

Rules:
- Return ONLY a JSON object with a key time24 in 24-hour HH:MM format (e.g., "15:00").
- If the summary mentions a time RANGE (e.g., 3 PM to 4 PM), return the START time.
- If no clear time is present, return {"time24": null}.

Summary:
${summary}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const content = completion.choices?.[0]?.message?.content || '';
    // Attempt to parse JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.time24 === 'string') {
          // Basic sanity check HH:MM
          if (/^\d{2}:\d{2}$/.test(parsed.time24)) return parsed.time24;
        }
      } catch {}
    }
    // Fallback: simple regex to find first AM/PM time and convert
    const fallback = summary.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (fallback) {
      let hour = parseInt(fallback[1], 10);
      const minute = fallback[2] ? parseInt(fallback[2], 10) : 0;
      const ampm = fallback[3]?.toLowerCase();
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`;
    }
    return null;
  } catch (e) {
    console.log(
      '[extractConfirmedTimeFromSummary] Error:',
      (e as Error).message
    );
    return null;
  }
}

// LLM decision: determine if booking succeeded based on call summary, and extract confirmed time if mentioned
async function analyzeBookingOutcomeFromSummary(
  summary: string,
  requestedTime24?: string
): Promise<{ success: boolean; reason: string; time24: string | null }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You will be given a phone call summary for an appointment booking attempt. Decide if the booking succeeded, and extract the FINAL confirmed start time if present.

Return ONLY strict JSON with keys:
{
  "success": boolean,
  "reason": string,  // brief human-readable reason (e.g., "no availability", "confirmed with Alex at 17:00")
  "time24": string | null // confirmed start time in 24-hour HH:MM if present, else null
}

Rules:
- If the summary indicates no availability, a callback needed, technical issue, or not confirmed, success = false.
- If the summary states the appointment was booked/confirmed/scheduled, success = true.
- If a new time was agreed (e.g., 5pm), set time24 accordingly (24-hour). If no explicit time, set null.
- Do not infer a time from the requested window unless the summary says it was confirmed.

Summary:
${summary}

RequestedTime (for context only, don't assume it's confirmed): ${
      requestedTime24 || 'unknown'
    }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const content = completion.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          typeof parsed.success === 'boolean' &&
          typeof parsed.reason === 'string'
        ) {
          const t =
            typeof parsed.time24 === 'string' &&
            /^\d{2}:\d{2}$/.test(parsed.time24)
              ? parsed.time24
              : null;
          return { success: parsed.success, reason: parsed.reason, time24: t };
        }
      } catch {}
    }
  } catch (e) {
    console.log(
      '[analyzeBookingOutcomeFromSummary] Error:',
      (e as Error).message
    );
  }
  // Fallback conservative: unknown -> not successful
  return {
    success: false,
    reason: 'Could not determine booking outcome from summary',
    time24: null,
  };
}

// Use LLM to extract booking intent details (service, date, time) robustly from user text
async function extractAppointmentDetailsWithLLM(
  userRequest: string,
  opts?: { tz?: string; nowISO?: string }
): Promise<{
  service: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM (24-hour)
  duration_minutes?: number;
  hair_dresser?: string;
} | null> {
  try {
    const now = opts?.nowISO ? new Date(opts.nowISO) : new Date();
    const tz = opts?.tz || 'America/Los_Angeles';
    const todayISO = formatDateISOInTimeZone(now, tz);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You extract booking details from a short user request.

Current local date: ${todayISO}
Local timezone: ${tz}

Instructions:
- Resolve ANY relative date phrases strictly relative to the current LOCAL date above, not UTC. Examples: "tomorrow", "day after tomorrow", "next Friday", "day after next Tuesday".
- Return ONLY strict JSON, no prose.
- Keys: {"service": string, "date": "YYYY-MM-DD", "start_time": "HH:MM" (24-hour), "duration_minutes": number}
- If user specifies a range (e.g., 3 PM - 4 PM), choose the start time.
- If only the hour is given (e.g., "3pm"), set minutes to 00.
- Misspellings like "tomorow", "tommorow", "tmrw" must be treated as tomorrow.
- If the request has a relative phrase, the computed date MUST match that phrase relative to the current LOCAL date.
- Never choose a past date.
- If service is missing, default to "hair appointment".
- Default duration_minutes to 60 if not specified.

User request:
${userRequest}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    const content = completion.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[LLM Extraction] tz/now/today:', {
      tz,
      nowISO: opts?.nowISO,
      todayISO,
    });
    console.log('[LLM Extraction] raw:', content);
    console.log('[LLM Extraction] parsed:', parsed);

    // Post-fix for common natural language like "tomorrow" to avoid LLM off-by-one
    const requestLower = userRequest.toLowerCase();
    const tomorrowRegex =
      /\b(tomm?orr?ow|tomorow|tmrw|next day|day after today)\b/i;
    const todayRegex = /\b(today|now)\b/i;
    const baseToday = todayISO;
    const baseTomorrowDate = new Date(now);
    baseTomorrowDate.setDate(baseTomorrowDate.getDate() + 1);
    const baseTomorrow = formatDateISOInTimeZone(baseTomorrowDate, tz);

    const isTomorrow = tomorrowRegex.test(requestLower);
    const isToday = todayRegex.test(requestLower);
    console.log('[LLM Extraction] tokens match:', {
      isTomorrow,
      isToday,
      requestLower,
    });
    if (isTomorrow) {
      console.log(
        '[LLM Extraction] Forcing date to baseTomorrow due to "tomorrow" token:',
        baseTomorrow
      );
      parsed.date = baseTomorrow;
    } else if (isToday) {
      console.log(
        '[LLM Extraction] Forcing date to baseToday due to "today/now" token:',
        baseToday
      );
      parsed.date = baseToday;
    }
    console.log('[LLM Extraction] corrected (if needed):', parsed);
    if (
      parsed &&
      typeof parsed.service === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) &&
      /^\d{2}:\d{2}$/.test(parsed.start_time)
    ) {
      if (
        !parsed.duration_minutes ||
        typeof parsed.duration_minutes !== 'number'
      ) {
        parsed.duration_minutes = 60;
      }
      return parsed;
    }
    return null;
  } catch (e) {
    console.log(
      '[extractAppointmentDetailsWithLLM] Error:',
      (e as Error).message
    );
    return null;
  }
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

  // Determine target date with resilient parsing
  // 1) Explicit ISO date: YYYY-MM-DD
  const isoDateMatch = userRequest.match(/(\d{4})-(\d{2})-(\d{2})/);
  // 2) US date: M/D/YYYY or MM/DD/YYYY
  const usDateMatch = userRequest.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  let date: Date;
  if (isoDateMatch) {
    const [, y, m, d] = isoDateMatch;
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else if (usDateMatch) {
    const [, m, d, y] = usDateMatch;
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else if (today) {
    date = new Date();
  } else if (tomorrow) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    date = t;
  } else {
    date = new Date(); // DEFAULT to TODAY
  }

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
  phone?: string,
  onProgress?: (update: any) => void,
  timezone?: string,
  clientNowISO?: string,
  originalUserMessage?: string,
  userName?: string
) {
  try {
    console.log('[bookAppointmentAgent] invoked with phone:', phone);
    // Validate and normalize phone number early
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      onProgress?.({
        type: 'error',
        content:
          'The phone number provided is missing or invalid. Please provide a valid phone in E.164 format (e.g., +14155552671).',
      });
      return {
        error: true,
        message:
          'Invalid or missing phone number. Please provide a valid phone in E.164 format (e.g., +14155552671).',
        appointment: null,
      };
    }
    // Step 0: Use LLM to robustly extract booking details; fallback to programmatic parsing
    onProgress?.({
      type: 'progress',
      content: 'Understanding your request...',
    });
    // Prefer the raw/original message if available for better relative-date parsing
    const extractionSource = originalUserMessage || userRequest;
    const llmDetails = await extractAppointmentDetailsWithLLM(
      extractionSource,
      {
        tz: timezone || (creds?.timezone as string) || undefined,
        nowISO: clientNowISO,
      }
    );
    let details = llmDetails
      ? (() => {
          const duration = llmDetails.duration_minutes || 60;
          const date = llmDetails.date;
          const [hStr, mStr] = llmDetails.start_time.split(':');
          // Construct Date using the provided timezone and now reference to avoid off-by-one day
          const tz =
            timezone || (creds?.timezone as string) || 'America/Los_Angeles';
          // Build a local date-time string and let Date parse as local, then we only use date/time components afterwards
          const startLocal = new Date(
            `${date}T${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}:00`
          );
          const startDate = startLocal;
          // Build consistent shape with programmatic parser
          const endHour = (parseInt(hStr, 10) + Math.floor(duration / 60))
            .toString()
            .padStart(2, '0');
          const endMin = (parseInt(mStr, 10) + (duration % 60)) % 60;
          const endTime = `${endHour}:${endMin.toString().padStart(2, '0')}`;
          return {
            service: llmDetails.service || 'hair appointment',
            date,
            start_time: `${hStr.padStart(2, '0')}:${mStr.padStart(2, '0')}`,
            end_time: endTime,
            hair_dresser: llmDetails.hair_dresser || 'Tom',
            calendar_availability: 'available',
            fullStartDateTime: startDate,
          };
        })()
      : extractAppointmentDetails(userRequest);

    // Validate that we have a valid date
    if (!details.date || !details.fullStartDateTime) {
      throw new Error(
        'Could not parse date from the request. Please specify a valid date like "tomorrow" or "today".'
      );
    }

    // 1. Check calendar for conflicts
    const calendarId = email || 'tps8327@gmail.com'; // use provided email or fallback
    const date = details.date;
    const tz = timezone || (creds?.timezone as string) || 'America/Los_Angeles';
    // Format requested slot into ISO with Z while respecting the user's timezone by first constructing local and then converting
    const [sh, sm] = details.start_time.split(':').map((s) => parseInt(s, 10));
    const [eh, em] = details.end_time.split(':').map((s) => parseInt(s, 10));
    const startLocal = new Date(`${date}T${details.start_time}:00`);
    const endLocal = new Date(`${date}T${details.end_time}:00`);
    const startISO = startLocal.toISOString();
    const endISO = endLocal.toISOString();

    onProgress?.({
      type: 'progress',
      content: `Checking calendar availability for ${
        details.service
      } on ${details.fullStartDateTime.toLocaleDateString()} at ${
        details.start_time
      }...`,
    });

    const availability = await getAvailability(creds, startISO, endISO, [
      calendarId,
    ]);
    if (availability && availability.available === false) {
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
        const altAvailability = await getAvailability(
          creds,
          altStartISO,
          altEndISO,
          [calendarId]
        );
        if (altAvailability && altAvailability.available) {
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
    console.log('[bookAppointmentAgent] Using phone number for Vapi call:', {
      inputPhone: phone,
      normalizedPhone,
    });
    const vapiResponse = await axios
      .post(
        'https://api.vapi.ai/call',
        {
          phoneNumberId: 'a301522e-1c53-44f4-9fbe-e5433a3256f6',
          assistantId: '00d671c2-589c-4946-8cde-ad75b5009cbb',
          // customer: { number: '+17788713018' },
          customer: { number: normalizedPhone },
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
                  content: `Deana is an intelligent personal assistant specializing in outbound calling and scheduling appointments. Deana’s task for this call is to book a ${
                    details.service
                  } for her client, ${
                    userName || 'the client'
                  }, at Tomy Gun Barbershop. She will speak with a representative and follow these instructions:\n\n1. Preferred Appointment Time:\n   - Book an appointment between ${
                    details.start_time
                  } - ${details.end_time} on ${
                    details.date
                  }.\n   - If available, request ${
                    details.hair_dresser
                  } as the stylist. If they are unavailable, any other available stylist is fine.\n\n2. Availability Check:\n   - If no slots are available within the preferred timeframe, check for alternative openings outside of ${
                    userName || 'the client'
                  }'s calendar conflicts.\n   - Review ${
                    userName || 'the client'
                  }'s schedule here: ${
                    details.calendar_availability
                  } to ensure there are no conflicts before confirming the appointment.\n\n3. Confirmation Details:\n   - Confirm the date, time, and stylist name before finalizing.\n   - If no appointments are available, ask when the next earliest opening is and offer to book that instead.\n\n4. Closing the Call:\n   - Thank the representative for their time and say that ${
                    userName || 'the client'
                  } will receive a reminder of the appointment.`,
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
      )
      .catch((err) => {
        // Surface clearer error details when Vapi returns 4xx/5xx
        const status = err?.response?.status;
        const data = err?.response?.data;
        const detail =
          (typeof data === 'string' ? data : JSON.stringify(data)) ||
          err.message;
        throw new Error(
          status
            ? `Vapi call failed (${status}): ${detail}`
            : `Vapi call failed: ${detail}`
        );
      });
    console.log('[vapiResponse] - ', vapiResponse.data);
    const callId = vapiResponse.data.id;
    // Notify client about call status transitions
    const statusLabelMap: Record<string, string> = {
      ringing: 'Call ringing... ',
      'in-progress': 'Call in progress...',
      ended: 'Call ended.',
      queued: 'Call queued...',
      connecting: 'Connecting call...',
    };
    let lastStatus = (vapiResponse.data.status as string) || '';
    if (lastStatus && statusLabelMap[lastStatus]) {
      onProgress?.({ type: 'progress', content: statusLabelMap[lastStatus] });
    }
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
      if (status && status !== lastStatus && statusLabelMap[status]) {
        onProgress?.({ type: 'progress', content: statusLabelMap[status] });
        lastStatus = status;
      }
    }
    // 4. Decide booking outcome using LLM analysis of the call summary
    const summaryText = poll.data?.summary || '';
    const bookingDecision = await analyzeBookingOutcomeFromSummary(
      summaryText,
      details.start_time
    );

    if (!bookingDecision.success) {
      console.log(
        '[bookAppointmentAgent] Booking not successful:',
        bookingDecision
      );

      onProgress?.({
        type: 'error',
        content:
          bookingDecision.reason && bookingDecision.reason.length > 0
            ? `Booking not completed: ${bookingDecision.reason}`
            : 'Booking not completed based on call results.',
      });

      return {
        error: true,
        message:
          bookingDecision.reason && bookingDecision.reason.length > 0
            ? bookingDecision.reason
            : 'Booking not completed based on call results.',
        appointment: null,
        transcript,
        callDetails: poll.data,
      };
    }

    // 5. Booking successful → create calendar event using ACTUAL confirmed time if provided
    if (bookingDecision.success) {
      onProgress?.({ type: 'progress', content: 'Creating calendar event...' });

      // Prefer the decision's time; fallback to additional extractor
      let actualTime = bookingDecision.time24;
      if (!actualTime) {
        actualTime = await extractConfirmedTimeFromSummary(summaryText);
      }
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
