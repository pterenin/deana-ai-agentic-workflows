import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const callSummaryAccessTool: ChatCompletionTool = {
  type: 'function' as const,
  function: {
    name: 'getRecentCallSummary',
    description:
      "Retrieve recent phone call summary or transcript data when user mentions booking appointments. Use this to check if there are actual booking results from recent calls that differ from the user's current request.",
    parameters: {
      type: 'object',
      properties: {
        userRequest: {
          type: 'string',
          description:
            "The user's appointment request to search for related call data",
        },
      },
      required: ['userRequest'],
    },
  },
};
