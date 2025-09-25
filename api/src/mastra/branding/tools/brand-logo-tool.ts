import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const isLikelyLogo = (urlOrAlt: string): boolean => /logo|brandmark|wordmark|logotype|mark/i.test(urlOrAlt);

const ensureAbsolute = (origin: string, href: string): string => {
  if (href.startsWith('http')) return href;
  return `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
};

const candidatePaths = [
  '/logo.png','/logo-light.png','/logo-dark.png','/assets/logo.png','/images/logo.png','/img/logo.png','/static/logo.png',
  '/logo.svg','/logo-light.svg','/logo-dark.svg','/assets/logo.svg','/images/logo.svg','/img/logo.svg','/static/logo.svg',
];

export const brandLogoTool = createTool({
  id: 'brand-logo-tool',
  description: 'Busca logos (png/svg) preferindo fundo transparente; salva em /runs/{run_id}/logo',
  inputSchema: z.object({
    origin: z.string(),
    homepageHtml: z.string(),
    runDir: z.string().describe('Diretório absoluto da run (cria subpasta logo/)'),
  }),
  outputSchema: z.object({
    logoUrls: z.array(z.string()),
    saved: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    const { origin, homepageHtml, runDir } = context;
    const urls = new Set<string>();

    // <img ... alt="...logo..." src="...">
    const imgMatches = Array.from(homepageHtml.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi));
    imgMatches.forEach((m) => {
      const tag = m[0];
      const src = ensureAbsolute(origin, m[1]);
      const altMatch = tag.match(/alt=["']([^"']+)["']/i)?.[1] || '';
      const clsMatch = tag.match(/class=["']([^"']+)["']/i)?.[1] || '';
      if (isLikelyLogo(src) || isLikelyLogo(altMatch) || isLikelyLogo(clsMatch)) {
        urls.add(src);
      }
    });

    // common paths
    candidatePaths.forEach((p) => urls.add(ensureAbsolute(origin, p)));

    // filter image-like extensions
    const candidates = Array.from(urls).filter((u) => /(\.png|\.svg)(\?|$)/i.test(u));

    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const logoDir = path.resolve(runDir, 'logo');
    await fs.mkdir(logoDir, { recursive: true });

    const saved: string[] = [];
    for (const u of candidates) {
      try {
        const res = await fetch(u, { redirect: 'follow' as any });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (!/image\//.test(ct)) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        const ext = u.toLowerCase().includes('.svg') ? '.svg' : '.png';
        const fileName = `${encodeURIComponent(u.split('/').pop() || 'logo')}${ext}`;
        const out = path.resolve(logoDir, fileName);
        await fs.writeFile(out, buf);
        saved.push(out);
      } catch (_e) {}
    }

    return { logoUrls: candidates, saved: saved.length ? saved : undefined };
  }
});


