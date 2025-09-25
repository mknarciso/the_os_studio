import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type CssTokenExtraction = {
  colors: Array<{ name?: string; value: string }>;
  fonts: Array<{ family: string; weight?: string; source?: string }>;
  variables: Record<string, string>;
};

const extractCss = (html: string): string[] => {
  const inlines = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((m) => m[1]);
  const links = Array.from(html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);
  return [...inlines, ...links];
};

const fetchStylesheets = async (origin: string, cssRefs: string[]): Promise<string[]> => {
  const results: string[] = [];
  for (const ref of cssRefs) {
    if (ref.includes('{')) { // inline CSS content
      results.push(ref);
      continue;
    }
    const url = ref.startsWith('http') ? ref : `${origin}${ref.startsWith('/') ? '' : '/'}${ref}`;
    try {
      const res = await fetch(url);
      if (res.ok) results.push(await res.text());
    } catch (_e) {
      // ignore
    }
  }
  return results;
};

const parseTokens = (cssList: string[]): CssTokenExtraction => {
  const variables: Record<string, string> = {};
  const colors: Array<{ name?: string; value: string }> = [];
  const fonts: Array<{ family: string; weight?: string; source?: string }> = [];

  const varRegex = /--([a-z0-9-_]+)\s*:\s*([^;]+);/gi;
  const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\))/g;
  const fontFamilyRegex = /font-family:\s*([^;]+);/gi;
  const fontFaceRegex = /@font-face\s*\{([\s\S]*?)\}/gi;

  cssList.forEach((css) => {
    let m;
    while ((m = varRegex.exec(css)) !== null) {
      variables[`--${m[1]}`] = m[2].trim();
    }
    const found = css.match(colorRegex) || [];
    found.forEach((c) => colors.push({ value: c }));

    let ff;
    while ((ff = fontFamilyRegex.exec(css)) !== null) {
      fonts.push({ family: ff[1].replace(/['"]/g, '').split(',')[0].trim() });
    }
    let face;
    while ((face = fontFaceRegex.exec(css)) !== null) {
      const famMatch = face[1].match(/font-family:\s*['"]?([^;'"\n]+)['"]?/i);
      const weightMatch = face[1].match(/font-weight:\s*([^;]+);/i);
      fonts.push({ family: famMatch?.[1] || 'Unknown', weight: weightMatch?.[1]?.trim(), source: 'font-face' });
    }
  });

  // Deduplicate
  const uniq = <T, K>(arr: T[], key: (x: T) => string) => Array.from(new Map(arr.map((x) => [key(x), x])).values());
  return {
    colors: uniq(colors, (x) => x.value.toLowerCase()),
    fonts: uniq(fonts, (x) => `${x.family}|${x.weight || ''}`.toLowerCase()),
    variables,
  };
};

export const cssTokensTool = createTool({
  id: 'css-tokens-tool',
  description: 'Extrai tokens básicos (variáveis CSS, cores, fontes) do HTML+CSS da página',
  inputSchema: z.object({
    origin: z.string(),
    html: z.string(),
  }),
  outputSchema: z.object({
    tokens: z.object({
      colors: z.array(z.object({ value: z.string(), name: z.string().optional() })),
      fonts: z.array(z.object({ family: z.string(), weight: z.string().optional(), source: z.string().optional() })),
      variables: z.record(z.string(), z.string()),
    }),
  }),
  execute: async ({ context }) => {
    const refs = extractCss(context.html);
    const stylesheets = await fetchStylesheets(context.origin, refs);
    const tokens = parseTokens(stylesheets);
    return { tokens };
  },
});


