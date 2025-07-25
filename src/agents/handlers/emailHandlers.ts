import { findContactEmailByName } from '../../activities/contacts';
import { sendEmail } from './sendEmailHandler';
import { SessionContext } from '../types';

export const emailHandlers = {
  askWhichEmailAccount: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    console.log(
      '📧 [askWhichEmailAccount] User wants to email:',
      args.recipientName
    );

    if (!context?.accounts) {
      return {
        message: `Could you please provide ${args.recipientName}'s email address so I can send the email?`,
      };
    }

    const primaryTitle = context.accounts.primary.title;
    const secondaryTitle = context.accounts.secondary?.title;

    let accountOptions = `your ${primaryTitle} account`;
    if (secondaryTitle) {
      accountOptions += ` or your ${secondaryTitle} account`;
    }

    return {
      message: `I'd be happy to help you send an email to ${args.recipientName} ${args.emailPurpose}.

Which email account would you like to use: ${accountOptions}?

I'll search for ${args.recipientName}'s contact information in the selected account and send the email from there.`,
      needsAccountSelection: true,
      recipientName: args.recipientName,
      emailPurpose: args.emailPurpose,
    };
  },

  sendEmailWithAccount: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '📧 [sendEmailWithAccount] Sending email with account:',
        args.accountType
      );

      if (!context?.accounts) {
        return {
          error: true,
          message:
            'No account information available. Please provide account details.',
        };
      }

      // Determine which account to use
      let targetAccount;
      let accountCreds;

      const accountTypeLower = args.accountType.toLowerCase();

      if (
        accountTypeLower === 'primary' ||
        accountTypeLower === context.accounts.primary.title.toLowerCase()
      ) {
        targetAccount = context.accounts.primary;
        accountCreds = context.accounts.primary.creds;
      } else if (
        context.accounts.secondary &&
        (accountTypeLower === 'secondary' ||
          accountTypeLower === context.accounts.secondary.title.toLowerCase())
      ) {
        targetAccount = context.accounts.secondary;
        accountCreds = context.accounts.secondary.creds;
      } else {
        return {
          error: true,
          message: `I couldn't find the ${
            args.accountType
          } account. Available accounts are: ${context.accounts.primary.title}${
            context.accounts.secondary
              ? ` and ${context.accounts.secondary.title}`
              : ''
          }.`,
        };
      }

      console.log(
        '📧 [sendEmailWithAccount] Using account:',
        targetAccount.title,
        targetAccount.email
      );

      let recipientEmail = args.recipientEmail;

      // If no email provided, look up contact in the selected account
      if (!recipientEmail && args.recipientName) {
        onProgress?.({
          type: 'progress',
          content: `Looking up ${args.recipientName} in your ${targetAccount.title} contacts...`,
        });

        recipientEmail = await findContactEmailByName(
          accountCreds,
          args.recipientName
        );

        if (!recipientEmail) {
          return {
            error: true,
            message: `I couldn't find ${args.recipientName} in your ${targetAccount.title} contacts. Could you please provide their email address?`,
          };
        }

        onProgress?.({
          type: 'progress',
          content: `Found ${args.recipientName}: ${recipientEmail}`,
        });
      }

      if (!recipientEmail) {
        return {
          error: true,
          message:
            'I need either a recipient name (to look up in contacts) or a recipient email address.',
        };
      }

      // Send the email using the selected account
      const emailArgs = {
        to: recipientEmail,
        subject: args.subject,
        body: args.body,
        from: targetAccount.email,
      };

      const result = await sendEmail(emailArgs, accountCreds, onProgress);

      return {
        success: true,
        message: `Email sent successfully to ${recipientEmail} from your ${targetAccount.title} account (${targetAccount.email})!`,
        accountUsed: {
          title: targetAccount.title,
          email: targetAccount.email,
        },
        recipient: recipientEmail,
      };
    } catch (error: any) {
      console.error('[emailHandlers] Send email error:', error);
      return {
        error: true,
        message: `Failed to send email: ${error.message}`,
      };
    }
  },

  findContactInAccount: async (
    args: any,
    creds: any,
    onProgress?: (update: any) => void,
    context?: SessionContext
  ) => {
    try {
      console.log(
        '🔍 [findContactInAccount] Looking for contact:',
        args.contactName,
        'in account:',
        args.accountType
      );

      if (!context?.accounts) {
        return {
          error: true,
          message: 'No account information available.',
        };
      }

      // Determine which account to search
      let targetAccount;
      let accountCreds;

      const accountTypeLower = args.accountType.toLowerCase();

      if (
        accountTypeLower === 'primary' ||
        accountTypeLower === context.accounts.primary.title.toLowerCase()
      ) {
        targetAccount = context.accounts.primary;
        accountCreds = context.accounts.primary.creds;
      } else if (
        context.accounts.secondary &&
        (accountTypeLower === 'secondary' ||
          accountTypeLower === context.accounts.secondary.title.toLowerCase())
      ) {
        targetAccount = context.accounts.secondary;
        accountCreds = context.accounts.secondary.creds;
      } else {
        return {
          error: true,
          message: `Account ${args.accountType} not found.`,
        };
      }

      onProgress?.({
        type: 'progress',
        content: `Searching for ${args.contactName} in your ${targetAccount.title} contacts...`,
      });

      const email = await findContactEmailByName(
        accountCreds,
        args.contactName
      );

      if (email) {
        return {
          success: true,
          contactName: args.contactName,
          email: email,
          account: {
            title: targetAccount.title,
            email: targetAccount.email,
          },
          message: `Found ${args.contactName}: ${email} in your ${targetAccount.title} contacts.`,
        };
      } else {
        return {
          success: false,
          message: `Could not find ${args.contactName} in your ${targetAccount.title} contacts.`,
        };
      }
    } catch (error: any) {
      console.error('[emailHandlers] Find contact error:', error);
      return {
        error: true,
        message: `Failed to search contacts: ${error.message}`,
      };
    }
  },
};
