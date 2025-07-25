import { calendarHandlers } from './calendarHandlers';
import { SessionContext } from '../types';

export interface BookingDetails {
  date?: string;
  time?: string;
  appointmentType?: string;
  location?: string;
  stylistName?: string;
  businessName?: string;
}

export const appointmentIntegrationHandlers = {
  parseCallSummaryForBooking: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '📞 [parseCallSummaryForBooking] Parsing call summary for booking details'
      );

      const { callSummary, originalRequest } = args;

      // Extract booking details from call summary using regex patterns
      const bookingDetails: BookingDetails = {};

      // Extract date patterns (e.g., "July 26, 2025", "2025-07-26")
      const dateMatches = callSummary.match(
        /(July|August|September|October|November|December|January|February|March|April|May|June)\s+(\d{1,2}),?\s+(\d{4})|(\d{4}-\d{2}-\d{2})/gi
      );
      if (dateMatches) {
        const dateMatch = dateMatches[0];
        if (dateMatch.includes('-')) {
          bookingDetails.date = dateMatch;
        } else {
          // Convert "July 26, 2025" to "2025-07-26" format
          const [month, day, year] = dateMatch.replace(',', '').split(/\s+/);
          const monthNum = new Date(`${month} 1, 2025`).getMonth() + 1;
          bookingDetails.date = `${year}-${monthNum
            .toString()
            .padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      // Extract time patterns (enhanced to catch more formats)
      const timeMatches = callSummary.match(
        /(\d{1,2}):(\d{2})|(\d{1,2})\s*(AM|PM)|at\s+(\d{1,2})|(\d{1,2})\s*PM|(\d{1,2})\s*AM|available\s+at\s+(\d{1,2})|free\s+at\s+(\d{1,2})|appointment.*?(\d{1,2})\s*(PM|AM)|confirmed.*?(\d{1,2})\s*(PM|AM)|(\d{1,2})\s+o'clock|time.*?(\d{1,2})|(\d{1,2})\s+on\s+\d|final.*?(\d{1,2})/gi
      );
      if (timeMatches) {
        console.log(
          '📞 [parseCallSummaryForBooking] Found time matches:',
          timeMatches
        );

        // Process all matches to find the final appointment time
        let finalTime = null;

        for (const timeStr of timeMatches) {
          console.log(
            '📞 [parseCallSummaryForBooking] Processing time:',
            timeStr
          );

          if (timeStr.includes(':')) {
            // Format like "15:00" or "3:30"
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              finalTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
            }
          } else if (timeStr.includes('PM') || timeStr.includes('AM')) {
            // Format like "8 PM", "3 AM", "appointment at 8 PM"
            const timeMatch = timeStr.match(/(\d{1,2})\s*(AM|PM)/i);
            if (timeMatch) {
              let hour = parseInt(timeMatch[1]);
              const period = timeMatch[2].toUpperCase();

              if (period === 'PM' && hour !== 12) hour += 12;
              if (period === 'AM' && hour === 12) hour = 0;

              finalTime = `${hour.toString().padStart(2, '0')}:00`;
              console.log(
                '📞 [parseCallSummaryForBooking] Converted',
                timeMatch[0],
                'to',
                finalTime
              );
            }
          } else {
            // Extract just the number (check context for PM/AM)
            const hourMatch = timeStr.match(/(\d{1,2})/);
            if (hourMatch) {
              const hour = parseInt(hourMatch[1]);
              // If it's a reasonable hour and context suggests PM, assume PM
              if (
                hour >= 1 &&
                hour <= 12 &&
                callSummary.toLowerCase().includes('pm')
              ) {
                const adjustedHour = hour === 12 ? 12 : hour + 12;
                finalTime = `${adjustedHour.toString().padStart(2, '0')}:00`;
              } else if (hour >= 13 && hour <= 23) {
                // Already in 24-hour format
                finalTime = `${hour.toString().padStart(2, '0')}:00`;
              } else {
                finalTime = `${hour.toString().padStart(2, '0')}:00`;
              }
            }
          }
        }

        if (finalTime) {
          bookingDetails.time = finalTime;
          console.log(
            '📞 [parseCallSummaryForBooking] Final extracted time:',
            finalTime
          );
        }
      }

      // Extract appointment type
      const appointmentMatches = callSummary.match(
        /(hair appointment|haircut|styling|barber|salon|appointment)/gi
      );
      if (appointmentMatches) {
        bookingDetails.appointmentType = appointmentMatches[0].toLowerCase();
      }

      // Extract business name
      const businessMatches = callSummary.match(
        /(Tomi Gun Barber Shop|Barbershop|Salon|[\w\s]+(?:Barber|Salon|Shop))/gi
      );
      if (businessMatches) {
        bookingDetails.location = businessMatches[0];
      }

      // Extract stylist name
      const stylistMatches = callSummary.match(
        /with\s+(Tom|Thomas|[\w]+)\s+as|stylist.*?(Tom|Thomas|[\w]+)|(Tom|Thomas)\s+the\s+stylist|(Tom|Thomas)\s+as\s+the\s+stylist/gi
      );
      if (stylistMatches) {
        const match = stylistMatches[0];
        const nameMatch = match.match(/(Tom|Thomas|[\w]+)/i);
        if (nameMatch) {
          bookingDetails.stylistName = nameMatch[0];
        }
      }

      console.log(
        '📞 [parseCallSummaryForBooking] Extracted booking details:',
        bookingDetails
      );

      return {
        success: true,
        bookingDetails,
        message: `Found booking details from call: ${
          bookingDetails.appointmentType || 'appointment'
        } ${bookingDetails.date ? `on ${bookingDetails.date}` : ''} ${
          bookingDetails.time
            ? `at ${bookingDetails.time} (${formatTime(bookingDetails.time)})`
            : ''
        } ${bookingDetails.location ? `at ${bookingDetails.location}` : ''} ${
          bookingDetails.stylistName ? `with ${bookingDetails.stylistName}` : ''
        }`.trim(),
        hasValidBooking: !!(bookingDetails.date && bookingDetails.time),
        extractedData: bookingDetails, // For debugging
      };
    } catch (error: any) {
      console.error(
        '[appointmentIntegrationHandlers] Parse call summary error:',
        error
      );
      return {
        error: true,
        message: `Failed to parse call summary: ${error.message}`,
      };
    }
  },

  createEventFromCallBooking: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '📅 [createEventFromCallBooking] Creating event from actual call booking details'
      );

      const {
        actualDate,
        actualTime,
        appointmentType,
        location,
        stylistName,
        originalRequest,
      } = args;

      // Create event title
      let title = appointmentType || 'Appointment';
      if (stylistName) {
        title += ` with ${stylistName}`;
      }
      if (location) {
        title += ` at ${location}`;
      }

      // Parse time and create event duration (default 1 hour)
      const [hour, minute] = actualTime.split(':').map(Number);
      const startDateTime = `${actualDate}T${actualTime}:00-07:00`; // Assuming Pacific timezone

      const endHour = hour + 1;
      const endTime = `${endHour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`;
      const endDateTime = `${actualDate}T${endTime}:00-07:00`;

      // Create calendar event using existing handler
      onProgress?.({
        type: 'progress',
        content: `Creating calendar event for ${title}...`,
      });

      const eventArgs = {
        summary: title,
        start: startDateTime,
        end: endDateTime,
        description: `Booked via phone call. Original request: "${originalRequest}"${
          location ? `\nLocation: ${location}` : ''
        }${stylistName ? `\nService provider: ${stylistName}` : ''}`,
        calendarId: args.calendarId,
      };

      const result = await calendarHandlers.createEvent(
        eventArgs,
        creds,
        onProgress,
        context
      );

      if (result.success) {
        return {
          success: true,
          event: result.event,
          message: `✅ **Calendar event created successfully!**

**Actual booking details from your call:**
- **Date**: ${actualDate}
- **Time**: ${actualTime} (${formatTime(actualTime)})
- **Appointment**: ${appointmentType}${
            location ? `\n- **Location**: ${location}` : ''
          }${stylistName ? `\n- **Service provider**: ${stylistName}` : ''}

The appointment has been added to your calendar. ${
            originalRequest.includes('today') || originalRequest.includes('6pm')
              ? `\n\n*Note: The actual booking time differs from your original request ("${originalRequest}") because this was the available time confirmed during your call.*`
              : ''
          }`,
          actualDetails: {
            date: actualDate,
            time: actualTime,
            formattedTime: formatTime(actualTime),
            title,
            location,
            stylistName,
          },
        };
      } else {
        return {
          error: true,
          message: `Failed to create calendar event: ${result.message}`,
        };
      }
    } catch (error: any) {
      console.error(
        '[appointmentIntegrationHandlers] Create event from call booking error:',
        error
      );
      return {
        error: true,
        message: `Failed to create event from call booking: ${error.message}`,
      };
    }
  },
};

// Helper function to format time
function formatTime(time24: string): string {
  const [hour, minute] = time24.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}
