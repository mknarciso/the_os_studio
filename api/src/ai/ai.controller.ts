import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Param, 
  Body, 
  BadRequestException,
  Header,
  Res
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'node:path';
import { toolBus } from '../utils/event-bus';
import { AiService } from './ai.service';
import { ConversationGraph } from './graphs/conversation/conversation.graph';
import { UiGraph } from './graphs/ui/ui.graph';
import { z } from 'zod';
import { mastra } from '../mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { 
  CreateThreadInputSchema, 
  SendMessageInputSchema,
  CreateThreadInput,
  SendMessageInput 
} from './types/ai.schemas';

@Controller('ai')
export class AiController {
  
  constructor(
    private readonly aiService: AiService,
    private readonly conversationGraph: ConversationGraph,
    private readonly uiGraph: UiGraph,
  ) {}

  @Post('threads')
  async createThread(@Body() body: unknown) {
    try {
      const data = CreateThreadInputSchema.parse(body);
      return this.aiService.createThread(data);
    } catch (error) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: error.errors || error.message
      });
    }
  }

  @Post('threads/:threadId/messages/stream')
  async sendMessageStream(
    @Param('threadId') threadId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    try {
      console.log('📥 [AiController.stream] Incoming request', {
        threadId,
        bodyPreview: (() => {
          try { return JSON.stringify(body).slice(0, 500); } catch { return String(body).slice(0, 200); }
        })(),
      });
      const data = SendMessageInputSchema.parse(body);
      console.log('✅ [AiController.stream] Input validated', {
        type: data.type,
        messageLen: data.message?.length,
        contextKeys: data.context ? Object.keys(data.context) : [],
      });
      // Ensure thread exists
      await this.aiService.getThread(threadId);
      console.log('🧵 [AiController.stream] Thread ensured', { threadId });

      // Create and link user message
      const userMessage = await this.aiService['messageService'].createMessage(threadId, data, 'user');
      await this.aiService['threadService'].addMessageToThread(threadId, userMessage.messageId);
      console.log('💾 [AiController.stream] User message persisted', { userMessageId: userMessage.messageId });

      // Setup SSE headers BEFORE any write
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      console.log('🔌 [AiController.stream] SSE headers set', { headersSent: (res as any).headersSent === true });

      // Notify client of persisted user message id
      try {
        res.write(`data: ${JSON.stringify({ ack: { userMessageId: userMessage.messageId } })}\n\n`);
        console.log('📨 [AiController.stream] Sent ACK to client');
      } catch {}

      // Build history from existing messages for better context
      const existing = await this.aiService.getThread(threadId);
      const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
      for (const msg of existing.messages) {
        if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
          history.push({ role: msg.role as any, content: msg.content });
        }
      }
      // Inject a compact context prelude so tools can read projectPath/namespace/app
      const contextPrelude = {
        role: 'system' as const,
        content: `CTX { "projectPath": ${JSON.stringify(data.context?.projectPath || '')}, "customer": ${JSON.stringify(data.context?.customer || '')}, "namespace": ${JSON.stringify(data.context?.namespace || '')}, "app": ${JSON.stringify(data.context?.app || '')} }`
      };
      history.unshift(contextPrelude as any);
      history.push({ role: 'user', content: data.message });
      console.log('🧠 [AiController.stream] Built history', { messages: history.length });

      // Prepare runtime context for tools (customer/namespace/app)
      const runtimeContext = new RuntimeContext<{ customer?: string; namespace?: string; app?: string }>();
      try {
        const ctx = data.context || {} as any;
        let customer = ctx.customer as string | undefined;
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
        if (customer) runtimeContext.set('customer', customer);
        if (namespace) runtimeContext.set('namespace', namespace);
        if (app) runtimeContext.set('app', app);
      } catch {}

      // Editable list injection foi movido para instructions dinâmicas do agente

      // Stream using Mastra staff developer agent (vNext)
      const agent = mastra.getAgent('staffDeveloperAgent');
      if (!agent) throw new Error('staffDeveloperAgent not found');
      console.log('🤖 [AiController.stream] Agent acquired');

      const stream = await (agent as any).streamVNext(history, { runtimeContext });
      console.log('🌊 [AiController.stream] Agent streamVNext started');

      let fullText = '';
      for await (const chunk of (stream as any).fullStream) {
        try {
          if (chunk?.type === 'text-delta' && chunk?.payload?.text) {
            fullText += String(chunk.payload.text);
          }
          // Relay raw chunk as-is for the frontend to interpret (tool-call, tool-result, text-delta, finish, error, ...)
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        } catch (e) {
          // best-effort streaming; continue
        }
      }
      console.log('✅ [AiController.stream] Stream completed', { totalLen: fullText.length });

      // Persist assistant message at the end
      const assistantMessage = await this.aiService['messageService'].createAssistantMessage(
        threadId,
        fullText,
        data.type
      );
      await this.aiService['threadService'].addMessageToThread(threadId, assistantMessage.messageId);
      console.log('💾 [AiController.stream] Assistant message persisted', { assistantMessageId: assistantMessage.messageId });

      // Send final done marker for current UI compatibility
      res.write(`data: ${JSON.stringify({ done: true, assistantMessageId: assistantMessage.messageId })}\n\n`);
      res.end();
      console.log('🏁 [AiController.stream] Response ended');
    } catch (error) {
      const message = (error as any)?.message || 'Stream error';
      try { res.write(`data: ${JSON.stringify({ error: message })}\n\n`); } catch {}
      res.end();
      console.error('❌ [AiController.stream] Error', { message, stack: (error as any)?.stack });
    }
  }

  @Get('threads')
  async getAllThreads() {
    return this.aiService.getAllThreads();
  }

  @Get('threads/:threadId')
  async getThread(@Param('threadId') threadId: string) {
    return this.aiService.getThread(threadId);
  }

  @Delete('threads/:threadId')
  async deleteThread(@Param('threadId') threadId: string) {
    await this.aiService.deleteThread(threadId);
    return { success: true };
  }

  @Post('threads/:threadId/messages')
  async sendMessage(
    @Param('threadId') threadId: string,
    @Body() body: unknown
  ) {
    try {
      console.log('📥 [AiController] Received message request:', {
        threadId,
        body: JSON.stringify(body, null, 2)
      });
      
      const data = SendMessageInputSchema.parse(body);
      
      console.log('✅ [AiController] Validation passed:', {
        message: data.message.substring(0, 100) + '...',
        type: data.type,
        context: data.context
      });
      console.log('🤖 [AiController] Getting agent...');
      const agentExists = !!mastra.getAgent('staffDeveloperAgent');
      console.log('🤖 [AiController] Agent exists:', agentExists);
      
      return this.aiService.sendMessage(threadId, data);
    } catch (error) {
      console.error('❌ [AiController] Validation error:', {
        threadId,
        body: JSON.stringify(body, null, 2),
        error: (error as any).errors || (error as any).message,
        stack: (error as any).stack
      });
      
      throw new BadRequestException({
        message: 'Validation failed',
        errors: (error as any).errors || (error as any).message
      });
    }
  }

  @Get('threads/:threadId/messages')
  async getThreadMessages(@Param('threadId') threadId: string) {
    return this.aiService.getThreadMessages(threadId);
  }

  @Post('test/validate-message')
  async testValidateMessage(@Body() body: unknown) {
    try {
      console.log('🧪 [AiController] Test validation request:', {
        body: JSON.stringify(body, null, 2)
      });
      
      const data = SendMessageInputSchema.parse(body);
      
      console.log('✅ [AiController] Test validation passed:', data);
      
      return { 
        success: true, 
        message: 'Validation passed',
        parsedData: data 
      };
    } catch (error) {
      console.error('❌ [AiController] Test validation error:', {
        body: JSON.stringify(body, null, 2),
        error: (error as any).errors || (error as any).message
      });
      
      return { 
        success: false, 
        message: 'Validation failed',
        errors: (error as any).errors || (error as any).message,
        receivedBody: body
      };
    }
  }

  @Get('graph')
  async getGraph() {
    return this.conversationGraph.getGraphInfo();
  }

  @Get('graph.mermaid')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async getGraphMermaid() {
    const mermaid = await this.conversationGraph.getMermaid();
    return mermaid;
  }

  @Get('graph.html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getGraphHtml() {
    const mermaid = await this.conversationGraph.getMermaid();
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LangGraph - AI Pipeline</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 16px; background: #0b1021; color: #e2e8f0; }
      .container { max-width: 1200px; margin: 0 auto; }
      .card { background: #0f172a; padding: 16px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
      .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .title { font-size: 18px; font-weight: 600; }
      .hint { opacity: 0.8; font-size: 12px; }
      .mermaid { background: transparent; }
      .actions { display: flex; gap: 8px; }
      .btn { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
      .btn:hover { background: #0b1220; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
      mermaid.initialize({ startOnLoad: true, theme: 'dark' });
      function copyMermaid() {
        const code = document.getElementById('mermaid-code').textContent;
        navigator.clipboard.writeText(code);
        const btn = document.getElementById('copy-btn');
        const prev = btn.textContent; btn.textContent = 'Copiado!';
        setTimeout(() => btn.textContent = prev, 1200);
      }
    </script>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <div class="header">
          <div class="title">AI Pipeline (LangGraph)</div>
          <div class="actions">
            <button id="copy-btn" class="btn" onclick="copyMermaid()">Copiar Mermaid</button>
            <a class="btn" href="/ai/graph">JSON</a>
            <a class="btn" href="/ai/graph.mermaid">Mermaid</a>
          </div>
        </div>
        <div class="hint">Nó a nó do pipeline atual utilizado pelo assistente.</div>
        <div id="mermaid-code" class="mermaid">${mermaid.replace(/`/g, '\u0060')}</div>
      </div>
    </div>
  </body>
</html>`;
    return html;
  }

  @Post('ui/run')
  async runUi(@Body() body: unknown) {
    const UiRunInputSchema = z.object({
      action: z.enum(['init_db', 'update_from_file', 'list_all', 'update_all']),
      customer: z.string().min(1),
      namespace: z.string().min(1),
      app: z.string().min(1),
      filePath: z.string().optional(),
    });
    try {
      const input = UiRunInputSchema.parse(body);
      const result = await this.uiGraph.run(input as any);
      return { success: true, result };
    } catch (error) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: (error as any)?.errors || (error as any)?.message || String(error),
      });
    }
  }
}
