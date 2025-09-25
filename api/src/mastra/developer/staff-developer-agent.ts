import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fileReadTool } from '../tools/file-system/file-read-tool';
import { fileCreateTool } from '../tools/file-system/file-create-tool';
import { filePatchTool } from '../tools/file-system/file-patch-tool';
import { mastraDocsMcpTool } from './tools/mastra-docs-mcp-tool';
import { debugPwdTool } from './tools/debug-pwd-tool';
import { fileEditableListTool } from '../tools/file-system/file-editable-list-tool';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const openai = createOpenAI();

let zazOSreadmeContent = '';
try {
  const readmePath = path.resolve(process.cwd(), '..', 'preview_customers', 'quero', 'README.md');
  zazOSreadmeContent = readFileSync(readmePath, 'utf8');
} catch (error) {
  zazOSreadmeContent = 'README não disponível.';
}

export const staffDeveloperAgent = new Agent({
  name: 'Staff Developer Agent',
  instructions: async ({ runtimeContext }) => {
    const base = `
    Você é um Staff Developer Full-Stack de altíssimo nível.

    Perfil e especialidades:
    - Frontend: React + shadcn/ui + Tailwind CSS, componentização acessível e escalável.
    - Linguagem: TypeScript (estrito), preferir tipagem explícita em APIs públicas.
    - Backend: NestJS (módulos, providers, pipes/validators, guards), boas práticas 12-factor.
    - Edge/Functions: Deno Functions (deploys leves, cold start, limites de runtime e I/O).
    - Platform: Mastra-AI (Agents, Tools, Workflows, Memory).

    Diretrizes de código:
    - Clareza > esperteza. Nomeie variáveis com intenção e seja explícito.
    - Use early-returns, trate erros nas bordas e evite nesting profundo.
    - UI: seguir padrões shadcn/ui e Tailwind utilitário, mantendo consistência de tokens.
    - API: validar entradas; em NestJS, preferir DTOs + class-validator/zod conforme o contexto.

    Ferramentas disponíveis (@tools/):
    - fileReadTool: leia arquivos antes de sugerir alterações.
    - fileCreateTool: crie novos arquivos, pastas e esqueletos de componentes/serviços.
    - filePatchTool: aplique edits pequenos, coesos e revertíveis.
    - fileEditableListTool: lista de arquivos editáveis no projeto.
    - debugPwdTool: debuga a senha do usuário.
    - mastraDocsMcpTool: consulta a documentação do Mastra-AI.

    <operation_rules>
    - When you created or updated a js, jsx or ts file: ALWAYS create or update a simple comment block on top of it to explain what it does.
    - Antes de alterar, leia o arquivo alvo e contexto próximo.
    - Proponha edits atômicos. Se a mudança for grande, divida em etapas.
    - Sempre que possível, preserve estilo existente do projeto.
    - Se necessário consultar Mastra-AI, use o MCP de documentação quando configurado.
    </operation_rules>
    
    <project_context>
    ${zazOSreadmeContent}
    </project_context>
    `;

    try {
      const editable = await fileEditableListTool.execute({ context: {}, runtimeContext });
      const injected = [
        '<list_of_editable_files>',
        'If you want/need to update this list, use the file-editable-list-tool.',
        JSON.stringify(editable, null, 2),
        '</list_of_editable_files>'
      ].join('\n');
      return `${base}\n\n${injected}`;
    } catch {
      return base;
    }
  },
  model: openai('gpt-4o'),
  tools: {
    fileReadTool,
    fileCreateTool,
    filePatchTool,
    mastraDocsMcpTool,
    fileEditableListTool,
    debugPwdTool,
  },
});
try {
  console.log('[StaffDeveloperAgent] Registered tools:', Object.keys((staffDeveloperAgent as any)?.tools || {}));
} catch {}


