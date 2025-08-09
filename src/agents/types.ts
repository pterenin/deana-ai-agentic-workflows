// Interface for account information
export interface AccountInfo {
  email: string;
  title: string;
  creds: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
    client_id: string;
  };
}

// Interface for session context
export interface SessionContext {
  sessionId: string;
  history: any[];
  accounts?: {
    primary: AccountInfo;
    secondary: AccountInfo | null;
  };
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  userTimeZone?: string;
  clientNowISO?: string;
  lastBookingConflict?: any;
  // Persist rescheduling state across messages
  rescheduleContext?: {
    eventId: string;
    eventSummary: string;
    calendarEmail: string;
    originalStart: string;
    originalEnd: string;
    proposedOptions?: Array<{
      option: number;
      label: string;
      startISO: string;
      endISO: string;
      timeDisplay: string;
    }>;
  };
}
