import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UiDbSchema, type UiDb, type Page as UiPage, type Component as UiComponent, BaseUISchema, PageSchema, ComponentSchema } from '@zazos/schemas';
import { z } from 'zod';

type BaseUI = z.infer<typeof BaseUISchema>;

@Injectable()
export class FileSystemToolService {
  private getWorkspaceRoot(): string {
    return path.join(process.cwd(), '..', '..');
  }

  async pathExists(p: string): Promise<boolean> {
    try { await fs.access(p); return true; } catch { return false; }
  }

  async ensureFile(filePath: string, defaultContent: string): Promise<void> {
    try { await fs.access(filePath); return; } catch {}
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, defaultContent, 'utf8');
  }

  getUiJsonPath(namespace: string, app: string): string {
    return path.join(
      this.getWorkspaceRoot(),
      'apps',
      namespace,
      app,
      'docs',
      'ui.json'
    );
  }

  async ensureUiDbFile(filePath: string): Promise<void> {
    const emptyDb: UiDb = { components: {}, pages: {}, module_navigation: {} } as UiDb;
    await this.ensureFile(filePath, JSON.stringify(emptyDb, null, 2) + '\n');
  }

  async loadUiDb(filePath: string): Promise<UiDb> {
    try {
      await fs.access(filePath);
      const raw = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(raw);
      return UiDbSchema.parse(data);
    } catch {
      const fallback: UiDb = { components: {}, pages: {}, module_navigation: {} } as UiDb;
      return fallback;
    }
  }

  private kebabCase(input: string): string {
    return input
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .toLowerCase();
  }

  private deriveNameFromFile(filePath: string): string {
    const base = path.basename(filePath, path.extname(filePath));
    return base;
  }

  // route derivation no longer used for file_path

  private isUiLibraryImport(importPath: string): boolean {
    // Ignore shadcn/ui-like library imports
    return importPath.includes('/components/ui/');
  }

  private isRelativeImport(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  private async extractImports(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const importRegex = /import\s+[^'"\n]+from\s+['"]([^'"\n]+)['"];?/g;
      const dynamicRegex = /import\(['"]([^'"\n]+)['"]\)/g;
      const results: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) results.push(match[1]);
      while ((match = dynamicRegex.exec(content)) !== null) results.push(match[1]);
      return results;
    } catch {
      return [];
    }
  }

  private resolveImportAbsolute(importPath: string, fileDir: string): string | null {
    if (!this.isRelativeImport(importPath)) return null;
    const resolved = path.resolve(fileDir, importPath);
    return resolved;
  }

  private async resolveImportToFile(spec: string, fileDir: string, baseRoot: string): Promise<string | null> {
    // Relative: ./ or ../
    const tryPaths: string[] = [];
    if (this.isRelativeImport(spec)) {
      const abs = this.resolveImportAbsolute(spec, fileDir);
      if (abs) tryPaths.push(abs);
    } else if (spec.startsWith('@/components/') || spec.startsWith('@/pages/')) {
      // Handle @/ alias - resolve to baseRoot
      const withoutAlias = spec.replace(/^@\//, '');
      tryPaths.push(path.join(baseRoot, withoutAlias));
    } else if (spec.startsWith('components/') || spec.startsWith('pages/')) {
      tryPaths.push(path.join(baseRoot, spec));
    } else if (spec.startsWith('/components/') || spec.startsWith('/pages/')) {
      tryPaths.push(path.join(baseRoot, spec.replace(/^\//, '')));
    } else if (spec.includes('/components/') || spec.includes('/pages/')) {
      // Handle nested paths like @/components/quero/flow/...
      // Extract the part after the last occurrence of /components/ or /pages/
      const componentsMatch = spec.match(/.*\/components\/(.+)$/);
      const pagesMatch = spec.match(/.*\/pages\/(.+)$/);
      if (componentsMatch) {
        tryPaths.push(path.join(baseRoot, 'components', componentsMatch[1]));
      }
      if (pagesMatch) {
        tryPaths.push(path.join(baseRoot, 'pages', pagesMatch[1]));
      }
    } else {
      return null;
    }

    const candidates = (p: string) => [
      p,
      p + '.tsx',
      p + '.ts',
      p + '.jsx',
      p + '.js',
      path.join(p, 'index.tsx'),
      path.join(p, 'index.ts'),
      path.join(p, 'index.jsx'),
      path.join(p, 'index.js'),
    ];

    for (const base of tryPaths) {
      const list = candidates(base);
      for (const cand of list) {
        try { await fs.access(cand); return cand; } catch {}
      }
    }
    return null;
  }

  private baseUiFromFile(filePath: string, baseRoot: string): BaseUI {
    const name = this.deriveNameFromFile(filePath);
    const rel = path.relative(baseRoot, filePath).replace(/\\/g, '/');
    return { name, file_path: rel } as unknown as BaseUI;
  }

  private async collectChildComponents(filePath: string, baseRoot: string): Promise<BaseUI[]> {
    const fileDir = path.dirname(filePath);
    const imports = await this.extractImports(filePath);
    const items: BaseUI[] = [];
    const seen = new Set<string>();
    console.log(`[FileSystemTool] Collecting components for ${filePath}, found ${imports.length} imports:`, imports);
    for (const spec of imports) {
      if (this.isUiLibraryImport(spec)) {
        console.log(`[FileSystemTool] Skipping UI library import: ${spec}`);
        continue;
      }
      const picked = await this.resolveImportToFile(spec, fileDir, baseRoot);
      if (!picked) {
        console.log(`[FileSystemTool] Could not resolve import: ${spec}`);
        continue;
      }
      const rel = path.relative(baseRoot, picked).replace(/\\/g, '/');
      if (rel.includes('/components/ui/')) {
        console.log(`[FileSystemTool] Skipping UI component: ${rel}`);
        continue;
      }
      if (seen.has(rel)) {
        console.log(`[FileSystemTool] Duplicate component: ${rel}`);
        continue;
      }
      seen.add(rel);
      console.log(`[FileSystemTool] Adding component: ${spec} -> ${rel}`);
      items.push(this.baseUiFromFile(picked, baseRoot));
    }
    console.log(`[FileSystemTool] Final components for ${path.basename(filePath)}:`, items);
    return items;
  }

  async resolveRoots(namespace: string, app: string): Promise<{ appRoot: string; flowRoot: string }>{
    const base1 = path.join(this.getWorkspaceRoot(), 'apps', namespace, app);
    const base2 = path.join(this.getWorkspaceRoot(), 'apps', namespace);
    const appRoot = (await this.pathExists(base1)) ? base1 : base2;
    const directPages = await this.pathExists(path.join(appRoot, 'pages'));
    const directComponents = await this.pathExists(path.join(appRoot, 'components'));
    const flowDir = path.join(appRoot, 'flow');
    const flowPages = await this.pathExists(path.join(flowDir, 'pages'));
    const flowComponents = await this.pathExists(path.join(flowDir, 'components'));
    const flowRoot = (directPages || directComponents) ? appRoot : (flowPages || flowComponents) ? flowDir : appRoot;
    return { appRoot, flowRoot };
  }

  async listAllUiFiles(params: { namespace: string; app: string }): Promise<{ pages: string[]; components: string[]; appRoot: string; flowRoot: string }>
  {
    const { namespace, app } = params;
    const { appRoot, flowRoot } = await this.resolveRoots( namespace, app);
    const pagesDir = path.join(flowRoot, 'pages');
    const compsDir = path.join(flowRoot, 'components');
    const exts = new Set(['.tsx', '.ts', '.jsx', '.js']);
    const walk = async (dir: string): Promise<string[]> => {
      const results: string[] = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (full.includes(path.sep + 'ui' + path.sep)) continue;
            const sub = await walk(full);
            results.push(...sub);
          } else {
            const ext = path.extname(ent.name).toLowerCase();
            if (exts.has(ext)) results.push(full);
          }
        }
      } catch {}
      return results;
    };
    const pageFiles = await walk(pagesDir);
    const compFiles = await walk(compsDir);
    return { pages: pageFiles, components: compFiles, appRoot, flowRoot };
  }

  async buildUiEntryFromFile(params: { filePath: string; namespace: string; app: string }): Promise<{ kind: 'page' | 'component'; key: string; value: UiPage | UiComponent }>
  {
    const { filePath, namespace, app } = params;
    const { flowRoot } = await this.resolveRoots(namespace, app);
    const rel = path.relative(flowRoot, filePath).replace(/\\/g, '/');
    const isPage = rel.startsWith('pages/') || rel.includes('/pages/');
    const kind: 'page' | 'component' = isPage ? 'page' : 'component';
    const name = this.deriveNameFromFile(filePath);
    const pathField = rel; // file_path must be the relative file path
    const children = await this.collectChildComponents(filePath, flowRoot);
    if (kind === 'page') {
      const page: UiPage = PageSchema.parse({ name, file_path: pathField, components: children } as any);
      return { kind, key: name, value: page };
    } else {
      const comp: UiComponent = ComponentSchema.parse({ name, file_path: pathField, components: children } as any);
      return { kind, key: name, value: comp };
    }
  }
}


