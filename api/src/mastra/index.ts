import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import * as path from 'node:path';
import { brandDesignerWorkflow } from './branding/workflows/brand-designer-workflow';
import { brandDesignerAgent } from './branding/agents/brand-designer-agent';
import { staffDeveloperAgent } from './developer/staff-developer-agent';
import { PinoLogger } from '@mastra/loggers';
// Tools are referenced directly in workflows; no need to register at root config in this Mastra version
import { helloWorldWorkflow } from './hello-world/workflows/hello-world-workflow';

const storageUrl = process.env.MASTRA_STORAGE_URL || 'file:./data/mastra.db';
if (!process.env.MASTRA_STORAGE_URL) {
  console.warn('[Mastra] MASTRA_STORAGE_URL not set. Falling back to file:./data/mastra.db');
}

// Debug: Log environment for Mastra init
console.log('=== Mastra Init Debug ===');
console.log('globalThis.___MASTRA_TELEMETRY___:', (globalThis as any).___MASTRA_TELEMETRY___);
console.log('MASTRA_STORAGE_URL:', process.env.MASTRA_STORAGE_URL);
console.log('MASTRA_DEFAULT_STORAGE_URL:', process.env.MASTRA_DEFAULT_STORAGE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('========================');

const storage = new LibSQLStore({
  url: storageUrl,
});

export const mastra = new Mastra({
  workflows: {
    brandDesignerWorkflow,
    helloWorldWorkflow,
  },
  agents: {
    brandDesignerAgent,
    staffDeveloperAgent,
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  storage,
  observability: {
    default: { enabled: true },
  },
  server: {
    port: 4111,
  },
});




