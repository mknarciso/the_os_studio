import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { resolveOsAppPaths } from '../file-system/fs-utils';

const inputSchema = z.object({});

const outputSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  tables: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      columns: z.array(z.string()),
    })
  ),
});

export const schemaSummaryTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'schema-summary-tool',
  description:
    'Retorna uma visão reduzida do schema em supabase/schemas/{namespace}/{app}/schema.json: tabelas, descrições e colunas (nome/tipo).',
  inputSchema,
  outputSchema,
  execute: async ({ runtimeContext }) => {
    const fs = await import('node:fs/promises');

    const namespace = (runtimeContext.get('namespace') as string) || 'quero';
    const app = (runtimeContext.get('app') as string) || 'flow';

    if (!namespace || !app) {
      throw new Error('schema-summary-tool: runtimeContext deve conter namespace e app');
    }

    const os = await resolveOsAppPaths(namespace, app);

    const raw = await fs.readFile(os.supabase.schemasFile, 'utf8');
    const json = JSON.parse(raw);

    const name: string = json.name || json.namespace || `${namespace}_${app}`;
    const version: string | undefined = json.version;
    const tablesObj: Record<string, any> = json.tables || {};

    const tables = Object.entries(tablesObj).map(([tableName, tableDef]) => {
      const description: string | undefined = tableDef.description || undefined;
      const cols = Object.entries(tableDef.columns || {}).map(([colName, colDef]: [string, any]) => (`${colName}: ${String(colDef.type)}`));
      return { name: tableName, description, columns: cols };
    });

    return { name, version, tables } as z.infer<typeof outputSchema>;
  },
});
