import { Injectable } from '@nestjs/common';
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ConversationService {
  private readonly contextPath = path.join(process.cwd(), 'src', 'ai', 'context');
  
  async generateResponse(
    message: string, 
    type: 'documentation' | 'general',
    context?: {
      projectPath?: string;
      currentFile?: string;
      area?: string;
      currentDocumentation?: any;
    }
  ): Promise<string> {
    
    // Construir prompt baseado no tipo e contexto
    const systemPrompt = await this.buildSystemPrompt(type, context);
    
    try {
      console.log('🤖 [ConversationService] Calling LLM:', {
        type,
        messageLength: message.length,
        contextKeys: context ? Object.keys(context) : [],
        hasCurrentDoc: !!context?.currentDocumentation?.hasDocumentation
      });

      const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: systemPrompt,
        prompt: message,
        temperature: 0.7,
      });

      console.log('✅ [ConversationService] LLM Response received:', {
        responseLength: text.length,
        preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });

      return text;
    } catch (error) {
      console.error('❌ [ConversationService] Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async streamResponse(
    message: string,
    type: 'documentation' | 'general',
    context?: {
      projectPath?: string;
      currentFile?: string;
      area?: string;
      currentDocumentation?: any;
    }
  ): Promise<AsyncIterable<string>> {
    const systemPrompt = await this.buildSystemPrompt(type, context);
    try {
      const result = await streamText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: systemPrompt,
        prompt: message,
        temperature: 0.7,
      });
      return result.textStream;
    } catch (error) {
      console.error('❌ [ConversationService] Error streaming AI response:', error);
      throw new Error('Failed to stream AI response');
    }
  }

  private async buildSystemPrompt(
    type: 'documentation' | 'general',
    context?: {
      projectPath?: string;
      currentFile?: string;
      area?: string;
      currentDocumentation?: any;
    }
  ): Promise<string> {
    
    if (type === 'documentation') {
      let prompt = `Você é um assistente especializado em documentação de projetos e processos de negócio.

Seu foco é ajudar com:
- Análise e melhoria de documentação
- Estruturação de processos de negócio
- Criação de fluxos e workflows
- Definição de roles e responsabilidades
- Especificação de casos de uso e testes

Seja prático, objetivo e focado em UX/UI quando relevante.`;

      // Carregar contexto específico do arquivo se existir
      const contextContent = await this.loadContextFile(type);
      if (contextContent) {
        prompt += `\n\n<CONTEXT>\n${contextContent}\n</CONTEXT>`;
      }

      if (context?.projectPath) {
        prompt += `\n\nContexto do projeto: ${context.projectPath}`;
      }
      
      if (context?.currentFile) {
        prompt += `\nArquivo atual: ${context.currentFile}`;
      }
      
      if (context?.area) {
        prompt += `\nÁrea específica: ${context.area}`;
      }

      // Incluir documentação atual se disponível
      if (context?.currentDocumentation?.hasDocumentation) {
        prompt += `\n\n<CURRENT_DOCUMENTATION>
Documentação atual do projeto:

${context.currentDocumentation.summary}

JSON completo:
\`\`\`json
${JSON.stringify(context.currentDocumentation.documentation, null, 2)}
\`\`\`
</CURRENT_DOCUMENTATION>

Use esta documentação atual como base para suas respostas. Se o usuário pedir para atualizar ou modificar algo, referencie o conteúdo atual.`;
      }

      return prompt;
    }

    // Prompt para conversação geral
    let generalPrompt = `Você é um assistente útil e conhecedor de desenvolvimento de software.

Ajude com questões gerais sobre:
- Programação e desenvolvimento
- Arquitetura de software
- Boas práticas
- Resolução de problemas técnicos

Seja claro, conciso e forneça exemplos práticos quando apropriado.`;

    // Carregar contexto geral se existir
    const contextContent = await this.loadContextFile('general');
    if (contextContent) {
      generalPrompt += `\n\n<CONTEXT>\n${contextContent}\n</CONTEXT>`;
    }

    return generalPrompt;
  }

  /**
   * Carrega o conteúdo de um arquivo de contexto específico
   * @param contextType - Tipo do contexto (ex: 'documentation', 'general')
   * @returns Conteúdo do arquivo ou null se não existir
   */
  private async loadContextFile(contextType: string): Promise<string | null> {
    try {
      const contextFilePath = path.join(this.contextPath, `${contextType}.md`);
      console.log(`Trying to load context file: ${contextFilePath}`);
      const content = await fs.readFile(contextFilePath, 'utf-8');
      console.log(`Context file loaded successfully: ${contextType}.md`);
      return content.trim();
    } catch (error) {
      // Arquivo não existe ou erro de leitura - não é um erro crítico
      console.log(`Context file not found: ${contextType}.md at ${this.contextPath}`);
      return null;
    }
  }
}
