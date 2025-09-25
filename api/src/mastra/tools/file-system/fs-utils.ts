/**
 * fs-utils — Shared path resolution and validation helpers for @tools/
 *
 * What it provides
 * - Area/Location schemas to scope edits (pages/components/navigation)
 * - Workspace root detection under Studio API
 * - Resolution of OS paths for a given customer/namespace/app (or projectPath)
 * - Guards: extension allow-list and base directory checks
 *
 * Usage notes
 * - Use resolveIdentifiers to derive ids from projectPath (/apps/{namespace}/{app})
 * - Use resolveOsAppPaths to get web/backend/supabase directories for an app
 * - Use buildTargetPath to construct final file paths safely
 */
import { z } from 'zod';

export const AreaSchema = z.enum(['data', 'pages', 'automations', 'documentation']);

export const LocationSchema = z.enum(['pages', 'components', 'navigation']);

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9_\-]+$/, 'Somente letras, números, _ e - são permitidos');

export const AllowedExtensionSchema = z.enum(['.js', '.jsx', '.ts']);

export type ToolArea = z.infer<typeof AreaSchema>;

export type ToolLocation = z.infer<typeof LocationSchema>;

export const getWorkspaceRoot = async (): Promise<string> => {
  const path = await import('node:path');
  const envRoot = process.env.MASTRA_WORKSPACE_ROOT;
  if (envRoot && String(envRoot).trim().length > 0) {
    return path.resolve(String(envRoot));
  }
  // API CWD is expected at studio/api
  // Go two levels up to repo root
  return path.resolve(process.cwd(), '../../');
};

export const resolvePagesBaseDir = async (
  customer: string,
  namespace: string,
  app: string,
  location: ToolLocation
): Promise<string> => {
  const path = await import('node:path');
  const root = await getWorkspaceRoot();
  const subDir =
    location === 'pages'
      ? 'pages'
      : location === 'components'
      ? 'components'
      : 'navigation';
  // For pages, use camel_name from appConfig.json (fallback to app)
  let appSegment = app;
  if (location === 'pages') {
    try {
      const { appPath } = await resolveAppConfigCamelName(customer, namespace, app);
      appSegment = appPath || app;
    } catch {
      appSegment = app;
    }
  }
  const computed = path.resolve(
    root,
    'preview_customers',
    customer,
    'web',
    'src',
    subDir,
    namespace,
    appSegment
  );
  try { console.log('[fs-utils.resolvePagesBaseDir] base:', computed); } catch {}
  return computed;
};

export const ensureWithinBase = async (baseDir: string, target: string): Promise<void> => {
  const path = await import('node:path');
  const resolved = path.resolve(baseDir, target);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('Acesso negado: caminho fora do diretório permitido');
  }
};

export const assertAllowedExtension = (fileName: string) => {
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  if (!['.js', '.jsx', '.ts'].includes(ext)) {
    throw new Error('Extensão não permitida. Use .js, .jsx ou .ts');
  }
};

export const buildTargetPath = async (
  area: ToolArea,
  customer: string,
  namespace: string,
  app: string,
  location: ToolLocation,
  relativeFilePath: string
): Promise<string> => {
  if (area !== 'pages') {
    console.log('[fs-utils.buildTargetPath] non-pages area received:', area);
  }
  const baseDir = await resolvePagesBaseDir(customer, namespace, app, location);
  await ensureWithinBase(baseDir, relativeFilePath);
  const path = await import('node:path');
  const target = path.resolve(baseDir, relativeFilePath);
  console.log('[fs-utils.buildTargetPath] target:', target);
  return target;
};


// =============================
// OS/App mapping (centralizado)
// =============================

export type OsAppPaths = {
  customerRoot: string; // preview_customers/{customer}
  appConfigPath: string; // apps/{namespace}/{app}/appConfig.json
  namespace: string;
  app: string;
  appPath: string; // camel_name (fallback: app)
  schemaName: string; // conforme regras do compiler.sh
  // web
  web: {
    root: string; // web
    pagesDir: string; // web/src/pages/{namespace}/{appPath}
    layoutPath: string; // web/src/pages/{namespace}/{appPath}/layout.jsx
    componentsDir: string; // web/src/components/{namespace}/{app}
    navigationFile: string; // web/src/navigation/{namespace}_{app}.js
    entitiesFile: string; // web/src/api/entities/{app}.ts
  };
  // backend
  backend: {
    root: string; // backend
    controllersDir: string; // backend/src/api-web/{namespace}/{app}
  };
  // supabase
  supabase: {
    root: string; // supabase
    migrationsDir: string; // supabase/migrations
    seedDir: string; // supabase/seed/{namespace}/{app}
    functionsAppDir: string; // supabase/functions/app-{namespace}-{app}
    functionsRoutersDir: string; // supabase/functions
  };
};

export const getCustomerRoot = async (customer: string): Promise<string> => {
  const path = await import('node:path');
  const root = await getWorkspaceRoot();
  return path.resolve(root, 'preview_customers', customer);
};

export const resolveAppConfigCamelName = async (
  customer: string,
  namespace: string,
  app: string
): Promise<{ appPath: string; appConfigPath: string }> => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  const appConfigPath = path.resolve(customerRoot, 'apps', namespace, app, 'appConfig.json');
  let appPath = app;
  try {
    const raw = await fs.readFile(appConfigPath, 'utf8');
    const json = JSON.parse(raw);
    if (typeof json.camel_name === 'string' && json.camel_name.trim().length > 0) {
      appPath = json.camel_name;
    }
    console.log('[fs-utils.resolveAppConfigCamelName] loaded camel_name:', { appPath, appConfigPath });
  } catch {
    // keep fallback
  }
  return { appPath, appConfigPath };
};

export const computeSchemaName = (namespace: string, app: string): string => {
  if (namespace === 'core') return 'public';
  if (namespace === 'quero' && app === 'flow') return 'quero_flow';
  return `${namespace}_${app}`;
};

export const resolveOsAppPaths = async (
  customer: string,
  namespace: string,
  app: string
): Promise<OsAppPaths> => {
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  const { appPath, appConfigPath } = await resolveAppConfigCamelName(customer, namespace, app);
  const schemaName = computeSchemaName(namespace, app);

  const webRoot = path.resolve(customerRoot, 'web');
  const backendRoot = path.resolve(customerRoot, 'backend');
  const supabaseRoot = path.resolve(customerRoot, 'supabase');

  return {
    customerRoot,
    appConfigPath,
    namespace,
    app,
    appPath,
    schemaName,
    web: {
      root: webRoot,
      pagesDir: path.resolve(webRoot, 'src', 'pages', namespace, appPath),
      layoutPath: path.resolve(webRoot, 'src', 'pages', namespace, appPath, 'layout.jsx'),
      componentsDir: path.resolve(webRoot, 'src', 'components', namespace, app),
      navigationFile: path.resolve(webRoot, 'src', 'navigation', `${namespace}_${app}.js`),
      entitiesFile: path.resolve(webRoot, 'src', 'api', 'entities', `${app}.ts`),
    },
    backend: {
      root: backendRoot,
      controllersDir: path.resolve(backendRoot, 'src', 'api-web', namespace, app),
    },
    supabase: {
      root: supabaseRoot,
      migrationsDir: path.resolve(supabaseRoot, 'migrations'),
      seedDir: path.resolve(supabaseRoot, 'seed', namespace, app),
      functionsAppDir: path.resolve(supabaseRoot, 'functions', `app-${namespace}-${app}`),
      functionsRoutersDir: path.resolve(supabaseRoot, 'functions'),
    },
  };
};

export const resolveIdentifiers = (
  customer: string | undefined,
  namespace: string | undefined,
  app: string | undefined,
  projectPath?: string
): { customer: string; namespace: string; app: string } => {
  let ns = namespace && namespace.trim().length > 0 ? namespace : undefined;
  let a = app && app.trim().length > 0 ? app : undefined;
  let cust = customer && customer.trim().length > 0 ? customer : undefined;

  if ((!ns || !a) && projectPath) {
    const parts = projectPath.split('/').filter(Boolean);
    const idx = parts.indexOf('apps');
    if (idx >= 0 && parts.length >= idx + 3) {
      ns = ns || parts[idx + 1];
      a = a || parts[idx + 2];
    }
  }
  if (!cust && ns) {
    cust = ns;
  }
  if (!cust || !ns || !a) {
    throw new Error('Parâmetros insuficientes: informe customer, namespace e app, ou projectPath=/apps/{namespace}/{app}');
  }
  return { customer: cust, namespace: ns, app: a };
};


// =============================
// Path standardization helpers
// =============================

export const toOsPathFromFull = async (fullPath: string, customer: string): Promise<string> => {
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  const rel = path.relative(customerRoot, fullPath).replace(/\\/g, '/');
  return rel;
};

export const toAppPathFromFull = async (fullPath: string, customer: string): Promise<string> => {
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  const appsRoot = path.resolve(customerRoot, 'apps');
  const rel = path.relative(appsRoot, fullPath).replace(/\\/g, '/');
  return rel;
};

export const toFullPathFromOsPath = async (customer: string, osPath: string): Promise<string> => {
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  return path.resolve(customerRoot, osPath);
};

export const toFullPathFromAppPath = async (customer: string, appPath: string): Promise<string> => {
  const path = await import('node:path');
  const customerRoot = await getCustomerRoot(customer);
  return path.resolve(customerRoot, 'apps', appPath);
};

export const resolveFullPathFromAny = async (
  customer: string,
  opts: { osPath?: string; appPath?: string; fullPath?: string }
): Promise<{ fullPath: string; osPath: string; appPath: string }> => {
  const { osPath, appPath, fullPath } = opts;
  if (!customer) throw new Error('customer é obrigatório');
  const provided = [Boolean(osPath), Boolean(appPath), Boolean(fullPath)].filter(Boolean).length;
  if (provided !== 1) {
    throw new Error('Informe exatamente um dos caminhos: osPath, appPath ou fullPath');
  }
  if (fullPath) {
    const os = await toOsPathFromFull(fullPath, customer);
    const app = await toAppPathFromFull(fullPath, customer);
    return { fullPath, osPath: os, appPath: app };
  }
  if (osPath) {
    const full = await toFullPathFromOsPath(customer, osPath);
    const app = await toAppPathFromFull(full, customer);
    return { fullPath: full, osPath, appPath: app };
  }
  // appPath
  const full = await toFullPathFromAppPath(customer, appPath as string);
  const os = await toOsPathFromFull(full, customer);
  return { fullPath: full, osPath: os, appPath: appPath as string };
};


