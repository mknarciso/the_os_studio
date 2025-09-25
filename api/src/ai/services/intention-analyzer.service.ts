import { Injectable } from '@nestjs/common';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export interface IntentionAnalysis {
  taskType: 'simple' | 'complex';
  category: 'conversation' | 'documentation' | 'analysis';
  confidence: number;
  reasoning: string;
  suggestedAction: 'direct_response' | 'documentation_tool' | 'multi_step_process';
}

@Injectable()
export class IntentionAnalyzerService {
  
  async analyzeIntention(
    message: string,
    type: 'documentation' | 'general',
    context?: {
      projectPath?: string;
      currentFile?: string;
      area?: string;
    }
  ): Promise<IntentionAnalysis> {
    
    const analysisPrompt = this.buildAnalysisPrompt(message, type, context);
    
    try {
      console.log('🧠 [IntentionAnalyzer] Calling LLM for intention analysis:', {
        type,
        messageLength: message.length,
        contextKeys: context ? Object.keys(context) : []
      });

      const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20241022'),
        system: analysisPrompt,
        prompt: `Analise esta mensagem do usuário: "${message}"`,
        temperature: 0.1, // Baixa temperatura para análise consistente
      });

      const result = this.parseAnalysisResult(text);
      
      console.log('✅ [IntentionAnalyzer] Analysis completed:', {
        taskType: result.taskType,
        category: result.category,
        suggestedAction: result.suggestedAction,
        confidence: result.confidence,
        reasoning: result.reasoning.substring(0, 100) + (result.reasoning.length > 100 ? '...' : '')
      });

      return result;
    } catch (error) {
      console.error('❌ [IntentionAnalyzer] Error analyzing intention:', error);
      // Fallback para conversação simples em caso de erro
      const fallback = {
        taskType: 'simple' as const,
        category: 'conversation' as const,
        confidence: 0.5,
        reasoning: 'Erro na análise, usando fallback para conversação simples',
        suggestedAction: 'direct_response' as const
      };
      
      console.log('🔄 [IntentionAnalyzer] Using fallback result:', fallback);
      return fallback;
    }
  }

  private buildAnalysisPrompt(
    message: string,
    type: 'documentation' | 'general',
    context?: any
  ): string {
    return `Você é um analisador de intenções especializado em classificar tarefas de usuários.

Sua função é analisar mensagens e classificar em:

## Tipos de Tarefa:
- **simple**: Perguntas diretas, esclarecimentos, conversação
- **complex**: Criação/edição de documentação, análise estruturada, múltiplas etapas

## Categorias:
- **conversation**: Perguntas, dúvidas, explicações
- **documentation**: Criar, editar, estruturar documentação
- **analysis**: Análise de processos, fluxos, estruturas

## Ações Sugeridas:
- **direct_response**: Resposta direta via generateText
- **documentation_tool**: Usar generateObject para estruturar documentação
- **multi_step_process**: Processo em múltiplas etapas (futuro)

## REGRAS IMPORTANTES:
1. Se a mensagem contém verbos de AÇÃO sobre documentação (editar, atualizar, criar, modificar, alterar), use DOCUMENTATION + DOCUMENTATION_TOOL
2. Se o contexto é type="documentation" E a mensagem pede alterações, use DOCUMENTATION + DOCUMENTATION_TOOL
3. Se a mensagem é apenas pergunta/dúvida, use CONVERSATION + DIRECT_RESPONSE
4. Palavras-chave para DOCUMENTATION: "edite", "atualize", "crie", "modifique", "altere", "estruture", "defina"

## Contexto Atual:
- Tipo: ${type}
- Área: ${context?.area || 'não especificada'}
- Arquivo: ${context?.currentFile || 'não especificado'}

## Exemplos de Classificação:

### SIMPLE + CONVERSATION + DIRECT_RESPONSE:
- "O que é um PRD?"
- "Como funciona o fluxo de aprovação?"
- "Explique a diferença entre Activities e Stories"
- "Qual app estamos editando?"
- "Me fale mais sobre seu processo"

### COMPLEX + DOCUMENTATION + DOCUMENTATION_TOOL:
- "Crie um PRD para sistema de pagamentos"
- "Estruture a documentação do processo de compras"
- "Defina os roles e activities para avaliação de performance"
- "Documente o fluxo de aprovação com estados e transições"
- "Edite o título para Flow v.25"
- "pode atualizar tudo de uma vez"
- "você consegue alterar o arquivo?"
- "atualize a documentação"
- "crie a estrutura completa"
- "modifique os roles existentes"

### SIMPLE + ANALYSIS + DIRECT_RESPONSE:
- "Analise este processo atual"
- "Quais são os problemas nesta estrutura?"
- "quais roles já existem?"
- "veja quais roles já foram definidos"

Responda APENAS em formato JSON:
{
  "taskType": "simple|complex",
  "category": "conversation|documentation|analysis", 
  "confidence": 0.0-1.0,
  "reasoning": "explicação da classificação",
  "suggestedAction": "direct_response|documentation_tool|multi_step_process"
}`;
  }

  private parseAnalysisResult(text: string): IntentionAnalysis {
    try {
      // Extrair JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validar estrutura
      return {
        taskType: parsed.taskType === 'complex' ? 'complex' : 'simple',
        category: ['conversation', 'documentation', 'analysis'].includes(parsed.category) 
          ? parsed.category : 'conversation',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || 'Análise automática',
        suggestedAction: ['direct_response', 'documentation_tool', 'multi_step_process'].includes(parsed.suggestedAction)
          ? parsed.suggestedAction : 'direct_response'
      };
    } catch (error) {
      console.error('Error parsing analysis result:', error);
      // Fallback seguro
      return {
        taskType: 'simple',
        category: 'conversation',
        confidence: 0.3,
        reasoning: 'Erro no parsing, usando fallback',
        suggestedAction: 'direct_response'
      };
    }
  }
}
