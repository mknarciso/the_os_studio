import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const screenshotsTool = createTool({
  id: 'screenshots-tool',
  description: 'Tira screenshots com Puppeteer (viewport e fullpage) e salva em /runs/{run_id}/screenshots',
  inputSchema: z.object({
    pages: z.array(z.object({ url: z.string() })),
    runDir: z.string().optional().describe('Diretório da run para salvar imagens (opcional)'),
  }),
  outputSchema: z.object({
    screenshots: z.array(z.object({ url: z.string(), viewport: z.string(), fullpage: z.string() })),
    saved: z.array(z.object({ url: z.string(), viewportPath: z.string().optional(), fullpagePath: z.string().optional() })).optional(),
  }),
  execute: async ({ context }) => {
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const puppeteer = (await import('puppeteer')).default;

    const saved: Array<{ url: string; viewportPath?: string; fullpagePath?: string }> = [];
    const results: Array<{ url: string; viewport: string; fullpage: string }> = [];

    const baseRunDir = context.runDir || path.resolve(process.cwd(), 'runs');
    const shotsDir = path.resolve(baseRunDir, 'screenshots');
    await fs.mkdir(shotsDir, { recursive: true });

    // Helper: fallback to mshots if Puppeteer navigation times out
    const mshot = async (url: string, targetViewport: string, targetFullpage: string) => {
      const viewportUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280`;
      const fullpageUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1920`;
      try {
        const [vpRes, fpRes] = await Promise.all([fetch(viewportUrl), fetch(fullpageUrl)]);
        if (vpRes.ok) {
          const buf = new Uint8Array(await vpRes.arrayBuffer());
          await fs.writeFile(targetViewport, buf);
        }
        if (fpRes.ok) {
          const buf = new Uint8Array(await fpRes.arrayBuffer());
          await fs.writeFile(targetFullpage, buf);
        }
      } catch {}
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
      ],
    });
    try {
      for (const { url } of context.pages as Array<{ url: string }>) {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
        page.setDefaultNavigationTimeout(30000);

        // Block common trackers/analytics without affecting visuals
        const trackers = [/google-analytics\.com/, /gtag\/js/, /googletagmanager\.com/, /doubleclick\.net/, /hotjar\.com/, /segment\./, /mixpanel\./, /facebook\.com\/tr/, /intercomcdn\./];
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const urlStr = req.url();
          const type = req.resourceType();
          if (trackers.some((re) => re.test(urlStr))) return req.abort();
          if (type === 'media') return req.abort();
          return req.continue();
        });

        let navigated = false;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          // short settle time for late assets
          await sleep(1200);
          navigated = true;
        } catch {
          // retry with 'load' quickly
          try {
            await page.goto(url, { waitUntil: 'load', timeout: 15000 });
            await sleep(800);
            navigated = true;
          } catch {}
        }

        // Derive domain from URL for filename
        let host = 'page';
        try { host = new URL(url).host; } catch { host = (url.replace(/^https?:\/\//, '').split('/')[0] || 'page'); }

        const vpBase = path.resolve(shotsDir, `${host}-viewport`);
        const fpBase = path.resolve(shotsDir, `${host}-fullpage`);
        const vpPath = `${vpBase}.png` as `${string}.png`;
        const fpPath = `${fpBase}.png` as `${string}.png`;

        if (navigated) {
          try {
            await page.screenshot({ path: vpPath, fullPage: false, type: 'png' });
            await page.screenshot({ path: fpPath, fullPage: true, type: 'png' });
          } catch {
            // fallback if screenshot fails
            await mshot(url, vpPath, fpPath);
          }
        } else {
          // fallback if could not navigate
          await mshot(url, vpPath, fpPath);
        }

        results.push({ url, viewport: vpPath, fullpage: fpPath });
        saved.push({ url, viewportPath: vpPath, fullpagePath: fpPath });

        await page.close();
      }
    } finally {
      await browser.close();
    }

    return { screenshots: results, saved };
  }
});


