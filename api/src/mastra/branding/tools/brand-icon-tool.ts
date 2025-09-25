import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import { z } from 'zod';

type FaviconGrabberResponse = {
  icons?: Array<{ src?: string; sizes?: string; type?: string }>
};

const ensureAbsolute = (origin: string, href: string): string => {
  if (href.startsWith('http')) return href;
  return `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
};

const inputSchema = z.object({
  domain: z.string().describe('Domínio, ex: contasimples.com'),
  homepageHtml: z.string().optional(),
  origin: z.string().optional(),
  runDir: z.string().optional().describe('Diretório absoluto da run para salvar logo/icon')
});
const outputSchema = z.object({
  icons: z.array(z.string()),
  savedIconPath: z.string().optional(),
});

export const brandIconTool: Tool<typeof inputSchema, typeof outputSchema> = createTool({
  id: 'brand-icon-tool',
  description: 'Busca ícones (favicon/apple-touch) do domínio e salva ícone padrão',
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const domain = context.domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const origin = context.origin || `https://${domain}`;
    const icons: string[] = [];

    try {
      const resp = await fetch(`https://favicongrabber.com/api/grab/${domain}`);
      if (resp.ok) {
        const data = (await resp.json()) as FaviconGrabberResponse;
        data.icons?.forEach((i) => { if (i.src) icons.push(i.src); });
      }
    } catch (_e) {}

    if (context.homepageHtml) {
      const linkIconMatches = Array.from(context.homepageHtml.matchAll(/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/gi));
      linkIconMatches.forEach((m) => {
        const href = m[1];
        icons.push(ensureAbsolute(origin, href));
      });
    }

    if (icons.length === 0) {
      icons.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    }

    const unique = Array.from(new Set(icons));

    let savedIconPath: string | undefined;
    if (context.runDir) {
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      const logoDir = path.resolve(context.runDir, 'logo');
      await fs.mkdir(logoDir, { recursive: true });
      try {
        const best = unique[0];
        const res = await fetch(best);
        const arr = new Uint8Array(await res.arrayBuffer());
        savedIconPath = path.resolve(logoDir, 'icon.png');
        await fs.writeFile(savedIconPath, arr);
      } catch (_e) {}
    }

    return { icons: unique, savedIconPath };
  }
});


