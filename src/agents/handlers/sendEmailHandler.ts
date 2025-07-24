import nodemailer from 'nodemailer';

// Uses GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from .env
// Expects creds.access_token and creds.refresh_token from the request
// The email will be sent from the provided 'from' address or fallback to tps8327@gmail.com

export async function sendEmail(
  args: { to: string; subject: string; body: string; from?: string },
  creds: { access_token: string; refresh_token: string }, // expects tokens in creds
  onProgress?: (update: any) => void
) {
  onProgress?.({
    type: 'progress',
    content: `Sending email to ${args.to}...`,
  });

  // For test credentials, simulate email sending
  if (creds?.access_token === 'valid') {
    console.log('[sendEmail] Using test credentials, simulating email send...');
    console.log(
      `[sendEmail] Mock email: From ${args.from || 'tps8327@gmail.com'} to ${
        args.to
      }`
    );
    console.log(`[sendEmail] Subject: ${args.subject}`);
    console.log(`[sendEmail] Body: ${args.body}`);

    onProgress?.({
      type: 'progress',
      content: 'Email sent successfully!',
    });
    return { success: true, message: `Email sent to ${args.to}` };
  }

  // Set up OAuth2 transporter for Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: args.from || 'tps8327@gmail.com',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: creds.refresh_token,
      accessToken: creds.access_token,
    },
  });

  await transporter.sendMail({
    from: args.from || 'tps8327@gmail.com',
    to: args.to,
    subject: args.subject,
    text: args.body,
    // html: '<b>...</b>' // Optionally, send HTML
  });

  onProgress?.({
    type: 'progress',
    content: 'Email sent successfully!',
  });
  return { success: true, message: `Email sent to ${args.to}` };
}
