import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { brandIconTool } from '../tools/brand-icon-tool';
import { brandLogoTool } from '../tools/brand-logo-tool';
import { cssTokensTool } from '../tools/css-tokens-tool';
import { screenshotsTool } from '../tools/screenshots-tool';
import { brandImagesBucketTool } from '../tools/brand-images-bucket-tool';
import { tweakcnCssTool } from '../tools/tweakcn-css-tool';

type PageInfo = {
  url: string;
  html: string;
  title?: string;
  metaDescription?: string;
  headings?: string[];
};

const normalizeDomain = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }
  return `https://${trimmed.replace(/^www\./, '').replace(/\/$/, '')}`;
};

const toOrigin = (url: string): string => {
  try { const u = new URL(url); return `${u.protocol}//${u.host}`; } catch { return url; }
};

const fetchHtml = async (url: string): Promise<PageInfo> => {
  const res = await fetch(url, { headers: { 'User-Agent': 'mastra-brand-designer/1.0' } });
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim();
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const metaDescription = (metaMatch?.[1] || ogDescMatch?.[1] || '').trim();
  const headings = Array.from(html.matchAll(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)).map((m) => m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 20);
  return { url, html, title, metaDescription, headings };
};

const findAboutUrl = (origin: string, html: string): string | undefined => {
  const anchors = Array.from(html.matchAll(/<a[^>]*href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const candidates = anchors
    .map((m) => ({ href: m[1], text: m[2].replace(/<[^>]*>/g, '').toLowerCase() }))
    .filter((a) => a.text.includes('about') || a.text.includes('sobre'))
    .map((a) => a.href);
  const normalized = candidates
    .map((href) => (href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`))
    .find((u) => u.includes('/about') || u.includes('/sobre'));
  return normalized || `${origin}/about`;
};

const inputSchema = z.object({
  domain: z.string().describe('Domínio do site, ex: zazos.com ou www.contasimples.com'),
  targetDir: z.string().optional().describe('Quando informado, salva guideline.yaml e index.css diretamente aqui'),
});

const outputSchema = z.object({
  runId: z.string(),
  runDir: z.string(),
  guideline: z.string(),
  assets: z.object({
    homepage: z.object({ url: z.string(), screenshot: z.string().optional() }),
    about: z.object({ url: z.string(), screenshot: z.string().optional() }).optional(),
    icons: z.array(z.string()).optional(),
    logos: z.array(z.string()).optional(),
    savedIconPath: z.string().optional(),
    savedLogoPaths: z.array(z.string()).optional(),
    saved: z
      .array(z.object({ url: z.string(), viewportPath: z.string().optional(), fullpagePath: z.string().optional() }))
      .optional(),
  }),
});

const collectAssets = createStep({
  id: 'collect-assets',
  description: 'Resolve domínio e busca homepage/about',
  inputSchema,
  outputSchema: z.object({
    runId: z.string(), runDir: z.string(), origin: z.string(), targetDir: z.string().optional(),
    homepage: z.custom<PageInfo>(), about: z.custom<PageInfo>().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Input data not found');
    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    // compute runId as {domain_input}_{timestamp}
    const raw = inputData.domain.trim().toLowerCase();
    const noProto = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    const safeDomain = noProto.replace(/[^a-z0-9._-]/g, '-');
    const ts = Math.floor(Date.now() / 1000); // Unix epoch seconds
    const runId = `${safeDomain}_${ts}`;
    const runDir = path.resolve(process.cwd(), 'runs', runId);
    await fs.mkdir(path.resolve(runDir, 'logo'), { recursive: true });
    await fs.mkdir(path.resolve(runDir, 'screenshots'), { recursive: true });

    const base = normalizeDomain(inputData.domain);
    const origin = toOrigin(base);
    const homepage = await fetchHtml(origin);
    const aboutUrl = findAboutUrl(origin, homepage.html);
    let about: PageInfo | undefined;
    try { if (aboutUrl) about = await fetchHtml(aboutUrl); } catch {}

    return { runId, runDir, origin, targetDir: inputData.targetDir, homepage, about };
  },
});

const useTools = createStep({
  id: 'use-tools',
  description: 'Executa ferramentas: ícone, logos, screenshots e tokens CSS',
  inputSchema: z.object({
    runId: z.string(), runDir: z.string(), origin: z.string(), targetDir: z.string().optional(),
    homepage: z.custom<PageInfo>(), about: z.custom<PageInfo>().optional(),
  }),
  outputSchema: z.object({
    runId: z.string(), runDir: z.string(), origin: z.string(), targetDir: z.string().optional(),
    homepage: z.custom<PageInfo>(), about: z.custom<PageInfo>().optional(),
    toolResults: z.object({
      icons: z.array(z.string()), savedIconPath: z.string().optional(),
      logos: z.array(z.string()), savedLogoPaths: z.array(z.string()).optional(),
      screenshots: z.array(z.object({ url: z.string(), viewport: z.string(), fullpage: z.string() })),
      saved: z.array(z.object({ url: z.string(), viewportPath: z.string().optional(), fullpagePath: z.string().optional() })).optional(),
      tokens: z.object({
        colors: z.array(z.object({ value: z.string(), name: z.string().optional() })),
        fonts: z.array(z.object({ family: z.string(), weight: z.string().optional(), source: z.string().optional() })),
        variables: z.record(z.string(), z.string()),
      }),
      imageBucket: z.object({ saved: z.array(z.string()), skipped: z.array(z.string()).optional() }).optional(),
    }),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Missing input');

    const tStart = Date.now();
    console.log(`[brand-designer] use-tools start runId=${inputData.runId} dir=${inputData.runDir}`);

    const tIconStart = Date.now();
    const iconRes = await (brandIconTool as any).execute({ context: {
      domain: inputData.origin.replace(/^https?:\/\//, ''),
      homepageHtml: inputData.homepage.html,
      origin: inputData.origin,
      runDir: inputData.runDir,
    }});
    console.log(`[brand-designer] brandIconTool done in ${Date.now() - tIconStart}ms (icons=${iconRes.icons?.length || 0})`);

    const tLogoStart = Date.now();
    const logoRes = await (brandLogoTool as any).execute({ context: {
      origin: inputData.origin,
      homepageHtml: inputData.homepage.html,
      runDir: inputData.runDir,
    }});
    console.log(`[brand-designer] brandLogoTool done in ${Date.now() - tLogoStart}ms (logos=${logoRes.logoUrls?.length || 0}, saved=${logoRes.saved?.length || 0})`);

    // Only homepage screenshots
    const pages = [{ url: inputData.homepage.url }];
    const tShotsStart = Date.now();
    const shotsRes = await (screenshotsTool as any).execute({ context: {
      pages,
      runDir: inputData.runDir,
    }});
    console.log(`[brand-designer] screenshotsTool done in ${Date.now() - tShotsStart}ms (pages=${pages.length}, saved=${shotsRes.saved?.length || 0})`);

    const tTokensStart = Date.now();
    const tokensRes = await (cssTokensTool as any).execute({ context: {
      origin: inputData.origin,
      html: inputData.homepage.html,
    }});
    const varsCount = Object.keys(tokensRes.tokens?.variables || {}).length;
    console.log(`[brand-designer] cssTokensTool done in ${Date.now() - tTokensStart}ms (colors=${tokensRes.tokens?.colors?.length || 0}, fonts=${tokensRes.tokens?.fonts?.length || 0}, vars=${varsCount})`);

    const tBucketStart = Date.now();
    const bucketRes = await (brandImagesBucketTool as any).execute({ context: {
      origin: inputData.origin,
      homepageHtml: inputData.homepage.html,
      runDir: inputData.runDir,
    }});
    console.log(`[brand-designer] brandImagesBucketTool done in ${Date.now() - tBucketStart}ms (saved=${bucketRes.saved?.length || 0})`);

    console.log(`[brand-designer] use-tools total ${Date.now() - tStart}ms`);

    return {
      runId: inputData.runId,
      runDir: inputData.runDir,
      origin: inputData.origin,
      homepage: inputData.homepage,
      about: inputData.about,
      targetDir: inputData.targetDir,
      toolResults: {
        icons: iconRes.icons || [],
        savedIconPath: iconRes.savedIconPath,
        logos: logoRes.logoUrls || [],
        savedLogoPaths: logoRes.saved,
        screenshots: shotsRes.screenshots || [],
        saved: shotsRes.saved,
        tokens: tokensRes.tokens,
        imageBucket: bucketRes,
      },
    };
  },
});

const generateGuideline = createStep({
  id: 'generate-guideline',
  description: 'Gera YAML a partir dos ativos coletados',
  inputSchema: z.object({
    runId: z.string(), runDir: z.string(), origin: z.string(), targetDir: z.string().optional(),
    homepage: z.custom<PageInfo>(), about: z.custom<PageInfo>().optional(),
    toolResults: z.object({
      icons: z.array(z.string()), savedIconPath: z.string().optional(),
      logos: z.array(z.string()), savedLogoPaths: z.array(z.string()).optional(),
      screenshots: z.array(z.object({ url: z.string(), viewport: z.string(), fullpage: z.string() })),
      saved: z.array(z.object({ url: z.string(), viewportPath: z.string().optional(), fullpagePath: z.string().optional() })).optional(),
      tokens: z.object({
        colors: z.array(z.object({ value: z.string(), name: z.string().optional() })),
        fonts: z.array(z.object({ family: z.string(), weight: z.string().optional(), source: z.string().optional() })),
        variables: z.record(z.string(), z.string()),
      }),
      imageBucket: z.object({ saved: z.array(z.string()), skipped: z.array(z.string()).optional() }).optional(),
    }),
  }),
  outputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) throw new Error('Missing input');
    const agent = mastra?.getAgent('brandDesignerAgent');
    if (!agent) throw new Error('Brand designer agent not found');

    const evidence = {
      origin: inputData.origin,
      homepage: { url: inputData.homepage.url, title: inputData.homepage.title, meta: inputData.homepage.metaDescription, headings: inputData.homepage.headings },
      about: inputData.about ? { url: inputData.about.url, title: inputData.about.title, meta: inputData.about.metaDescription, headings: inputData.about.headings } : undefined,
      screenshots: inputData.toolResults.screenshots,
      icons: inputData.toolResults.icons,
      logos: inputData.toolResults.logos,
      css_tokens: inputData.toolResults.tokens,
    };

    const prompt = `
Analise a marca a partir do domínio e evidências e produza APENAS o YAML final.

Domínio: ${inputData.origin}

Evidências:
${JSON.stringify(evidence, null, 2)}

Regras:
- NÃO inclua comentários fora do YAML.
- Responder APENAS com YAML válido, sem explicações.
- Preencher todos os campos do esquema esperado.

Esquema alvo:
\`\`\`yaml
# =========================================================
# TEMPLATE — HEX em todas as cores (8 dígitos p/ alpha)
# Compatível com tweakcn/shadcn (inclui todas as chaves vistas)
# =========================================================

branding:
  name: "<string>"
  core_concept: "<string>"
  colors:                                   # Paleta institucional (HEX; use 8 dígitos p/ alpha quando preciso)
    brand: "<#hex>"                         # Cor principal da marca (geralmente a cor mais visível no icon sem ser branco ou preto)
    brand_secondary: "<#hex>"               # Cor secundária da marca
    brand_aditional1: "<#hex>"              # Cores adicionais da marca (opcional), adicionar se necessário
    ink: "<#hex>"                           # Preto/primário institucional (logo, CTAs fortes)
    sand: "<#hex>"                          # Fundo claro predominante
    lime_soft: "<#hex>"                     # Realces suaves / marca-texto
    lime: "<#hex>"                          # Acento/CTA secundário
    text: "<#hex>"                          # Texto principal
    text_muted: "<#hex>"                    # Texto secundário
    border: "<#hex>"                        # Divisores/bordas
    danger: "<#hex>"                        # Estados de erro
  typography:
    headings: "<font-stack>"                # ex.: "Poppins, sans-serif"
    body: "<font-stack>"                    # ex.: "Inter, sans-serif"
  brand_uniqueness:                         # 3–5 elementos visuais ou estruturas que trazem identidade única à marca. Por exemplo misturar fontes, usar um tipo de ícone, elementos visuais, etc. Aqueles detalhes que quebram o padrão e deixam a marca única.
    - "<string>"
    - "<string>"
    - "<string>"
  directives:                               # Regras curtas de uso
    - "<string>"
    - "<string>"
  default_mode: "light|dark"

ui:
  # Dica: se quiser definir globais, replique em light/dark também.
  radius: "<px>"

  tweakcn:
    light:
      # Paleta UI
      background: "<#hex>"
      foreground: "<#hex>"
      card: "<#hex>"
      card-foreground: "<#hex>"
      popover: "<#hex>"
      popover-foreground: "<#hex>"
      primary: "<#hex>"
      primary-foreground: "<#hex>"
      secondary: "<#hex>"
      secondary-foreground: "<#hex>"
      muted: "<#hex>"
      muted-foreground: "<#hex>"
      accent: "<#hex>"
      accent-foreground: "<#hex>"
      destructive: "<#hex>"
      destructive-foreground: "<#hex>"
      border: "<#hex>"
      input: "<#hex>"
      ring: "<#hex>"

      # Charts
      chart-1: "<#hex>"
      chart-2: "<#hex>"
      chart-3: "<#hex>"
      chart-4: "<#hex>"
      chart-5: "<#hex>"

      # Sidebar
      sidebar: "<#hex>"
      sidebar-foreground: "<#hex>"
      sidebar-primary: "<#hex>"
      sidebar-primary-foreground: "<#hex>"
      sidebar-accent: "<#hex>"
      sidebar-accent-foreground: "<#hex>"
      sidebar-border: "<#hex>"
      sidebar-ring: "<#hex>"

      # Tipografia/spacing overrides por modo (tweakcn usa em vários temas)
      font-sans: "<font-stack>"
      font-serif: "<font-stack>"
      font-mono: "<font-stack>"
      tracking-normal: "0em"
      letter-spacing: "0em"
      spacing: "0.25rem"

      # Sombra (tokens atômicos)
      shadow-color: "<#hexAA>"
      shadow-opacity: "0.10"
      shadow-blur: "4px"
      shadow-spread: "0px"
      shadow-offset-x: "0px"
      shadow-offset-y: "2px"

      # Sombra (presets prontos)
      shadow-2xs: "0px 1px 2px 0px <#hexAA>"
      shadow-xs:  "0px 1px 2px 0px <#hexAA>"
      shadow-sm:  "0px 2px 4px -1px <#hexAA>, 0px 1px 2px 0px <#hexAA>"
      shadow:     "0px 2px 4px -1px <#hexAA>, 0px 1px 3px 0px <#hexAA>"
      shadow-md:  "0px 4px 6px -1px <#hexAA>, 0px 2px 4px 0px <#hexAA>"
      shadow-lg:  "0px 10px 15px -3px <#hexAA>, 0px 4px 6px -2px <#hexAA>"
      shadow-xl:  "0px 20px 25px -5px <#hexAA>, 0px 10px 10px -5px <#hexAA>"
      shadow-2xl: "0px 25px 50px -12px <#hexAA>"

      radius: "<px>"

    dark:
      background: "<#hex>"
      foreground: "<#hex>"
      card: "<#hex>"
      card-foreground: "<#hex>"
      popover: "<#hex>"
      popover-foreground: "<#hex>"
      primary: "<#hex>"
      primary-foreground: "<#hex>"
      secondary: "<#hex>"
      secondary-foreground: "<#hex>"
      muted: "<#hex>"
      muted-foreground: "<#hex>"
      accent: "<#hex>"
      accent-foreground: "<#hex>"
      destructive: "<#hex>"
      destructive-foreground: "<#hex>"
      border: "<#hex>"
      input: "<#hex>"
      ring: "<#hex>"

      chart-1: "<#hex>"
      chart-2: "<#hex>"
      chart-3: "<#hex>"
      chart-4: "<#hex>"
      chart-5: "<#hex>"

      sidebar: "<#hex>"
      sidebar-foreground: "<#hex>"
      sidebar-primary: "<#hex>"
      sidebar-primary-foreground: "<#hex>"
      sidebar-accent: "<#hex>"
      sidebar-accent-foreground: "<#hex>"
      sidebar-border: "<#hex>"
      sidebar-ring: "<#hex>"

      font-sans: "<font-stack>"
      font-serif: "<font-stack>"
      font-mono: "<font-stack>"
      tracking-normal: "0em"
      letter-spacing: "0em"
      spacing: "0.25rem"

      shadow-color: "<#hexAA>"
      shadow-opacity: "0.12"
      shadow-blur: "6px"
      shadow-spread: "0px"
      shadow-offset-x: "0px"
      shadow-offset-y: "4px"

      shadow-2xs: "0px 1px 2px 0px <#hexAA>"
      shadow-xs:  "0px 1px 2px 0px <#hexAA>"
      shadow-sm:  "0px 2px 4px -1px <#hexAA>, 0px 1px 2px 0px <#hexAA>"
      shadow:     "0px 2px 4px -1px <#hexAA>, 0px 1px 3px 0px <#hexAA>"
      shadow-md:  "0px 4px 6px -1px <#hexAA>, 0px 2px 4px 0px <#hexAA>"
      shadow-lg:  "0px 10px 15px -3px <#hexAA>, 0px 4px 6px -2px <#hexAA>"
      shadow-xl:  "0px 20px 25px -5px <#hexAA>, 0px 10px 10px -5px <#hexAA>"
      shadow-2xl: "0px 25px 50px -12px <#hexAA>"

      radius: "<px>"
\`\`\`

Exemplo de YAML:
\`\`\`yaml
# =========================================================
# EXEMPLO — Conta Simples (HEX; pronto para conversão p/ OKLCH)
# =========================================================

branding:
  name: "Conta Simples"
  core_concept: "Simplicidade com controle — clareza financeira sem fricção"
  colors:
    brand: "#000000"
    brand_secondary: "#B0FF6C"
    brand_aditional1: "#DFFFB1"
    ink: "#000000"
    sand: "#FAF9F5"
    lime_soft: "#DFFFB1"
    lime: "#B0FF6C"
    text: "#111111"
    text_muted: "#4A4A4A"
    border: "#EAEAEA"
    danger: "#E53935"
  typography:
    headings: "Poppins, sans-serif"
    body: "Inter, sans-serif"
  brand_unique_twist:
    - "Botões pill em preto (ink) + variante lime; micro animações discretas."
    - "Marca-texto com pastilhas lime_soft atrás de palavras-chave."
    - "Ícones flat geométricos com toques lime."
    - "Cards claros, muito respiro; Poppins 600 nos títulos, Inter 400 no corpo."
  directives:
    - "Base clara sand; lime como acento pontual."
    - "CTAs primários em ink; secundários em lime."
    - "Sem gradientes; contraste direto e legível."
  default_mode: "light"

ui:
  radius: "16px"

  tweakcn:
    light:
      background: "#FAF9F5"
      foreground: "#111111"
      card: "#FFFFFF"
      card-foreground: "#111111"
      popover: "#FFFFFF"
      popover-foreground: "#111111"
      primary: "#000000"
      primary-foreground: "#FAF9F5"
      secondary: "#DFFFB1"
      secondary-foreground: "#111111"
      muted: "#F4F1EA"
      muted-foreground: "#4A4A4A"
      accent: "#B0FF6C"
      accent-foreground: "#111111"
      destructive: "#E53935"
      destructive-foreground: "#FFFFFF"
      border: "#EAEAEA"
      input: "#E0E0E0"
      ring: "#B0FF6C"

      chart-1: "#B0FF6C"
      chart-2: "#29B6B6"
      chart-3: "#4C7DFF"
      chart-4: "#9A51E0"
      chart-5: "#FF6B5B"

      sidebar: "#FFFFFF"
      sidebar-foreground: "#111111"
      sidebar-primary: "#000000"
      sidebar-primary-foreground: "#FAF9F5"
      sidebar-accent: "#DFFFB1"
      sidebar-accent-foreground: "#111111"
      sidebar-border: "#EAEAEA"
      sidebar-ring: "#B0FF6C"

      font-sans: "Inter, sans-serif"
      font-serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif"
      font-mono: "Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
      tracking-normal: "0em"
      letter-spacing: "0em"
      spacing: "0.25rem"

      shadow-color: "#000000"
      shadow-opacity: "0.10"
      shadow-blur: "4px"
      shadow-spread: "0px"
      shadow-offset-x: "0px"
      shadow-offset-y: "2px"

      shadow-2xs: "0px 1px 2px 0px #0000000D"
      shadow-xs:  "0px 1px 2px 0px #0000000D"
      shadow-sm:  "0px 2px 4px -1px #0000001F, 0px 1px 2px 0px #00000014"
      shadow:     "0px 2px 4px -1px #0000001F, 0px 1px 3px 0px #00000014"
      shadow-md:  "0px 4px 6px -1px #0000001F, 0px 2px 4px 0px #00000014"
      shadow-lg:  "0px 10px 15px -3px #00000024, 0px 4px 6px -2px #0000001A"
      shadow-xl:  "0px 20px 25px -5px #00000026, 0px 10px 10px -5px #0000001F"
      shadow-2xl: "0px 25px 50px -12px #00000040"

      radius: "16px"

    dark:
      background: "#0D14
\`\`\`
`;

    const response = await agent.stream([{ role: 'user', content: prompt }]);
    let yaml = '';
    for await (const chunk of response.textStream) { process.stdout.write(chunk); yaml += chunk; }

    // sanitize: remove code fences like ```yaml ... ``` from the output
    const sanitizeYaml = (raw: string): string => {
      let out = raw.trim();
      if (out.startsWith('```')) {
        out = out.replace(/^```[^\n]*\n/, '');
        out = out.replace(/\n```\s*$/, '');
      }
      return out.trim();
    };
    const cleanYaml = sanitizeYaml(yaml);

    const path = await import('node:path');
    const fs = await import('node:fs/promises');
    const guidelinePath = path.resolve(inputData.runDir, 'guideline.yaml');
    await fs.writeFile(guidelinePath, cleanYaml, 'utf-8');
    if (inputData.targetDir) {
      try {
        await fs.mkdir(inputData.targetDir, { recursive: true });
        await fs.writeFile(path.resolve(inputData.targetDir, 'guideline.yaml'), cleanYaml, 'utf-8');
      } catch (_e) {}
    }

    const homepageShot = inputData.toolResults.screenshots.find((s) => s.url === inputData.homepage.url);

    return {
      runId: inputData.runId,
      runDir: inputData.runDir,
      guideline: cleanYaml,
      assets: {
        homepage: { url: inputData.homepage.url, screenshot: homepageShot?.viewport },
        about: inputData.about ? { url: inputData.about.url, screenshot: undefined } : undefined,
        icons: inputData.toolResults.icons,
        logos: inputData.toolResults.logos,
        savedIconPath: inputData.toolResults.savedIconPath,
        savedLogoPaths: inputData.toolResults.savedLogoPaths,
        saved: inputData.toolResults.saved,
      },
    };
  },
});

const assetsSchema = z.object({
  homepage: z.object({ url: z.string(), screenshot: z.string().optional() }),
  about: z.object({ url: z.string(), screenshot: z.string().optional() }).optional(),
  icons: z.array(z.string()).optional(),
  logos: z.array(z.string()).optional(),
  savedIconPath: z.string().optional(),
  savedLogoPaths: z.array(z.string()).optional(),
  saved: z
    .array(z.object({ url: z.string(), viewportPath: z.string().optional(), fullpagePath: z.string().optional() }))
    .optional(),
});

const generateCss = createStep({
  id: 'generate-css',
  description: 'Gera index.css (tema tweakcn) a partir do guideline salvo',
  inputSchema: z.object({
    runId: z.string(),
    runDir: z.string(),
    targetDir: z.string().optional(),
    guideline: z.string(),
    assets: assetsSchema,
  }),
  outputSchema: z.object({
    runId: z.string(),
    runDir: z.string(),
    guideline: z.string(),
    assets: assetsSchema,
    cssPath: z.string(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) throw new Error('Missing input');
    const res = await (tweakcnCssTool as any).execute({ context: { runDir: inputData.runDir } });
    return { ...inputData, cssPath: res.cssPath };
  },
});

const persistToCustomerDir = createStep({
  id: 'persist-to-customer-dir',
  description: 'Copia todos os arquivos do run para o diretório do cliente (branding/)',
  inputSchema: z
    .object({
      runId: z.string(),
      runDir: z.string(),
      targetDir: z.string().optional(),
      guideline: z.string(),
      assets: assetsSchema,
      cssPath: z.string(),
    })
    .passthrough(),
  outputSchema: z
    .object({
      targetDir: z.string().optional(),
    })
    .passthrough(),
  execute: async ({ inputData }) => {
    if (!inputData?.targetDir) return { ...inputData };

    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    try {
      // Garante diretório destino
      await fs.mkdir(inputData.targetDir, { recursive: true });

      // Copia tudo que foi gerado na run (guideline.yaml, index.css, logo/, screenshots/, images-bucket/)
      // Observação: index.css já pode ter sido salvo; cp garante overwrite quando necessário
      // fs.cp está disponível em Node >=16.7
      // Caso falhe, tentamos copiar diretórios principais manualmente
      try {
        await (fs as any).cp(inputData.runDir, inputData.targetDir, { recursive: true, force: true });
      } catch (_cpErr) {
        const items = ['guideline.yaml', 'index.css', 'logo', 'screenshots', 'images-bucket'];
        for (const item of items) {
          const src = path.resolve(inputData.runDir, item);
          const dst = path.resolve(inputData.targetDir, item);
          try {
            // best-effort copy
            await fs.stat(src);
            try {
              await (fs as any).cp(src, dst, { recursive: true, force: true });
            } catch {
              // fallback: attempt file copy
              try { await fs.copyFile(src as any, dst as any); } catch {}
            }
          } catch {}
        }
      }
    } catch (_e) {}

    return { ...inputData };
  },
});

const brandDesignerWorkflow = createWorkflow({ id: 'brand-designer-workflow', inputSchema, outputSchema })
  .then(collectAssets)
  .then(useTools)
  .then(generateGuideline)
  .then(generateCss)
  .then(persistToCustomerDir);

brandDesignerWorkflow.commit();

export { brandDesignerWorkflow };


