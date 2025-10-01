/**
 * fileReadOnlyListTool — Enumerate read-only reference files for the current OS app
 *
 * What it does
 * - Returns lists of shared assets that must not be edited by the app (UI tokens, core libraries, DAL, schemas, etc.)
 * - Helps the agent locate reference material while respecting read-only restrictions
 *
 * How to use
 * - namespace/app come from runtimeContext (same convention as editable list tool)
 * - No input parameters are required
 */
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { resolveOsAppPaths, toOsPathFromFull } from './fs-utils';

const inputSchema = z.object({});

const outputSchema = z.object({
  areas: z.object({
    web: z.object({
      ui: z.array(z.string()),
      components: z.array(z.string()),
      utils: z.array(z.string()),
      styles: z.array(z.string()),
      contexts: z.array(z.string()),
      hooks: z.array(z.string()),
      api: z.array(z.string()),
      types: z.array(z.string()),
    }),
    backend: z.object({
      dal: z.array(z.string()),
      types: z.array(z.string()),
      providers: z.array(z.string()),
    }),
    supabase: z.object({
      migrations: z.array(z.string()),
      functions: z.array(z.string()),
      schemas: z.array(z.string()),
    }),
    guides: z.array(z.string()),
  }),
});

export const fileReadOnlyListTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'file-read-only-list-tool',
  description:
    'Lista arquivos de referência do OS que devem ser reutilizados sem edição: tokens globais, componentes compartilhados, utils, DAL, schemas e guias.',
  inputSchema,
  outputSchema,
  execute: async ({ runtimeContext }) => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');

    const namespace = (runtimeContext.get('namespace') as string) || 'quero';
    const app = (runtimeContext.get('app') as string) || 'flow';

    if (!namespace || !app) {
      throw new Error('file-read-only-list-tool: runtimeContext deve conter namespace e app');
    }

    const os = await resolveOsAppPaths(namespace, app);

    const ensureList = async (entries: string[]) => {
      const result: string[] = [];
      for (const entry of entries) {
        const exists = await fs.stat(entry).then(() => true).catch(() => false);
        if (exists) {
          result.push(await toOsPathFromFull(path.resolve(entry)));
        }
      }
      return result;
    };

    const collectDir = async (dir: string, filter?: (file: string) => boolean) => {
      const out: string[] = [];
      const exists = await fs.stat(dir).then(() => true).catch(() => false);
      if (!exists) return out;
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = path.resolve(dir, entry.name);
        if (entry.isFile()) {
          if (!filter || filter(entry.name)) {
            out.push(await toOsPathFromFull(full));
          }
        }
      }
      return out;
    };

    const workspaceRoot = os.workspaceRoot;

    const webUiDir = path.resolve(workspaceRoot, 'web', 'src', 'components', 'ui');
    const webComponentsDir = path.resolve(workspaceRoot, 'web', 'src', 'components', 'zazos');
    const webSharedDir = path.resolve(workspaceRoot, 'web', 'src', 'components', 'shared');
    const webUtilsDir = path.resolve(workspaceRoot, 'web', 'src', 'utils');
    const webLibDir = path.resolve(workspaceRoot, 'web', 'src', 'lib');
    const webContextsDir = path.resolve(workspaceRoot, 'web', 'src', 'contexts');
    const webHooksDir = path.resolve(workspaceRoot, 'web', 'src', 'hooks');
    const webApiDir = path.resolve(workspaceRoot, 'web', 'src', 'api');
    const webTypesDir = path.resolve(workspaceRoot, 'web', 'types');
    const webStyles = [
      path.resolve(workspaceRoot, 'web', 'src', 'index.css'),
      path.resolve(workspaceRoot, 'web', 'src', 'index.scss'),
      path.resolve(workspaceRoot, 'web', 'src', 'globals.css'),
    ];

    const backendDalDir = path.resolve(workspaceRoot, 'backend', 'src', 'data-access-layer');
    const backendTypesDir = path.resolve(workspaceRoot, 'backend', 'types');
    const backendProvidersDir = path.resolve(workspaceRoot, 'backend', 'src', 'providers');

    const supabaseFunctionsDir = path.resolve(workspaceRoot, 'supabase', 'functions');
    const supabaseMigrationsDir = path.resolve(workspaceRoot, 'supabase', 'migrations');
    const supabaseSchemasDir = path.resolve(workspaceRoot, 'supabase', 'schemas');

    const guidesDir = path.resolve(workspaceRoot, 'studio', 'api', 'src', 'guides');

    return {
      areas: {
        web: {
          ui: await collectDir(webUiDir),
          components: [
            ...(await collectDir(webComponentsDir)),
            ...(await collectDir(webSharedDir)),
          ],
          utils: [
            ...(await collectDir(webUtilsDir)),
            ...(await collectDir(webLibDir)),
          ],
          styles: await ensureList(webStyles),
          contexts: await collectDir(webContextsDir),
          hooks: await collectDir(webHooksDir),
          api: await collectDir(webApiDir),
          types: await collectDir(webTypesDir),
        },
        backend: {
          dal: await collectDir(backendDalDir),
          types: await collectDir(backendTypesDir),
          providers: await collectDir(backendProvidersDir),
        },
        supabase: {
          migrations: await collectDir(supabaseMigrationsDir),
          functions: await collectDir(supabaseFunctionsDir),
          schemas: await collectDir(supabaseSchemasDir),
        },
        guides: await collectDir(guidesDir),
      },
    };
  },
});



