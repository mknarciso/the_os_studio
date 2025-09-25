import { Injectable, Logger } from '@nestjs/common';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { StreamingMessageParser } from '../message-parser';
import { ActionRunnerService } from '../action-runner.service';
import { ZazArtifact, ZazAction, ParserCallbacks } from '../types/artifact';

export interface StreamingLLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamingResult {
  text: string;
  artifacts: ZazArtifact[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class LLMCallService {
  private readonly logger = new Logger(LLMCallService.name);

  constructor(
    private actionRunner: ActionRunnerService
  ) {}

  /**
   * Executa chamada LLM com streaming e parsing de artifacts/actions
   */
  async streamCall(
    messages: Array<{ role: string; content: string }>,
    options: StreamingLLMOptions = {}
  ): Promise<StreamingResult> {
    const artifacts: ZazArtifact[] = [];
    let fullText = '';

    // Configurar callbacks do parser
    const callbacks: ParserCallbacks = {
      onArtifactOpen: (artifact) => {
        this.logger.log(`Artifact opened: ${artifact.id} - ${artifact.title}`);
        artifacts.push(artifact as ZazArtifact);
      },
      
      onArtifactClose: (artifact) => {
        this.logger.log(`Artifact closed: ${artifact.id}`);
        // Atualizar artifact na lista
        const index = artifacts.findIndex(a => a.id === artifact.id);
        if (index !== -1) {
          artifacts[index] = { ...artifacts[index], ...artifact };
        }
      },

      onActionOpen: (action) => {
        this.logger.log(`Action opened: ${action.id} - ${action.type}`);
      },

      onActionStream: (action, chunk) => {
        // Log opcional para debug
        // this.logger.debug(`Action streaming: ${action.id} - chunk length: ${chunk.length}`);
      },

      onActionClose: async (action) => {
        this.logger.log(`Action closed: ${action.id} - ${action.type}`);
        
        // Encontrar o artifact pai
        const parentArtifact = artifacts.find(a => 
          a.actions?.some(act => act.id === action.id)
        );

        if (parentArtifact && action.id) {
          try {
            // Executar a ação
            const result = await this.actionRunner.executeAction(
              action as ZazAction, 
              parentArtifact
            );
            
            this.logger.log(`Action executed successfully: ${action.id}`, result);
          } catch (error) {
            this.logger.error(`Action execution failed: ${action.id}`, error);
          }
        }
      }
    };

    // Criar parser
    const parser = new StreamingMessageParser(callbacks);

    try {
      // Configurar modelo
      const model = anthropic(
        options.model || 
        process.env.AI_MODEL || 
        'claude-3-5-sonnet-20241022'
      );

      // Executar streaming
      const result = await streamText({
        model,
        messages: messages as any,
        temperature: options.temperature || 0.7,
        ...(options.maxTokens && { maxTokens: options.maxTokens }),
      });

      // Processar stream
      let chunkIndex = 0;
      for await (const chunk of result.textStream) {
        chunkIndex++;
        console.log(`🔥 [LLM Stream #${chunkIndex}] RAW CHUNK:`, JSON.stringify(chunk));
        console.log(`🔥 [LLM Stream #${chunkIndex}] CHUNK LENGTH:`, chunk.length);
        console.log(`🔥 [LLM Stream #${chunkIndex}] CHUNK CONTENT:`, chunk);
        console.log(`📝 [LLM Stream #${chunkIndex}] FULL TEXT SO FAR:`, fullText + chunk);
        console.log('─'.repeat(80));
        
        fullText += chunk;
        parser.processChunk(chunk);
      }

      // Finalizar parsing
      parser.finalize();

      // Obter usage se disponível
      const usage = await result.usage;

      return {
        text: fullText,
        artifacts,
        usage: usage ? {
          promptTokens: (usage as any).promptTokens || 0,
          completionTokens: (usage as any).completionTokens || 0,
          totalTokens: (usage as any).totalTokens || 0
        } : undefined
      };

    } catch (error) {
      this.logger.error('LLM streaming failed:', error);
      throw error;
    }
  }

  /**
   * Gera prompt do sistema com instruções para ZazActions
   */
  generateSystemPrompt(context?: any): string {
    return `You are E-Zaz, an AI assistant specialized in helping with Zazos internal products documentation and development.

You can perform actions using ZazArtifacts and ZazActions. When you need to edit or create documentation, use the following format:

<zazArtifact id="unique-id" title="Artifact Title" type="documentation">
<zazAction type="editDocumentation" context='{"projectPath": "quero/apps/quero/flow", "area": "documentation"}'>
{
  "flows": {},
  "flow_states": {},
  "vendors": {},
  "roles": {},
  "activities": {},
  "stories": {},
  "test_cases": {},
  "app": {
    "name": "App Name",
    "description": "App description",
    "slug": "app-slug"
  },
  "metadata": {
    "version": "1.0.0"
  }
}
</zazAction>
</zazArtifact>

Available action types:
- editDocumentation: Edit existing documentation
- createDocumentation: Create new documentation

The content inside zazAction must be valid JSON representing the complete DocumentationDb structure.

Context information:
${context ? JSON.stringify(context, null, 2) : 'No specific context provided'}

Always provide helpful explanations along with your actions.`;
  }
}
