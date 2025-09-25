import { Injectable } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentationDbSchema, DocumentationDb } from '@zazos/schemas';

export interface DocumentationResult {
  success: boolean;
  data?: DocumentationDb;
  explanation: string;
  backupPath?: string;
  error?: string;
}

@Injectable()
export class DocumentationToolService {
  private readonly contextPath = path.join(process.cwd(), 'src', 'ai', 'context');
  private readonly backupPath = path.join(process.cwd(), 'data', 'documentation-backups');

  async generateDocumentation(
    userRequest: string,
    currentDocumentation?: DocumentationDb,
    context?: {
      projectPath?: string;
      currentFile?: string;
      area?: string;
    }
  ): Promise<DocumentationResult> {
    
    try {
      // Criar backup se há documentação existente
      let backupPath: string | undefined;
      if (currentDocumentation) {
        backupPath = await this.createBackup(currentDocumentation);
      }

      // Carregar contexto de documentação
      const documentationContext = await this.loadDocumentationContext();
      
      // Construir prompt estruturado
      const systemPrompt = this.buildDocumentationPrompt(documentationContext, currentDocumentation, context);
      
      console.log('📋 [DocumentationTool] Calling LLM for structured documentation:', {
        requestLength: userRequest.length,
        hasCurrentDoc: !!currentDocumentation,
        contextKeys: context ? Object.keys(context) : [],
        backupCreated: !!backupPath
      });

      const { object } = await generateObject({
        model: anthropic('claude-3-5-sonnet-20241022'),
        schema: DocumentationDbSchema,
        system: systemPrompt,
        prompt: `Solicitação do usuário: "${userRequest}"

Por favor, gere ou atualize a documentação seguindo a estrutura definida no schema.`,
        temperature: 0.3, // Baixa temperatura para consistência estrutural
      });

      // Validar resultado
      const validatedDoc = DocumentationDbSchema.parse(object);
      
      console.log('✅ [DocumentationTool] Structured documentation generated:', {
        hasApp: !!validatedDoc.app,
        flowsCount: Object.keys(validatedDoc.flows || {}).length,
        rolesCount: Object.keys(validatedDoc.roles || {}).length,
        activitiesCount: Object.keys(validatedDoc.activities || {}).length,
        storiesCount: Object.keys(validatedDoc.stories || {}).length,
        testCasesCount: Object.keys(validatedDoc.test_cases || {}).length
      });
      
      return {
        success: true,
        data: validatedDoc,
        explanation: `Documentação ${currentDocumentation ? 'atualizada' : 'criada'} com sucesso seguindo o schema estruturado.`,
        backupPath
      };

    } catch (error) {
      console.error('❌ [DocumentationTool] Error generating documentation:', error);
      return {
        success: false,
        explanation: `Erro ao gerar documentação: ${error.message}`,
        error: error.message
      };
    }
  }

  private buildDocumentationPrompt(
    documentationContext: string,
    currentDoc?: DocumentationDb,
    context?: any
  ): string {
    return `${documentationContext}

## Tarefa
Você deve gerar ou atualizar documentação estruturada seguindo EXATAMENTE o schema fornecido.

## Documentação Atual
${currentDoc ? JSON.stringify(currentDoc, null, 2) : 'Nenhuma documentação existente'}

## Contexto do Projeto
- Área: ${context?.area || 'não especificada'}
- Arquivo: ${context?.currentFile || 'não especificado'}
- Caminho: ${context?.projectPath || 'não especificado'}

## Diretrizes Importantes

### Slugs
- SEMPRE usar snake_case: "avaliacao_performance", "processo_compras"
- Começar com letra minúscula
- Sem espaços, acentos ou caracteres especiais

### Estrutura Hierárquica
1. **App** → Visão geral do sistema
2. **Flows** → Processos de negócio principais
3. **FlowStates** → Estados e transições de cada flow
4. **Roles** → Perfis de usuário (human/system)
5. **Activities** → Capacidades do sistema
6. **Stories** → Casos de uso específicos
7. **TestCases** → Como testar cada story

### Relacionamentos
- Stories referenciam Activities (via slug)
- Activities podem referenciar Flows (via slug)
- TestCases referenciam Stories e Roles (via slug)
- FlowStates pertencem a Flows

### Qualidade
- Títulos claros e descritivos
- Descrições concisas mas informativas
- Relacionamentos consistentes entre entidades
- Cobertura completa do processo solicitado

Gere uma documentação completa e bem estruturada que atenda à solicitação do usuário.`;
  }

  private async loadDocumentationContext(): Promise<string> {
    try {
      const contextFilePath = path.join(this.contextPath, 'documentation.md');
      const content = await fs.readFile(contextFilePath, 'utf-8');
      return content.trim();
    } catch (error) {
      console.log('Documentation context file not found, using minimal context');
      return `Você é o eZaz, especialista em produtos internos e documentação estruturada.
Foque em criar documentação clara, bem organizada e que siga as melhores práticas de UX/UI.`;
    }
  }

  private async createBackup(documentation: DocumentationDb): Promise<string> {
    try {
      // Garantir que o diretório de backup existe
      await fs.mkdir(this.backupPath, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `documentation-backup-${timestamp}.json`;
      const backupFilePath = path.join(this.backupPath, backupFileName);
      
      await fs.writeFile(backupFilePath, JSON.stringify(documentation, null, 2), 'utf-8');
      
      console.log(`Documentation backup created: ${backupFilePath}`);
      return backupFilePath;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  async restoreFromBackup(backupPath: string): Promise<DocumentationDb> {
    try {
      const content = await fs.readFile(backupPath, 'utf-8');
      const data = JSON.parse(content);
      return DocumentationDbSchema.parse(data);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }

  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupPath);
      return files
        .filter(file => file.startsWith('documentation-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Mais recentes primeiro
    } catch (error) {
      console.log('No backups directory found');
      return [];
    }
  }
}
