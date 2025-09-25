import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const inputSchema = z.object({
  name: z.string().default('world'),
});

const outputSchema = z.object({
  message: z.string(),
});

const hello = createStep({
  id: 'hello',
  description: 'Simple hello step',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    const who = inputData?.name || 'world';
    return { message: `Hello, ${who}!` };
  },
});

export const helloWorldWorkflow = createWorkflow({ id: 'hello-world-workflow', inputSchema, outputSchema })
  .then(hello);

helloWorldWorkflow.commit();


