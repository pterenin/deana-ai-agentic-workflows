// Session-based credential store for managing Google account credentials
interface AccountInfo {
  email: string;
  title: string;
  creds: {
    access_token: string;
    refresh_token: string;
    expires_at: string;
    client_id: string;
  };
}

interface SessionCredentials {
  sessionId: string;
  primaryAccount?: AccountInfo;
  secondaryAccount?: AccountInfo;
  createdAt: Date;
  lastUsed: Date;
}

// In-memory store for session credentials
const sessionCredentialStore = new Map<string, SessionCredentials>();

// Cleanup interval for expired sessions (24 hours)
const SESSION_EXPIRY_HOURS = 24;
const CLEANUP_INTERVAL_MINUTES = 60;

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = new Date();
  const expiryTime = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

  for (const [sessionId, sessionCreds] of sessionCredentialStore.entries()) {
    const timeSinceLastUsed = now.getTime() - sessionCreds.lastUsed.getTime();
    if (timeSinceLastUsed > expiryTime) {
      console.log(
        `🧹 [SessionCredStore] Cleaning up expired session: ${sessionId}`
      );
      sessionCredentialStore.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL_MINUTES * 60 * 1000);

/**
 * Store credentials for a session
 */
export function storeSessionCredentials(
  sessionId: string,
  primaryAccount?: AccountInfo,
  secondaryAccount?: AccountInfo
): void {
  const now = new Date();
  const sessionCreds: SessionCredentials = {
    sessionId,
    primaryAccount,
    secondaryAccount,
    createdAt: now,
    lastUsed: now,
  };

  sessionCredentialStore.set(sessionId, sessionCreds);

  console.log(
    `🏪 [SessionCredStore] Stored credentials for session ${sessionId}:`,
    {
      hasPrimary: !!primaryAccount,
      hasSecondary: !!secondaryAccount,
      primaryEmail: primaryAccount?.email,
      secondaryEmail: secondaryAccount?.email,
      primaryTitle: primaryAccount?.title,
      secondaryTitle: secondaryAccount?.title,
    }
  );
}

/**
 * Get credentials for a specific calendar by email or title
 */
export function getCredentialsForCalendar(
  sessionId: string,
  calendarIdOrTitle: string
): { creds: any; accountInfo: AccountInfo } | null {
  const sessionCreds = sessionCredentialStore.get(sessionId);
  if (!sessionCreds) {
    console.warn(
      `⚠️ [SessionCredStore] No credentials found for session: ${sessionId}`
    );
    return null;
  }

  // Update last used timestamp
  sessionCreds.lastUsed = new Date();

  const { primaryAccount, secondaryAccount } = sessionCreds;

  // Try to match by email first
  if (primaryAccount?.email === calendarIdOrTitle) {
    console.log(
      `🔑 [SessionCredStore] Found PRIMARY account creds for: ${calendarIdOrTitle}`
    );
    return { creds: primaryAccount.creds, accountInfo: primaryAccount };
  }

  if (secondaryAccount?.email === calendarIdOrTitle) {
    console.log(
      `🔑 [SessionCredStore] Found SECONDARY account creds for: ${calendarIdOrTitle}`
    );
    return { creds: secondaryAccount.creds, accountInfo: secondaryAccount };
  }

  // Try to match by title (e.g., "Blue", "Red")
  if (
    primaryAccount?.title?.toLowerCase() === calendarIdOrTitle.toLowerCase()
  ) {
    console.log(
      `🔑 [SessionCredStore] Found PRIMARY account creds by title: ${calendarIdOrTitle} -> ${primaryAccount.email}`
    );
    return { creds: primaryAccount.creds, accountInfo: primaryAccount };
  }

  if (
    secondaryAccount?.title?.toLowerCase() === calendarIdOrTitle.toLowerCase()
  ) {
    console.log(
      `🔑 [SessionCredStore] Found SECONDARY account creds by title: ${calendarIdOrTitle} -> ${secondaryAccount.email}`
    );
    return { creds: secondaryAccount.creds, accountInfo: secondaryAccount };
  }

  console.warn(
    `⚠️ [SessionCredStore] No matching credentials found for: ${calendarIdOrTitle} in session ${sessionId}`
  );
  return null;
}

/**
 * Get all accounts for a session
 */
export function getSessionAccounts(sessionId: string): {
  primaryAccount?: AccountInfo;
  secondaryAccount?: AccountInfo;
} | null {
  const sessionCreds = sessionCredentialStore.get(sessionId);
  if (!sessionCreds) {
    console.warn(
      `⚠️ [SessionCredStore] No credentials found for session: ${sessionId}`
    );
    return null;
  }

  // Update last used timestamp
  sessionCreds.lastUsed = new Date();

  return {
    primaryAccount: sessionCreds.primaryAccount,
    secondaryAccount: sessionCreds.secondaryAccount,
  };
}

/**
 * Get fallback credentials (first available account)
 */
export function getFallbackCredentials(sessionId: string): any | null {
  const sessionCreds = sessionCredentialStore.get(sessionId);
  if (!sessionCreds) {
    return null;
  }

  // Update last used timestamp
  sessionCreds.lastUsed = new Date();

  // Return primary account creds if available, otherwise secondary
  if (sessionCreds.primaryAccount?.creds) {
    console.log(
      `🔑 [SessionCredStore] Using PRIMARY account as fallback for session ${sessionId}`
    );
    return sessionCreds.primaryAccount.creds;
  }

  if (sessionCreds.secondaryAccount?.creds) {
    console.log(
      `🔑 [SessionCredStore] Using SECONDARY account as fallback for session ${sessionId}`
    );
    return sessionCreds.secondaryAccount.creds;
  }

  console.warn(
    `⚠️ [SessionCredStore] No fallback credentials available for session ${sessionId}`
  );
  return null;
}

/**
 * Clear credentials for a session
 */
export function clearSessionCredentials(sessionId: string): void {
  if (sessionCredentialStore.delete(sessionId)) {
    console.log(
      `🗑️ [SessionCredStore] Cleared credentials for session: ${sessionId}`
    );
  }
}

/**
 * Get session store statistics
 */
export function getSessionStoreStats(): {
  totalSessions: number;
  sessionsWithPrimary: number;
  sessionsWithSecondary: number;
  oldestSession?: Date;
  newestSession?: Date;
} {
  const sessions = Array.from(sessionCredentialStore.values());

  return {
    totalSessions: sessions.length,
    sessionsWithPrimary: sessions.filter((s) => s.primaryAccount).length,
    sessionsWithSecondary: sessions.filter((s) => s.secondaryAccount).length,
    oldestSession:
      sessions.length > 0
        ? new Date(Math.min(...sessions.map((s) => s.createdAt.getTime())))
        : undefined,
    newestSession:
      sessions.length > 0
        ? new Date(Math.max(...sessions.map((s) => s.createdAt.getTime())))
        : undefined,
  };
}

/**
 * Debug function to show all credentials for a session
 */
export function debugSessionCredentials(sessionId: string): void {
  const sessionCreds = sessionCredentialStore.get(sessionId);

  console.log('🔍 [SessionCredStore] DEBUG - Session credentials:', sessionId);
  if (!sessionCreds) {
    console.log('❌ No session credentials found');
    return;
  }

  console.log('📊 Session info:', {
    sessionId: sessionCreds.sessionId,
    createdAt: sessionCreds.createdAt,
    lastUsed: sessionCreds.lastUsed,
  });

  if (sessionCreds.primaryAccount) {
    console.log('🔵 PRIMARY Account:', {
      title: sessionCreds.primaryAccount.title,
      email: sessionCreds.primaryAccount.email,
      hasCredentials: !!sessionCreds.primaryAccount.creds,
      tokenStart:
        sessionCreds.primaryAccount.creds?.access_token?.substring(0, 20) +
        '...',
    });
  } else {
    console.log('❌ No PRIMARY account found');
  }

  if (sessionCreds.secondaryAccount) {
    console.log('🔴 SECONDARY Account:', {
      title: sessionCreds.secondaryAccount.title,
      email: sessionCreds.secondaryAccount.email,
      hasCredentials: !!sessionCreds.secondaryAccount.creds,
      tokenStart:
        sessionCreds.secondaryAccount.creds?.access_token?.substring(0, 20) +
        '...',
    });
  } else {
    console.log('❌ No SECONDARY account found');
  }
}
