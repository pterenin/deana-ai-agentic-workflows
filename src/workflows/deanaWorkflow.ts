import { proxyActivities } from '@temporalio/workflow';
import type * as act from '../activities/calendar';
import { detectConflicts } from '../utils/calendar-utils';

const { getEvents, createEvent, updateEvent, deleteEvent } = proxyActivities<
  typeof act
>({
  startToCloseTimeout: '2 minutes',
});

// These will be called via the workflow's injected activities
export interface DeanaArgs {
  creds: any; // Google OAuth tokens
  userMessage: string;
}

export async function deanaWorkflow(args: DeanaArgs): Promise<any> {
  console.log('🚀 [deanaWorkflow] Starting workflow with args:', {
    userMessage: args.userMessage,
    hasCreds: !!args.creds,
    credsKeys: args.creds ? args.creds : 'null',
  });

  console.log('!CREDS!', args.creds ? JSON.stringify(args.creds) : 'null');

  // Use LLM agent activities to decide what the user wants (safe for workflows)
  const llm = proxyActivities<{
    llmDecideAction(
      userMessage: string
    ): Promise<{ action: string; isoStart?: string; isoEnd?: string }>;
    llmSummarizeCalendarEvents(events: any, conflicts?: any): Promise<string>;
    llmGenerateConversationalResponse(userMessage: string): Promise<string>;
  }>({
    startToCloseTimeout: '2 minutes',
    taskQueue: 'deana',
  });

  // 1. Decide what action to take
  console.log('🤖 [deanaWorkflow] Calling LLM to decide action...');
  const llmResult = await llm.llmDecideAction(args.userMessage);
  console.log('🎯 [deanaWorkflow] LLM decided:', llmResult);

  // If llmResult.isoStart or isoEnd are undefined, default to today
  let isoStart: string, isoEnd: string;
  if (llmResult.isoStart && llmResult.isoEnd) {
    isoStart = llmResult.isoStart;
    isoEnd = llmResult.isoEnd;
  } else {
    // No time indicated in user message, default to today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    isoStart = todayStart.toISOString();
    isoEnd = todayEnd.toISOString();
  }

  let result: any = {};

  if (llmResult.action === 'get_events') {
    console.log('📅 [deanaWorkflow] Processing calendar request...');

    // Example: Get events for today for both calendars
    console.log('📅 [deanaWorkflow] Date range:', { isoStart, isoEnd });

    // console.log('📅 [deanaWorkflow] Fetching working calendar events...');
    // const workingEvents = await getEvents(
    //   args.creds,
    //   'pavel.terenin@gmail.com',
    //   isoStart,
    //   isoEnd
    // );
    // console.log(
    //   '📅 [deanaWorkflow] Working events count:',
    //   workingEvents.length
    // );

    console.log('📅 [deanaWorkflow] Fetching personal calendar events...');
    const personalEvents = await getEvents(
      args.creds,
      'tps8327@gmail.com',
      isoStart,
      isoEnd
    );
    console.log(
      '📅 [deanaWorkflow] Personal events count:',
      personalEvents.length
    );

    // Call conflict detection as a pure function
    console.log('🔍 [deanaWorkflow] Detecting conflicts...');
    // const conflicts = detectConflicts(workingEvents, personalEvents);
    // console.log('🔍 [deanaWorkflow] Conflicts found:', conflicts.length);

    console.log('🤖 [deanaWorkflow] Generating summary...');
    const summary = await llm.llmSummarizeCalendarEvents({
      personal: personalEvents,
    });
    console.log(
      '📝 [deanaWorkflow] Summary generated, length:',
      summary.length
    );

    result = {
      personal: personalEvents,
      summary,
    };
    console.log('✅ [deanaWorkflow] Calendar result prepared');
  } else {
    console.log('💬 [deanaWorkflow] Processing conversational request...');
    // Generate a conversational response for unrecognized actions or general conversation
    const response = await llm.llmGenerateConversationalResponse(
      args.userMessage
    );
    console.log(
      '💬 [deanaWorkflow] Generated response, length:',
      response.length
    );
    result = { message: response, type: 'conversational' };
  }

  console.log('🏁 [deanaWorkflow] Workflow completed, returning result');
  return result;
}
