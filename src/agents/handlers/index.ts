// Export all handlers
export { calendarHandlers } from './calendarHandlers';
export { conflictHandlers } from './conflictHandlers';
export { conflictResolutionHandlers } from './conflictResolutionHandlers';
export { emailHandlers } from './emailHandlers';
export { sendEmail } from './sendEmailHandler';

// Combine all handlers for the main agent
import { calendarHandlers } from './calendarHandlers';
import { conflictHandlers } from './conflictHandlers';
import { conflictResolutionHandlers } from './conflictResolutionHandlers';
import { emailHandlers } from './emailHandlers';
import { appointmentIntegrationHandlers } from './appointmentIntegrationHandlers';
import { callSummaryAccessHandler } from './callSummaryAccessHandler';
import { sendEmail } from './sendEmailHandler';
import { placeGeneralCallHandler } from '../tools/generalCallTools';

export const allHandlers = {
  ...calendarHandlers,
  ...conflictHandlers,
  ...conflictResolutionHandlers,
  ...emailHandlers,
  ...appointmentIntegrationHandlers,
  ...callSummaryAccessHandler,
  placeGeneralCall: placeGeneralCallHandler,
  sendEmail,
};
