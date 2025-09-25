import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentationDbSchema, DocumentationDb } from '@zazos/schemas';

export interface DocumentationContext {
  hasDocumentation: boolean;
  documentationPath?: string;
  documentation?: DocumentationDb;
  summary: string;
}

@Injectable()
export class DocumentationLoaderService {
  
  /**
   * Carrega a documentação atual do app baseado no contexto
   */
  async loadCurrentDocumentation(context?: {
    projectPath?: string;
    currentFile?: string;
    area?: string;
  }): Promise<DocumentationContext> {
    
    try {
      // Determinar caminhos possíveis da documentação baseado no contexto
      const possiblePaths = this.resolvePossibleDocumentationPaths(context);
      
      if (possiblePaths.length === 0) {
        return {
          hasDocumentation: false,
          summary: 'Nenhum caminho de documentação identificado no contexto fornecido.'
        };
      }

      // Tentar carregar o arquivo de documentação de cada caminho possível
      let documentation: DocumentationDb | null = null;
      let successfulPath: string | null = null;

      for (const docPath of possiblePaths) {
        documentation = await this.loadDocumentationFile(docPath);
        if (documentation) {
          successfulPath = docPath;
          break;
        }
      }
      
      if (!documentation || !successfulPath) {
        return {
          hasDocumentation: false,
          summary: `Arquivo de documentação não encontrado em nenhum dos caminhos tentados: ${possiblePaths.length} locais verificados`
        };
      }

      return {
        hasDocumentation: true,
        documentationPath: successfulPath,
        documentation,
        summary: this.generateDocumentationSummary(documentation)
      };

    } catch (error) {
      console.error('Error loading current documentation:', error);
      return {
        hasDocumentation: false,
        summary: `Erro ao carregar documentação: ${error.message}`
      };
    }
  }

  /**
   * Resolve todos os caminhos possíveis do arquivo de documentação baseado no contexto
   */
  private resolvePossibleDocumentationPaths(context?: {
    projectPath?: string;
    currentFile?: string;
    area?: string;
  }): string[] {
    
    if (!context?.projectPath) {
      return [];
    }

    // Base path do workspace
    const workspaceRoot = path.join(process.cwd(), '..', '..');
    
    // Padrões de caminhos possíveis para documentação
    const possiblePaths = [
      // Novo padrão: workspace root é /
      path.join(workspaceRoot, context.projectPath, 'documentation.json'),
      path.join(workspaceRoot, context.projectPath, 'docs', 'documentation.json'),
      path.join(workspaceRoot, context.projectPath, 'data', 'documentation.json'),
      // Padrão específico apps
      path.join(workspaceRoot, 'apps', 'quero', 'flow', 'documentation.json'),
    ];

    console.log('🔍 [DocumentationLoader] Searching for documentation in projectPath:', context.projectPath);
    possiblePaths.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

    return possiblePaths;
  }

  /**
   * Carrega e valida o arquivo de documentação
   */
  private async loadDocumentationFile(filePath: string): Promise<DocumentationDb | null> {
    try {
      // Verificar se arquivo existe
      await fs.access(filePath);
      
      // Ler conteúdo
      const content = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(content);
      
      // Validar com schema
      const validatedDoc = DocumentationDbSchema.parse(jsonData);
      
      console.log(`✅ [DocumentationLoader] Documentation loaded successfully from: ${filePath}`);
      return validatedDoc;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`❌ [DocumentationLoader] Documentation file not found: ${filePath}`);
      } else {
        console.error(`❌ [DocumentationLoader] Error loading documentation from ${filePath}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Gera um resumo da documentação atual
   */
  private generateDocumentationSummary(doc: DocumentationDb): string {
    const summary = [];
    
    if (doc.app) {
      summary.push(`📋 **App**: ${doc.app.title} (${doc.app.slug})`);
      if (doc.app.context) {
        summary.push(`   Contexto: ${doc.app.context.substring(0, 100)}...`);
      }
    }
    
    const counts = {
      flows: Object.keys(doc.flows || {}).length,
      roles: Object.keys(doc.roles || {}).length,
      activities: Object.keys(doc.activities || {}).length,
      stories: Object.keys(doc.stories || {}).length,
      test_cases: Object.keys(doc.test_cases || {}).length,
      vendors: Object.keys(doc.vendors || {}).length
    };

    if (counts.flows > 0) summary.push(`🔄 **${counts.flows} Flows** definidos`);
    if (counts.roles > 0) summary.push(`👥 **${counts.roles} Roles** definidos`);
    if (counts.activities > 0) summary.push(`⚡ **${counts.activities} Activities** definidas`);
    if (counts.stories > 0) summary.push(`📖 **${counts.stories} Stories** definidas`);
    if (counts.test_cases > 0) summary.push(`🧪 **${counts.test_cases} Test Cases** definidos`);
    if (counts.vendors > 0) summary.push(`🏢 **${counts.vendors} Vendors** definidos`);

    if (doc.metadata) {
      summary.push(`📅 Última atualização: ${new Date(doc.metadata.updated_at).toLocaleString('pt-BR')}`);
    }

    return summary.length > 0 
      ? summary.join('\n')
      : 'Documentação vazia ou estrutura não reconhecida';
  }

  /**
   * Salva documentação atualizada
   */
  async saveDocumentation(filePath: string, documentation: DocumentationDb): Promise<void> {
    try {
      // Atualizar metadata
      const updatedDoc = {
        ...documentation,
        metadata: {
          ...documentation.metadata,
          updated_at: new Date().toISOString(),
          version: documentation.metadata?.version || "1.0.0"
        }
      };

      // Garantir que o diretório existe
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Salvar arquivo
      await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2), 'utf-8');
      
      console.log(`Documentation saved successfully to: ${filePath}`);
    } catch (error) {
      console.error(`Error saving documentation to ${filePath}:`, error);
      throw new Error(`Failed to save documentation: ${error.message}`);
    }
  }

  /**
   * Salva documentação mesclando com conteúdo existente (não destrutivo)
   */
  async saveDocumentationMerged(filePath: string, updates: Partial<DocumentationDb>): Promise<void> {
    try {
      let base: DocumentationDb | null = null;
      try {
        await fs.access(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        base = DocumentationDbSchema.parse(JSON.parse(content));
      } catch {
        base = null;
      }

      const merged = this.deepMerge(base || ({} as DocumentationDb), updates as any) as DocumentationDb;

      // Delegar para o save que já trata metadata e diretórios
      await this.saveDocumentation(filePath, merged);
    } catch (error) {
      console.error(`Error merging documentation to ${filePath}:`, error);
      throw new Error(`Failed to merge documentation: ${error.message}`);
    }
  }

  private deepMerge(target: any, source: any): any {
    if (source === undefined || source === null) return target;
    if (typeof source !== 'object' || Array.isArray(source)) {
      // Arrays e primitivos substituem
      return source;
    }

    const result: any = { ...(target || {}) };
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = (target || {})[key];
      if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
        result[key] = this.deepMerge(tgtVal || {}, srcVal);
      } else {
        result[key] = srcVal;
      }
    }
    return result;
  }
}
