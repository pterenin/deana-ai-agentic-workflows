# Multi-Account Email Workflow Guide

This system provides intelligent email sending with proper account selection and contact lookup across multiple Gmail accounts.

## 🎯 **Workflow Overview**

### **Scenario 1: No Account Specified**

When user says: _"Send email to Vlada, saying hi from new user"_

**1. Account Selection Step**

- AI detects no account specified
- Uses `askWhichEmailAccount` tool
- **Response**: _"I'd be happy to help you send an email to Vlada saying hi from new user. Which email account would you like to use: your Personal account or your Work account? I'll search for Vlada's contact information in the selected account and send the email from there."_

**2. User Selects Account**

- User: _"Use my work account"_
- AI uses `sendEmailWithAccount` with `accountType: "work"`

**3. Contact Lookup & Email Send**

- System searches **Work account contacts** for Vlada
- Finds Vlada's email in work contacts
- Sends email **FROM work email address**
- Uses **work account credentials**

### **Scenario 2: Account Specified**

When user says: _"Send work email to John about the meeting"_

**Direct Workflow**

- AI detects "work" keyword
- Uses `sendEmailWithAccount` with `accountType: "work"` directly
- Searches **Work account contacts** for John
- Sends from **work email address**

## 🛠️ **Technical Implementation**

### **New Tools Added:**

**1. `askWhichEmailAccount`**

```javascript
// When no account specified
askWhichEmailAccount({
  recipientName: 'Vlada',
  emailPurpose: 'saying hi from new user',
});
```

**2. `sendEmailWithAccount`**

```javascript
// After account selection
sendEmailWithAccount({
  accountType: 'work', // or "personal", "primary", "secondary"
  recipientName: 'Vlada',
  subject: 'Hi from new user',
  body: "Hi Vlada, hope you're doing well...",
});
```

**3. `findContactInAccount`**

```javascript
// For explicit contact lookup
findContactInAccount({
  accountType: 'work',
  contactName: 'Vlada',
});
```

### **Account Selection Logic:**

```javascript
// Determines which account to use
const accountTypeLower = args.accountType.toLowerCase();

if (
  accountTypeLower === 'primary' ||
  accountTypeLower === context.accounts.primary.title.toLowerCase()
) {
  // Use primary account (e.g., "Personal")
  targetAccount = context.accounts.primary;
} else if (
  accountTypeLower === 'secondary' ||
  accountTypeLower === context.accounts.secondary.title.toLowerCase()
) {
  // Use secondary account (e.g., "Work")
  targetAccount = context.accounts.secondary;
}
```

## 🎨 **User Experience Examples**

### **Example 1: Basic Email Request**

```
👤 User: "Send email to Vlada, saying hi from new user"

🤖 AI: "I'd be happy to help you send an email to Vlada saying hi from new user.

Which email account would you like to use: your Personal account or your Work account?

I'll search for Vlada's contact information in the selected account and send the email from there."

👤 User: "Work account"

🤖 AI: [Searches Work contacts] → [Finds Vlada] → [Sends from work email]
"Email sent successfully to vlada@company.com from your Work account (pavel.terenin@gmail.com)!"
```

### **Example 2: Explicit Account Mention**

```
👤 User: "Send personal email to Sarah about weekend plans"

🤖 AI: [Directly uses Personal account] → [Searches Personal contacts] → [Sends from personal email]
"Email sent successfully to sarah@gmail.com from your Personal account (tps8327@gmail.com)!"
```

### **Example 3: Contact Not Found**

```
👤 User: "Send work email to NewContact"

🤖 AI: "I couldn't find NewContact in your Work contacts. Could you please provide their email address?"

👤 User: "newcontact@company.com"

🤖 AI: [Uses provided email] → [Sends from work account]
"Email sent successfully to newcontact@company.com from your Work account!"
```

## 🔐 **Security & Privacy**

### **Account Isolation**

- **Personal contacts** → Only searched when using Personal account
- **Work contacts** → Only searched when using Work account
- **Credentials** → Each account uses its own OAuth tokens
- **From address** → Always matches the selected account

### **Contact Lookup Priority**

1. **Selected account contacts** (via Google People API)
2. **Fallback to mock contacts** (for testing)
3. **Ask for email address** (if not found)

## 📋 **AI Decision Rules**

### **When to Ask for Account Selection:**

```javascript
// User message patterns that trigger account selection
- "Send email to [name]" (no account specified)
- "Email [name] about [topic]" (no account specified)
- "Send [name] a message" (no account specified)
```

### **When to Use Account Directly:**

```javascript
// User message patterns that specify account
-'Send work email to [name]' -
  'Send personal email to [name]' -
  'Use my work account to email [name]' -
  'Send from my personal email to [name]';
```

### **Account Type Mapping:**

```javascript
// Flexible account references
"work" / "business" / "office" → Secondary account
"personal" / "private" / "individual" → Primary account
"primary" → Primary account
"secondary" → Secondary account
[Actual account title] → Matching account
```

## 🚀 **Benefits**

1. **Smart Context Awareness**: System knows which contacts belong to which account
2. **Proper Identity Management**: Emails sent from the correct account
3. **User Control**: User chooses which identity to use for communication
4. **Contact Isolation**: Work and personal contacts remain separate
5. **Credential Security**: Each account uses its own authentication
6. **Seamless UX**: Minimal friction while maintaining control

## 🧪 **Testing the Workflow**

**Test Case 1:**

```
Input: "Send email to Vlada, saying hi from new user"
Expected: AI asks which account to use
```

**Test Case 2:**

```
Input: "Send work email to John about the project"
Expected: AI uses work account directly
```

**Test Case 3:**

```
Input: "Use my personal account to email Sarah"
Expected: AI uses personal account directly
```

The system now provides professional-grade email management with proper account separation and intelligent workflow automation! 🎉
