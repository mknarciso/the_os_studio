/**
 * mastra-docs-mcp-tool — Provide an MCP client config to access Mastra docs in IDEs
 *
 * What it does
 * - Returns a simple MCP configuration JSON for Cursor/Windsurf to connect to Mastra Docs
 * - Includes a hintPath for where to drop the config in each IDE
 *
 * How to use
 * - Call with { ide: 'cursor' | 'windsurf' } (optional; defaults to 'cursor')
 * - Paste the returned config into the indicated hint path in your IDE
 */
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';

// Provides a ready-to-copy MCP config for Mastra docs registry
const inputSchema = z.object({
  ide: z.enum(['cursor', 'windsurf']).optional().describe('IDE de destino para dica de caminho do arquivo de config'),
});
const outputSchema = z.object({
  config: z.any(),
  hintPath: z.string(),
});

export const mastraDocsMcpTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'mastra-docs-mcp-tool',
  description: 'Retorna um JSON de configuração MCP para acesso à documentação da Mastra em IDEs compatíveis (Cursor/Windsurf).',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    // Minimal example — a registry server could be expanded later
    const config = {
      mcpServers: {
        mastraDocs: {
          command: 'npx',
          args: ['-y', '@mastra/mcp-docs', 'serve'],
        },
      },
    };

    const ide = (context as any).ide ?? 'cursor';
    const hintPath = ide === 'cursor' ? '.cursor/mcp.json' : '.codeium/windsurf/mcp_config.json';

    return {
      config,
      hintPath,
    };
  },
});


