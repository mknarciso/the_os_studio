import { EventEmitter } from 'node:events';

export type ToolUsedEvent = {
  id: string;
  args?: Record<string, unknown>;
};

class ToolBus extends EventEmitter {}

export const toolBus = new ToolBus();


