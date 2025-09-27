/**
 * fileEditableListTool — List OS files related to an app (Data, Scopes, Pages, Automations)
 *
 * What it does
 * - Returns categorized lists for quick access (areas.data/scopes/pages/automations)
 * - Helps the agent know which files are editable for the current context
 *
 * How to use
 * - Variáveis `namespace`, `app` vêm do runtimeContext (não do input)
 * - Sempre retorna todos os arquivos relevantes nas áreas mapeadas
 */
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { toOsPathFromFull } from './fs-utils';
import { resolveOsAppPaths, resolveIdentifiers } from './fs-utils';

type TreeNode = {
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
};

const inputSchema = z.object({});
const outputSchema = z.object({
  areas: z.object({
    data: z.array(z.string()),
    scopes: z.array(z.string()),
    pages: z.array(z.string()),
    automations: z.array(z.string()),
  }),
});

export const fileEditableListTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'file-editable-list-tool',
  description:
    'Retorna uma lista categorizada (OS: supabase+backend+web) do app atual para edição pela AI. Junta Data, Scopes, Pages e Automations. Estes são os arquivos que você pode editar.',
  inputSchema,
  outputSchema,
  execute: async ({ context, runtimeContext }) => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');

    // Resolve identifiers from runtimeContext (required)
    const namespace = (runtimeContext.get('namespace') as string) || 'quero';
    const app = (runtimeContext.get('app') as string) || 'flow';

    if (!namespace || !app) {
      throw new Error(
        'file-editable-list-tool: runtimeContext deve conter namespace e app'+
        '\nnamespace: ' + namespace +
        '\napp: ' + app
      );
    }

    // projectPath pode ser derivado como {namespace}/{app} se necessário
    const derivedProjectPath = `${namespace}/${app}`;
    const ids = resolveIdentifiers(namespace, app, derivedProjectPath);
    const os = await resolveOsAppPaths(ids.namespace, ids.app);

    // Areas mapping
    // Data: migrations + seed
    const dataPaths: string[] = [];
    const migrations = await fs.readdir(os.supabase.migrationsDir).catch(() => []);
    for (const f of migrations) {
      if (f.includes(`__${os.schemaName}__`)) {
        dataPaths.push(await toOsPathFromFull(path.resolve(os.supabase.migrationsDir, f)));
      }
    }
    const seedEntries = await fs.readdir(os.supabase.seedDir).catch(() => []);
    for (const f of seedEntries) {
      dataPaths.push(await toOsPathFromFull(path.resolve(os.supabase.seedDir, f)));
    }

    // Scopes: backend controllers under namespace/app
    const scopesPaths: string[] = [];
    const hasControllersDir = await fs.stat(os.backend.controllersDir).then(() => true).catch(() => false);
    if (hasControllersDir) {
      const walkControllers = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          const full = path.resolve(dir, e.name);
          if (e.isDirectory()) {
            await walkControllers(full);
          } else if (e.isFile()) {
            scopesPaths.push(await toOsPathFromFull(full));
          }
        }
      };
      await walkControllers(os.backend.controllersDir);
    }

    // Pages: web/src/pages/{namespace}/{appPath}
    const pagesPaths: string[] = [];
    const hasPagesDir = await fs.stat(os.web.pagesDir).then(() => true).catch(() => false);
    if (hasPagesDir) {
      const entries = await fs.readdir(os.web.pagesDir).catch(() => []);
      for (const f of entries) {
        pagesPaths.push(await toOsPathFromFull(path.resolve(os.web.pagesDir, f)));
      }
      // layout is optional
      const layoutExists = await fs.stat(os.web.layoutPath).then(() => true).catch(() => false);
      if (layoutExists) {
        pagesPaths.push(await toOsPathFromFull(os.web.layoutPath));
      }
    }

    // Ensure navigation file is included in pages
    const navExists = await fs.stat(os.web.navigationFile).then(() => true).catch(() => false);
    if (navExists) {
      pagesPaths.push(await toOsPathFromFull(os.web.navigationFile));
    }

    // Ensure components directory files are included in pages
    const hasComponentsDir = await fs.stat(os.web.componentsDir).then(() => true).catch(() => false);
    if (hasComponentsDir) {
      const walkComponents = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          const full = path.resolve(dir, e.name);
          if (e.isDirectory()) {
            await walkComponents(full);
          } else if (e.isFile()) {
            pagesPaths.push(await toOsPathFromFull(full));
          }
        }
      };
      await walkComponents(os.web.componentsDir);
    }

    // Schemas: supabase/schemas/{namespace}/{app}/schema.json (exposto em data)
    const schemaExists = await fs.stat(os.supabase.schemasFile).then(() => true).catch(() => false);
    if (schemaExists) {
      const osSchemaFile = await toOsPathFromFull(os.supabase.schemasFile);
      dataPaths.push(osSchemaFile);
    }

    // Automations: functions app + router triggers for this app
    const automationsPaths: string[] = [];
    const hasFunctionsApp = await fs.stat(os.supabase.functionsAppDir).then(() => true).catch(() => false);
    if (hasFunctionsApp) {
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          const full = path.resolve(dir, e.name);
          if (e.isDirectory()) {
            await walk(full);
          } else if (e.isFile()) {
            automationsPaths.push(await toOsPathFromFull(full));
          }
        }
      };
      await walk(os.supabase.functionsAppDir);
    }
    // router-* triggers
    const routersDir = os.supabase.functionsRoutersDir;
    const routers = await fs.readdir(routersDir, { withFileTypes: true }).catch(() => []);
    for (const e of routers) {
      if (e.isDirectory() && e.name.startsWith('router-')) {
        const appDir = path.resolve(routersDir, e.name, `app-${os.namespace}-${os.app}`);
        const triggersPath = path.resolve(appDir, 'triggers.ts');
        const exists = await fs.stat(triggersPath).then(() => true).catch(() => false);
        if (exists) {
          automationsPaths.push(await toOsPathFromFull(triggersPath));
        }
      }
    }

    return {
      areas: {
        data: dataPaths,
        scopes: scopesPaths,
        pages: pagesPaths,
        automations: automationsPaths,
      },
    };
  },
});




