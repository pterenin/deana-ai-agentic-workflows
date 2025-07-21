// Export all handlers
export { calendarHandlers } from './calendarHandlers';
export { conflictHandlers } from './conflictHandlers';
export { sendEmail } from './sendEmailHandler';

// Combine all handlers for the main agent
import { calendarHandlers } from './calendarHandlers';
import { conflictHandlers } from './conflictHandlers';
import { sendEmail } from './sendEmailHandler';

export const allHandlers = {
  ...calendarHandlers,
  ...conflictHandlers,
  sendEmail,
};
