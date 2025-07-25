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
  lastBookingConflict?: any;
}
