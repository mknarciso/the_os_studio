/**
 * filePatchTool — Apply targeted text edits to OS files in the current app context
 *
 * What it does
 * - Opens a resolved OS file and replaces text either once or across all occurrences
 * - Keeps changes small and revertible; ideal for minor safe edits suggested by the agent
 * - Emits an internal event `tool:used` with `occurrences` after a successful write
 *
 * Inputs (JSON)
 * - area: 'pages' | 'data' | 'automations' | 'documentation' (currently only 'pages' resolves paths)
 * - projectPath?: string — '/apps/{namespace}/{app}' (recommended)
 * - location: 'pages' | 'components' | 'navigation'
 * - relativePath: string — filename only
 * - find: string — text to search (literal match)
 * - replace: string — replacement text
 * - all?: boolean — replace all occurrences (default false = first occurrence)
 *
 * Outputs (JSON)
 * - fullPath: absolute file path
 * - osPath: path relative to root
 * - appPath: path relative to app root
 * - changed: boolean
 * - occurrences: number
 *
 * How to use
 * - Prefer `projectPath: "/apps/{namespace}/{app}"`
 * - Provide: `area`, `location`, `relativePath` (filename only), `find`, `replace`, and optional `all`
 * - Example:
 *   {
 *     "area": "pages",
 *     "projectPath": "/apps/quero/flow",
 *     "location": "pages",
 *     "relativePath": "MeusPagamentosPJ.jsx",
 *     "find": "<TabsList className=\"grid w-full grid-cols-2\">",
 *     "replace": "<TabsList className=\"grid w-full grid-cols-2\">\n  <TabsTrigger value=\"fluxo_faturamento\">Fluxo</TabsTrigger>\n  <TabsTrigger value=\"historico\">Histórico</TabsTrigger>",
 *     "all": false
 *   }
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { assertAllowedExtension, resolveOsAppPaths, toFullPathFromOsPath } from './fs-utils';
import * as path from 'path';
import { toolBus } from '../../../utils/event-bus';

export const filePatchTool = createTool({
  id: 'file-patch-tool',
  description: 'Aplica edição textual em um arquivo. Informe apenas osPath/find/replace; namespace/app vêm do runtimeContext.',
  inputSchema: z.object({
    osPath: z.string(),
    find: z.string().min(1),
    replace: z.string().default(''),
    all: z.boolean().default(false),
  }),
  outputSchema: z.object({ osPath: z.string(), changed: z.boolean(), occurrences: z.number() }),
  execute: async (...args: any[]) => {
    const fs = await import('node:fs/promises');
    const [a0, a1] = args;
    const maybeWrapper = a0 as any;
    const direct = (maybeWrapper && (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput))
      ? (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput)
      : (a1 ?? maybeWrapper);

    // Recursively search for an object containing osPath
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

    const input = findInput(direct) as z.infer<typeof filePatchTool.inputSchema>;

    try {
      console.log('[filePatchTool] argsLen:', args.length);
      console.log('[filePatchTool] a0Keys:', a0 && typeof a0 === 'object' ? Object.keys(a0) : typeof a0);
      console.log('[filePatchTool] a1Keys:', a1 && typeof a1 === 'object' ? Object.keys(a1) : typeof a1);
      console.log('[filePatchTool] ctx.hasInput:', Boolean((a0 as any)?.input), 'ctx.hasArgs:', Boolean((a0 as any)?.args));
      console.log('[filePatchTool] inputPreview:', {
        osPath: (input as any)?.osPath,
        find: (input as any)?.find,
        all: (input as any)?.all,
      });
    } catch {}

    if (!input || typeof input !== 'object') {
      throw new Error('Parâmetros inválidos: objeto de entrada não recebido');
    }

    const runtimeContext = (maybeWrapper && maybeWrapper.runtimeContext) || (a0 as any)?.runtimeContext;
    const namespace = (runtimeContext?.get?.('namespace') as string) || 'quero';
    const app = (runtimeContext?.get?.('app') as string) || 'flow';

    const target = await toFullPathFromOsPath(input.osPath);
    const ext = path.extname(target).toLowerCase();
    if (!ext) throw new Error('Extensão ausente no caminho informado');
    assertAllowedExtension(`file${ext}`);

    const os = await resolveOsAppPaths(namespace, app);
    const allowedDirectories = [
      os.web.pagesDir,
      os.web.componentsDir,
      path.dirname(os.web.navigationFile),
      os.backend.controllersDir,
      os.supabase.functionsAppDir,
      os.supabase.seedDir,
      os.supabase.schemasDir,
      os.supabase.migrationsDir,
    ]
      .filter(Boolean)
      .map(dir => path.resolve(dir));

    const allowedFiles = [os.web.navigationFile]
      .filter(Boolean)
      .map(file => path.resolve(file));

    const normalizedTarget = path.resolve(target);
    const inAllowedDir = allowedDirectories.some(dir => normalizedTarget.startsWith(dir + path.sep));
    const isExplicitAllowedFile = allowedFiles.some(file => normalizedTarget === file);

    if (!inAllowedDir && !isExplicitAllowedFile) {
      throw new Error('file-patch-tool: caminho fora das áreas editáveis');
    }

    try {
      const original = await fs.readFile(target, 'utf8');
      let occurrences = 0;
      let updated = original;

      if (input.all) {
        const re = new RegExp(input.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        occurrences = (original.match(re) || []).length;
        updated = original.replace(re, input.replace);
      } else {
        const idx = original.indexOf(input.find);
        occurrences = idx >= 0 ? 1 : 0;
        if (idx >= 0) {
          updated = original.slice(0, idx) + input.replace + original.slice(idx + input.find.length);
        }
      }

      if (updated !== original) {
        await fs.writeFile(target, updated, 'utf8');
        try { toolBus.emit('tool:used', { tool: 'filePatchTool', args: { path: target, occurrences } }); } catch {}
        return { osPath: input.osPath, changed: true, occurrences };
      }
      {
        return { osPath: input.osPath, changed: false, occurrences };
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      try {
        toolBus.emit('tool:error', {
          tool: 'filePatchTool',
          args: { path: target, find: input.find, all: input.all },
          error: error.message
        });
      } catch {}
      throw error;
    }
  },
});


