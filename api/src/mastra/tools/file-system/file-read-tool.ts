/**
 * fileReadTool — Read OS workspace files for the current app context
 *
 * What it does
 * - Reads text content from a .js/.jsx/.ts file that belongs to an app in the OS (web/backend/supabase)
 * - Resolves target path based on project identifiers (namespace/app or projectPath)
 * - Enforces access only within allowed locations (pages | components | navigation)
 * - Emits an internal event `tool:used` when executed (used by UI badges)
 *
 * Inputs (JSON)
 * - area: 'pages' | 'data' | 'automations' | 'documentation' (currently only 'pages' resolves paths)
 * - projectPath?: string — '/apps/{namespace}/{app}' (recommended)
 * - namespace?: string — if omitted, derived from projectPath
 * - app?: string — if omitted, derived from projectPath
 * - location: 'pages' | 'components' | 'navigation'
 * - relativePath: string — filename only (e.g. 'FluxoFaturamento.jsx')
 *
 * Outputs (JSON)
 * - fullPath: absolute file path on disk
 * - osPath: path relative to the root (e.g. 'web/src/pages/{ns}/{camel}/File.jsx')
 * - appPath: path relative to the app root under workspace (e.g. '{ns}/{app}/pages/File.jsx')
 * - content: file content
 *
 * How to use
 * - Prefer `projectPath: "/apps/{namespace}/{app}"`; identifiers become implicit
 * - Pass `area: "pages"`, `location`, and `relativePath` (filename only) to read
 * - Example:
 *   {
 *     "area": "pages",
 *     "projectPath": "/apps/quero/flow",
 *     "location": "pages",
 *     "relativePath": "FluxoFaturamento.jsx"
 *   }
 *
 * Notes
 * - `relativePath` must be a filename (no directories). The tool resolves full path for you
 * - For pages, the directory is resolved using appConfig.camel_name (e.g., web/src/pages/{namespace}/{camel_name})
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { assertAllowedExtension, toFullPathFromOsPath } from './fs-utils';
import * as path from 'path';
import { toolBus } from '../../../utils/event-bus';

export const fileReadTool = createTool({
  id: 'file-read-tool',
  description: 'Lê o conteúdo de um arquivo. Informe apenas osPath; namespace/app vêm do runtimeContext.',
  inputSchema: z.object({
    osPath: z.string(),
  }),
  outputSchema: z.object({
    osPath: z.string(),
    content: z.string(),
  }),
  execute: async (...args: any[]) => {
    const fs = await import('node:fs/promises');
    const [a0, a1] = args;
    const maybeWrapper = a0 as any;
    const direct = (maybeWrapper && (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput))
      ? (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput)
      : (a1 ?? maybeWrapper);

    // Fallback: recursively search for an object with osPath
    const findInput = (root: any, maxDepth = 5): any => {
      if (!root || maxDepth < 0) return undefined;
      if (typeof root === 'object' && !Array.isArray(root)) {
        const keys = Object.keys(root);
        if (keys.includes('osPath')) {
          return root;
        }
      }
      if (typeof root === 'object') {
        for (const k of Object.keys(root)) {
          const res = findInput(root[k], maxDepth - 1);
          if (res) return res;
        }
      }
      if (Array.isArray(root)) {
        for (const v of root) {
          const res = findInput(v, maxDepth - 1);
          if (res) return res;
        }
      }
      return undefined;
    };

    const input = findInput(direct) as z.infer<typeof fileReadTool.inputSchema>;

    try {
      console.log('[fileReadTool] argsLen:', args.length);
      console.log('[fileReadTool] a0Keys:', a0 && typeof a0 === 'object' ? Object.keys(a0) : typeof a0);
      console.log('[fileReadTool] a1Keys:', a1 && typeof a1 === 'object' ? Object.keys(a1) : typeof a1);
      console.log('[fileReadTool] ctx.hasInput:', Boolean((a0 as any)?.input), 'ctx.hasArgs:', Boolean((a0 as any)?.args));
      console.log('[fileReadTool] inputPreview:', {
        osPath: (input as any)?.osPath,
      });
    } catch {}

    if (!input || typeof input !== 'object') {
      throw new Error('Parâmetros inválidos: objeto de entrada não recebido');
    }
    const target = await toFullPathFromOsPath(input.osPath);
    const ext = path.extname(target);
    assertAllowedExtension(`file${ext}`);

    try {
      const content = await fs.readFile(target, 'utf8');
      const osPath = input.osPath;
      try { toolBus.emit('tool:used', { tool: 'fileReadTool', args: { path: target } }); } catch {}
      return { osPath, content };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      try {
        toolBus.emit('tool:error', {
          tool: 'fileReadTool',
          args: { path: target },
          error: error.message
        });
      } catch {}
      throw error;
    }
  },
});


