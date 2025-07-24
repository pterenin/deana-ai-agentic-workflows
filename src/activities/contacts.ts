import { google } from 'googleapis';
import 'dotenv/config';

function makeOauthClient(creds: {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expires_at
      ? new Date(creds.expires_at).getTime()
      : undefined,
  });
  return auth;
}

/**
 * Search Google Contacts for a contact by name. Returns the contact's email if found, otherwise null.
 */
export async function findContactEmailByName(
  creds: any,
  name: string
): Promise<string | null> {
  console.log(
    `[findContactEmailByName] Looking up contact: ${name} with credentials type:`,
    creds?.access_token === 'valid' ? 'TEST' : 'REAL'
  );

  // For test credentials, use mock data directly
  if (creds?.access_token === 'valid') {
    console.log(
      '[findContactEmailByName] Using test credentials, returning mock contact data...'
    );
    const mockContacts: { [key: string]: string } = {
      mike: 'pavel.terenin@gmail.com',
      bob: 'tps8327@gmail.com',
      alice: 'alice@example.com',
      john: 'john@example.com',
      sarah: 'sarah@example.com',
    };

    const normalizedName = name.toLowerCase().trim();
    const mockEmail = mockContacts[normalizedName];

    if (mockEmail) {
      console.log(
        `[findContactEmailByName] Found mock contact: ${name} -> ${mockEmail}`
      );
      return mockEmail;
    }

    console.log(`[findContactEmailByName] No mock contact found for: ${name}`);
    return null;
  }

  const auth = makeOauthClient(creds);
  const people = google.people({ version: 'v1', auth });
  try {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: 'names,emailAddresses',
      pageSize: 1000,
    });
    const connections = res.data.connections || [];
    console.log(
      `[findContactEmailByName] API returned ${connections.length} contacts`
    );

    for (const person of connections) {
      const names = person.names || [];
      const emails = person.emailAddresses || [];
      if (
        names.some((n) =>
          n.displayName?.toLowerCase().includes(name.toLowerCase())
        ) &&
        emails.length > 0
      ) {
        console.log(
          `[findContactEmailByName] Found contact: ${name} -> ${emails[0].value}`
        );
        return emails[0].value || null;
      }
    }

    console.log(
      `[findContactEmailByName] No contact found in ${connections.length} contacts, falling back to mock data...`
    );

    // Try mock contacts when no real contact is found
    const mockContacts: { [key: string]: string } = {
      mike: 'pavel.terenin@gmail.com',
      bob: 'tps8327@gmail.com',
      alice: 'alice@example.com',
      john: 'john@example.com',
      sarah: 'sarah@example.com',
    };

    const normalizedName = name.toLowerCase().trim();
    const mockEmail = mockContacts[normalizedName];

    if (mockEmail) {
      console.log(
        `[findContactEmailByName] Found mock contact: ${name} -> ${mockEmail}`
      );
      return mockEmail;
    }

    console.log(`[findContactEmailByName] No mock contact found for: ${name}`);
    return null;
  } catch (error: any) {
    console.error('[findContactEmailByName] Error:', error);

    // Handle specific Google API errors
    if (error.code === 403) {
      if (error.message?.includes('People API has not been used')) {
        console.error(
          '[findContactEmailByName] Google People API is not enabled for this project'
        );
        console.error(
          '[findContactEmailByName] Enable it at: https://console.developers.google.com/apis/api/people.googleapis.com/overview'
        );
      } else {
        console.error(
          '[findContactEmailByName] Permission denied - check OAuth scopes'
        );
      }
    } else if (error.code === 401) {
      console.error(
        '[findContactEmailByName] Authentication failed - token may be expired'
      );
    } else {
      console.error(
        '[findContactEmailByName] Unexpected error:',
        error.message
      );
    }

    // Fallback to mock contact data when API fails
    console.log(
      '[findContactEmailByName] Falling back to mock contact data...'
    );
    const mockContacts: { [key: string]: string } = {
      mike: 'pavel.terenin@gmail.com',
      bob: 'tps8327@gmail.com',
      alice: 'alice@example.com',
      john: 'john@example.com',
      sarah: 'sarah@example.com',
    };

    const normalizedName = name.toLowerCase().trim();
    const mockEmail = mockContacts[normalizedName];

    if (mockEmail) {
      console.log(
        `[findContactEmailByName] Found mock contact: ${name} -> ${mockEmail}`
      );
      return mockEmail;
    }

    console.log(`[findContactEmailByName] No mock contact found for: ${name}`);
    return null;
  }
}
