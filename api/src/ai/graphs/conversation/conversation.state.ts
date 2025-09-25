import { Annotation } from '@langchain/langgraph';
import { IntentionAnalysis } from '../../services/intention-analyzer.service';

export type ConversationType = 'documentation' | 'general';

export interface PipelineInputContext {
  projectPath?: string;
  currentFile?: string;
  area?: string;
}

export interface ConversationInput {
  message: string;
  type: ConversationType;
  context?: PipelineInputContext;
}

export interface ConversationOutput {
  aiResponse: string;
  intention?: IntentionAnalysis;
}

export const ConversationState = Annotation.Root({
  inputMessage: Annotation<string>(),
  type: Annotation<ConversationType>(),
  context: Annotation<PipelineInputContext>({
    value: (left: PipelineInputContext, right: PipelineInputContext) => ({ ...left, ...right }),
    default: () => ({} as PipelineInputContext),
  }),
  currentDocContext: Annotation<any>(),
  intention: Annotation<IntentionAnalysis>(),
  aiResponse: Annotation<string>(),
});
