// Export all handlers
export { calendarHandlers } from './calendarHandlers';
export { conflictHandlers } from './conflictHandlers';
export { conflictResolutionHandlers } from './conflictResolutionHandlers';
export { sendEmail } from './sendEmailHandler';

// Combine all handlers for the main agent
import { calendarHandlers } from './calendarHandlers';
import { conflictHandlers } from './conflictHandlers';
import { conflictResolutionHandlers } from './conflictResolutionHandlers';
import { sendEmail } from './sendEmailHandler';

export const allHandlers = {
  ...calendarHandlers,
  ...conflictHandlers,
  ...conflictResolutionHandlers,
  sendEmail,
};
