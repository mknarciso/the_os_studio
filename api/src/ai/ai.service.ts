import { Injectable, OnModuleInit } from '@nestjs/common';
import { ThreadService } from './services/thread.service';
import { MessageService } from './services/message.service';
import { ConversationGraph } from './graphs/conversation/conversation.graph';
import { mastra } from '../mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { 
  Thread, 
  Message, 
  CreateThreadInput, 
  SendMessageInput 
} from './types/ai.schemas';

@Injectable()
export class AiService implements OnModuleInit {
  
  constructor(
    private threadService: ThreadService,
    private messageService: MessageService,
    private conversationGraph: ConversationGraph,
  ) {}

  async onModuleInit() {
    // Inicializar serviços de persistência
    await this.threadService.init();
    await this.messageService.init();
  }

  // Thread Management
  async createThread(input: CreateThreadInput): Promise<Thread> {
    return this.threadService.createThread(input);
  }

  async getThread(threadId: string): Promise<{ thread: Thread; messages: Message[] }> {
    const thread = await this.threadService.getThread(threadId);
    const messages = await this.messageService.getMessagesByIds(thread.messageIds);
    
    return { thread, messages };
  }

  async getAllThreads(): Promise<Thread[]> {
    return this.threadService.getAllThreads();
  }

  async deleteThread(threadId: string): Promise<void> {
    return this.threadService.deleteThread(threadId);
  }

  // Message Management & AI Conversation
  async sendMessage(threadId: string, input: SendMessageInput): Promise<{
    userMessage: Message;
    assistantMessage: Message;
    intention?: any;
  }> {
    console.log('📨 [AiService] New message received:', {
      threadId,
      type: input.type,
      messageLength: input.message.length,
      contextKeys: input.context ? Object.keys(input.context) : []
    });

    // Verificar se thread existe
    await this.threadService.getThread(threadId);
    console.log('🧵 [AiService] Thread verified', { threadId });

    // 1. Criar mensagem do usuário
    const userMessage = await this.messageService.createMessage(threadId, input, 'user');
    
    // 2. Adicionar à thread
    await this.threadService.addMessageToThread(threadId, userMessage.messageId);
    console.log('💾 [AiService] User message persisted', { userMessageId: userMessage.messageId });

    try {
      // Responder usando Mastra staffDeveloperAgent
      const agent = mastra.getAgent('staffDeveloperAgent');
      if (!agent) throw new Error('staffDeveloperAgent not found');
      console.log('🤖 [AiService] Agent acquired, calling generate');
      const runtimeContext = new RuntimeContext<{ namespace?: string; app?: string }>();
      try {
        const ctx = input.context || {} as any;
        let namespace = ctx.namespace as string | undefined;
        let app = ctx.app as string | undefined;
        const projectPath = ctx.projectPath as string | undefined;
        if ((!namespace || !app) && projectPath) {
          const raw = String(projectPath).trim();
          const parts = raw.split('/').filter(Boolean);
          const appsIdx = parts.indexOf('apps');
          if (appsIdx >= 0 && parts.length >= appsIdx + 3) {
            namespace = namespace || parts[appsIdx + 1];
            app = app || parts[appsIdx + 2];
          } else if (parts.length >= 2) {
            namespace = namespace || parts[0];
            app = app || parts[1];
          }
        }
        if (namespace) runtimeContext.set('namespace', namespace);
        if (app) runtimeContext.set('app', app);
      } catch {}
      const response = await (agent as any).generate([
        { role: 'user', content: input.message }
      ], { runtimeContext });
      const aiResponse: string = String(response.text ?? response.output ?? '');
      console.log('🧾 [AiService] Agent response received', {
        textLen: aiResponse.length,
        hasOutput: Boolean(response.output),
      });

      // Criar mensagem do assistente
      const assistantMessage = await this.messageService.createAssistantMessage(
        threadId,
        aiResponse,
        input.type
      );

      // Adicionar à thread
      await this.threadService.addMessageToThread(threadId, assistantMessage.messageId);
      console.log('💾 [AiService] Assistant message persisted', { assistantMessageId: assistantMessage.messageId });

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      console.error('❌ [AiService] Error in sendMessage:', error);
      const message = (error as any)?.message || String(error);
      console.error('❌ [AiService] Error details:', { message, stack: (error as any)?.stack });
      
      // Fallback em caso de erro
      const errorResponse = `❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.

Detalhes técnicos: ${error.message}`;

      const assistantMessage = await this.messageService.createAssistantMessage(
        threadId,
        errorResponse,
        input.type
      );

      await this.threadService.addMessageToThread(threadId, assistantMessage.messageId);
      console.log('💾 [AiService] Error fallback message persisted', { assistantMessageId: assistantMessage.messageId });

      return {
        userMessage,
        assistantMessage
      };
    }
  }

  async getThreadMessages(threadId: string): Promise<Message[]> {
    return this.messageService.getThreadMessages(threadId);
  }
}
