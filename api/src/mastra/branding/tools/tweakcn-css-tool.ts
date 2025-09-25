import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';

type AnyRecord = Record<string, any>;

const toCssVars = (obj: AnyRecord): string => {
  const lines: string[] = [];
  for (const [key, val] of Object.entries(obj || {})) {
    if (val == null || typeof val === 'object') continue;
    lines.push(`  --${key}: ${String(val)};`);
  }
  return lines.join('\n');
};

const inputSchema = z.object({
  runDir: z.string(),
  guidelinePath: z.string().optional(),
});
const outputSchema = z.object({
  cssPath: z.string(),
});

export const tweakcnCssTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'tweakcn-css-tool',
  description: 'Gera index.css (tema tweakcn) a partir do guideline.yaml salvo no run',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const { parse } = await import('yaml');

    const guidelinePath = context.guidelinePath || path.resolve(context.runDir, 'guideline.yaml');
    const cssPath = path.resolve(context.runDir, 'index.css');

    const raw = await fs.readFile(guidelinePath, 'utf-8');
    const data = parse(raw) as AnyRecord;

    const ui = data?.ui || {};
    const tweakcn = ui?.tweakcn || {};
    const light = tweakcn?.light || {};
    const dark = tweakcn?.dark || {};
    const radius = ui?.radius || light?.radius || dark?.radius;

    const rootVars = toCssVars(light) + (radius ? `\n  --radius: ${radius};` : '');
    const darkVars = toCssVars(dark) + (radius ? `\n  --radius: ${radius};` : '');

    const css = `:root {\n${rootVars}\n}\n\n.dark {\n${darkVars}\n}\n`;
    await fs.writeFile(cssPath, css, 'utf-8');

    return { cssPath };
  },
});


