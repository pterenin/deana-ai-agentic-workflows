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
  const auth = makeOauthClient(creds);
  const people = google.people({ version: 'v1', auth });
  try {
    const res = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: 'names,emailAddresses',
      pageSize: 1000,
    });
    const connections = res.data.connections || [];
    for (const person of connections) {
      const names = person.names || [];
      const emails = person.emailAddresses || [];
      if (
        names.some((n) =>
          n.displayName?.toLowerCase().includes(name.toLowerCase())
        ) &&
        emails.length > 0
      ) {
        return emails[0].value || null;
      }
    }
    return null;
  } catch (error) {
    console.error('[findContactEmailByName] Error:', error);
    return null;
  }
}
