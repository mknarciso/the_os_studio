import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const ensureAbsolute = (origin: string, href: string): string => {
  if (href.startsWith('http')) return href;
  return `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
};

const isLikelyBrandImage = (url: string, altOrClass: string): boolean => {
  // Avoid client logos/press logos grids
  const notBrand = /(clients|clientes|press|parceiros|partners|awards|badges|selo|selos|media|brands)/i;
  if (notBrand.test(url) || notBrand.test(altOrClass)) return false;

  // Prefer hero/section/background/illustration/product imagery
  const brandish = /(hero|cover|banner|section|bg|background|illustration|product|team|office|about|feature)/i;
  return brandish.test(url) || brandish.test(altOrClass);
};

const detectSection = (snippet: string): string => {
  const lower = snippet.toLowerCase();
  const candidates = [
    'hero','header','nav','banner','cover','about','sobre','features','benefits','section','product','solutions','cases','portfolio','testimonials','depoimentos','pricing','planos','faq','footer'
  ];
  for (const key of candidates) {
    if (lower.includes(key)) return key;
  }
  return 'section';
};

const sanitizePart = (s: string): string => s.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

export const brandImagesBucketTool = createTool({
  id: 'brand-images-bucket-tool',
  description: 'Coleta imagens relevantes da homepage e salva em runs/{run}/images-bucket evitando logos de clientes',
  inputSchema: z.object({
    origin: z.string(),
    homepageHtml: z.string(),
    runDir: z.string(),
    maxImages: z.number().optional().default(12),
  }),
  outputSchema: z.object({
    saved: z.array(z.string()),
    skipped: z.array(z.string()).optional(),
  }),
  execute: async ({ context }) => {
    const { origin, homepageHtml, runDir, maxImages } = context as { origin: string; homepageHtml: string; runDir: string; maxImages?: number };
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const imagesDir = path.resolve(runDir, 'images-bucket');
    await fs.mkdir(imagesDir, { recursive: true });

    const candidates = new Set<string>();
    const skipped: string[] = [];
    const saved: string[] = [];

    // <img> tags
    const imgMatches = Array.from(homepageHtml.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi));
    imgMatches.forEach((m) => {
      const tag = m[0];
      const idx = (m as any).index ?? 0;
      const snippet = homepageHtml.slice(Math.max(0, idx - 400), Math.min(homepageHtml.length, idx + 400));
      const section = detectSection(snippet);
      const src = ensureAbsolute(origin, m[1]);
      const alt = tag.match(/alt=["']([^"']+)["']/i)?.[1] || '';
      const cls = tag.match(/class=["']([^"']+)["']/i)?.[1] || '';
      if (isLikelyBrandImage(src, `${alt} ${cls}`)) candidates.add(`${section}|${src}`);
    });

    // background-image URLs in inline styles
    const bgMatches = Array.from(homepageHtml.matchAll(/background-image\s*:\s*url\(([^\)]+)\)/gi));
    bgMatches.forEach((m) => {
      const idx = (m as any).index ?? 0;
      const snippet = homepageHtml.slice(Math.max(0, idx - 400), Math.min(homepageHtml.length, idx + 400));
      const section = detectSection(snippet);
      const raw = m[1].replace(/["']/g, '');
      const src = ensureAbsolute(origin, raw);
      if (isLikelyBrandImage(src, 'bg')) candidates.add(`${section}|${src}`);
    });

    // simple filter to prefer images
    const images = Array.from(candidates)
      .map((entry) => {
        const [section, url] = entry.split('|');
        return { section, url };
      })
      .filter((o) => /(\.(png|jpe?g|webp|avif|svg))(\?|$)/i.test(o.url))
      .slice(0, maxImages || 12);

    for (const { section, url: u } of images) {
      try {
        const res = await fetch(u, { redirect: 'follow' as any });
        if (!res.ok) { skipped.push(u); continue; }
        const ct = res.headers.get('content-type') || '';
        if (!/image\//.test(ct)) { skipped.push(u); continue; }
        const buf = new Uint8Array(await res.arrayBuffer());
        const extMatch = u.toLowerCase().match(/\.(png|jpe?g|webp|avif|svg)(\?|$)/);
        const ext = extMatch ? `.${extMatch[1]}` : '.png';
        const lastPart = u.split('/').pop() || 'image';
        const baseNoQuery = lastPart.split('?')[0];
        const baseNoExt = baseNoQuery.replace(/\.(png|jpe?g|webp|avif|svg)$/i, '');
        const prefix = sanitizePart(section);
        const fileName = `${prefix}__${sanitizePart(baseNoExt)}${ext}`;
        const out = path.resolve(imagesDir, fileName);
        await fs.writeFile(out, buf);
        saved.push(out);
      } catch { skipped.push(u); }
    }

    return { saved, skipped: skipped.length ? skipped : undefined };
  }
});


