/**
 * debug-pwd-tool — Returns current working directory for debugging runtime base paths
 *
 * What it does
 * - Exposes process.cwd() and the resolved workspace root from fs-utils (if available)
 *
 * How to use
 * - No input required
 * - Output: { cwd, workspaceRoot }
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const debugPwdTool = createTool({
  id: 'debug-pwd-tool',
  description: 'Retorna o diretório de trabalho atual (pwd) e o workspaceRoot resolvido.',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({
    cwd: z.string(),
    workspaceRoot: z.string(),
  }),
  execute: async () => {
    const cwd = process.cwd();
    let workspaceRoot = '';
    try {
      const fsUtils = await import('../../tools/file-system/fs-utils');
      workspaceRoot = await (fsUtils as any).getWorkspaceRoot();
    } catch {
      workspaceRoot = cwd;
    }
    return { cwd, workspaceRoot };
  },
});


