import { Injectable, Logger } from '@nestjs/common';
import { DocumentationToolService } from '../../../services/documentation-tool.service';
import { DocumentationLoaderService } from '../../../services/documentation-loader.service';
import { ConversationService } from '../../../services/conversation.service';
import { JsonPatchTool } from '../../../tools/json-patch.tool';
import { ConversationState } from '../conversation.state';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Operation } from 'fast-json-patch';

@Injectable()
export class DocumentationToolNode {
  private readonly logger = new Logger(DocumentationToolNode.name);

  constructor(
    private readonly documentationTool: DocumentationToolService,
    private readonly documentationLoader: DocumentationLoaderService,
    private readonly conversationService: ConversationService,
    private readonly jsonPatch: JsonPatchTool,
  ) {}

  async execute(state: typeof ConversationState.State) {
    this.logger.log('Executing documentation tool node');
    
    const docResult = await this.documentationTool.generateDocumentation(
      state.inputMessage,
      state.currentDocContext?.documentation,
      state.context
    );

    if (docResult.success) {
      let savedPathInfo = '';
      try {
        // Determine target file path
        let targetPath: string | null = null;
        if ((state as any).currentDocContext?.documentationPath) {
          targetPath = (state as any).currentDocContext.documentationPath as string;
        } else {
          const workspaceRoot = path.join(process.cwd(), '..', '..');
          const rawProjectPath = (state.context?.projectPath || '').replace(/^\/+/, '');
          targetPath = path.join(workspaceRoot, rawProjectPath, 'documentation.json');
        }

        if (targetPath) {
          // Use JSON Patch for non-destructive updates
          await this.saveDocumentationWithPatches(targetPath, docResult.data as any);
          savedPathInfo = `\n\n💾 Salvo (merge) em: \`${targetPath}\``;
          this.logger.log(`Documentation saved to: ${targetPath}`);
        }
      } catch (saveErr: any) {
        savedPathInfo = `\n\n⚠️ Não foi possível salvar automaticamente: ${saveErr?.message || saveErr}`;
        this.logger.error('Failed to save documentation:', saveErr);
      }

      const aiResponse = `✅ **Documentação estruturada criada com sucesso!**\n\n${docResult.explanation}\n\n## Estrutura Gerada:\n${this.formatDocumentationSummary(docResult.data)}\n\nA documentação foi criada seguindo o schema estruturado do eZaz, com todos os relacionamentos e validações adequadas.${docResult.backupPath ? `\n\n📁 Backup salvo em: \`${docResult.backupPath.split('/').pop()}\`` : ''}${savedPathInfo}`;
      
      this.logger.log('Documentation tool executed successfully');
      return { aiResponse };
    }

    this.logger.warn('Documentation tool failed, falling back to conversation');
    const fallback = await this.conversationService.generateResponse(
      state.inputMessage,
      state.type,
      state.context
    );
    const aiResponse = `❌ Erro ao gerar documentação estruturada: ${docResult.error}\n\nVou responder de forma conversacional:\n\n${fallback}`;
    return { aiResponse };
  }

  private async saveDocumentationWithPatches(targetPath: string, newDoc: any): Promise<void> {
    this.logger.log(`Saving documentation with patches to: ${targetPath}`);
    
    // Ensure directory exists
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Check if file exists
    let existingDoc: any = {};
    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      existingDoc = JSON.parse(content);
    } catch {
      // File doesn't exist, create empty structure
      existingDoc = {};
    }
    
    // Create patches for each top-level property
    const patches: Operation[] = [];
    
    for (const [key, value] of Object.entries(newDoc)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // For objects, merge individual keys
        for (const [subKey, subValue] of Object.entries(value as any)) {
          patches.push({
            op: 'add',
            path: `/${key}/${subKey}`,
            value: subValue
          });
        }
      } else {
        // For primitives and arrays, replace entirely
        patches.push({
          op: 'add',
          path: `/${key}`,
          value: value
        });
      }
    }
    
    if (patches.length > 0) {
      await this.jsonPatch.applyPatchToFile({
        filePath: targetPath,
        patch: patches,
        validate: false
      });
    }
  }

  private formatDocumentationSummary(doc: any): string {
    if (!doc) return 'Nenhuma estrutura gerada';
    const summary: string[] = [];
    if (doc.app) summary.push(`📋 **App**: ${doc.app.title}`);
    if (doc.flows && Object.keys(doc.flows).length > 0) summary.push(`🔄 **Flows**: ${Object.keys(doc.flows).length} processo(s)`);
    if (doc.roles && Object.keys(doc.roles).length > 0) summary.push(`👥 **Roles**: ${Object.keys(doc.roles).length} perfil(s)`);
    if (doc.activities && Object.keys(doc.activities).length > 0) summary.push(`⚡ **Activities**: ${Object.keys(doc.activities).length} atividade(s)`);
    if (doc.stories && Object.keys(doc.stories).length > 0) summary.push(`📖 **Stories**: ${Object.keys(doc.stories).length} caso(s) de uso`);
    if (doc.test_cases && Object.keys(doc.test_cases).length > 0) summary.push(`🧪 **Test Cases**: ${Object.keys(doc.test_cases).length} teste(s)`);
    return summary.length > 0 ? summary.join('\n') : 'Estrutura básica criada';
  }
}
