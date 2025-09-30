/**
 * fileCreateTool — Create OS workspace files for the current app context
 *
 * What it does
 * - Creates a new .js/.jsx/.ts file under an allowed OS location for the app
 * - Resolves OS path from identifiers (namespace/app) or `projectPath`
 * - Will not overwrite by default (set `overwrite: true` to replace)
 * - Emits an internal event `tool:used` when executed
 *
 * Inputs (JSON)
 * - area: 'pages' | 'data' | 'automations' | 'documentation' (currently only 'pages' resolves paths)
 * - projectPath?: string — '/apps/{namespace}/{app}' (recommended)
 * - location: 'pages' | 'components' | 'navigation'
 * - relativePath: string — filename only
 * - content: string — file contents
 * - overwrite?: boolean — default false
 *
 * Outputs (JSON)
 * - fullPath: absolute file path
 * - osPath: path relative to root
 * - appPath: path relative to app root
 * - created: boolean
 *
 * How to use
 * - Prefer `projectPath: "/apps/{namespace}/{app}"`
 * - Provide: `area`, `location`, `relativePath` (filename only), `content`, and optional `overwrite`
 * - Example:
 *   {
 *     "area": "pages",
 *     "projectPath": "/apps/quero/flow",
 *     "location": "pages",
 *     "relativePath": "NovaPagina.jsx",
 *     "content": "export default function NovaPagina(){return <div/>}",
 *     "overwrite": false
 *   }
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { assertAllowedExtension, resolveOsAppPaths, toFullPathFromOsPath } from './fs-utils';
import * as path from 'path';
import { toolBus } from '../../../utils/event-bus';

export const fileCreateTool = createTool({
  id: 'file-create-tool',
  description: 'Cria um novo arquivo no OS. Informe apenas osPath (destino) e conteúdo; namespace/app vêm do runtimeContext.',
  inputSchema: z.object({
    osPath: z.string().describe('Destino dentro do OS (ex.: web/src/pages/ns/app/File.jsx)'),
    content: z.string().default(''),
    overwrite: z.boolean().default(false),
  }),
  outputSchema: z.object({ osPath: z.string(), created: z.boolean() }),
  execute: async (...args: any[]) => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const [a0, a1] = args;
    const maybeWrapper = a0 as any;
    const input = (maybeWrapper && (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput))
      ? (maybeWrapper.context || maybeWrapper.input || maybeWrapper.args || maybeWrapper.toolInput) as z.infer<typeof fileCreateTool.inputSchema>
      : (a1 ? (a1 as z.infer<typeof fileCreateTool.inputSchema>) : (maybeWrapper as z.infer<typeof fileCreateTool.inputSchema>));

    try {
      console.log('[fileCreateTool] argsLen:', args.length);
      console.log('[fileCreateTool] a0Keys:', a0 && typeof a0 === 'object' ? Object.keys(a0) : typeof a0);
      console.log('[fileCreateTool] a1Keys:', a1 && typeof a1 === 'object' ? Object.keys(a1) : typeof a1);
      console.log('[fileCreateTool] ctx.hasInput:', Boolean((a0 as any)?.input), 'ctx.hasArgs:', Boolean((a0 as any)?.args));
      console.log('[fileCreateTool] inputPreview:', {
        osPath: (input as any)?.osPath,
        appPath: (input as any)?.appPath,
        fullPath: (input as any)?.fullPath,
        overwrite: (input as any)?.overwrite,
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
      throw new Error('file-create-tool: caminho fora das áreas editáveis');
    }

    try {
      const existing = await fs.stat(target).then(() => true).catch(() => false);
      if (existing && !input.overwrite) {
        return { osPath: input.osPath, created: false };
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, input.content, 'utf8');
      try { toolBus.emit('tool:used', { tool: 'fileCreateTool', args: { path: target } }); } catch {}
      return { osPath: input.osPath, created: true };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      try {
        toolBus.emit('tool:error', {
          tool: 'fileCreateTool',
          args: { path: target, overwrite: input.overwrite },
          error: error.message
        });
      } catch {}
      throw error;
    }
  },
});


