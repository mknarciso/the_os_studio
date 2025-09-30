import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import * as schemas from '@zazos/schemas';
import { resolveOsAppPaths } from '../file-system/fs-utils';

const inputSchema = z.object({
  resources: z.object({
    enums: z.array(z.string()).optional(),
    jsonTypes: z.array(z.string()).optional(),
    tables: z.array(z.string()).optional(),
  }),
});

const outputSchema: z.ZodTypeAny = z.object({
  name: z.string(),
  version: z.string().optional(),
  enums: z.record(z.string(), z.array(z.string())).optional(),
  jsonTypes: z.record(z.string(), schemas.JsonTypeSchema).optional(),
  tables: z.record(z.string(), schemas.TableSchema).optional(),
});

export const schemaDetailTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'schema-detail-tool',
  description:
    'Retorna os detalhes completos do schema para listas de recursos específicas: enums, jsonTypes e tables. Use sempre que for fazer operações com leitura e escrita de dados, para entender a estrutura do banco de dados.',
  inputSchema,
  outputSchema,
  execute: async ({ context, runtimeContext }) => {
    const fs = await import('node:fs/promises');

    const namespace = (runtimeContext.get('namespace') as string) || 'quero';
    const app = (runtimeContext.get('app') as string) || 'flow';

    if (!namespace || !app) {
      throw new Error('schema-detail-tool: runtimeContext deve conter namespace e app');
    }

    const os = await resolveOsAppPaths(namespace, app);
    const raw = await fs.readFile(os.supabase.schemasFile, 'utf8');
    const json = JSON.parse(raw);

    const name: string = json.name || `${namespace}_${app}`;
    const version: string | undefined = json.version;

    const out: any = { name, version };

    const { resources = {} as { enums?: string[]; jsonTypes?: string[]; tables?: string[] } } =
      (context) as { resources?: { enums?: string[]; jsonTypes?: string[]; tables?: string[] } };

    if (resources.enums && json.enums) {
      out.enums = Object.fromEntries(
        Object.entries(json.enums).filter(([k]) => resources.enums!.includes(String(k)))
      );
    }

    if (resources.jsonTypes && json.jsonTypes) {
      out.jsonTypes = Object.fromEntries(
        Object.entries(json.jsonTypes).filter(([k]) => resources.jsonTypes!.includes(String(k)))
      );
    }

    if (resources.tables && json.tables) {
      out.tables = Object.fromEntries(
        Object.entries(json.tables).filter(([k]) => resources.tables!.includes(String(k)))
      );
    }

    return out as z.infer<typeof outputSchema>;
  },
});
