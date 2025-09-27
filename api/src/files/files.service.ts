import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { SaveFileDto } from './dto/save-file.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilesService {
  private readonly basePath = path.join(process.cwd(), '..', '..');

  async saveFile(saveFileDto: SaveFileDto) {
    const { namespace, app, relativePath, content } = saveFileDto;

    // Decide target root based on file type and relative path (gradual migration per APP_EDITOR_RULES)
    const normalizedRelPath = relativePath.replace(/^\.\/+/, '');
    const ext = path.extname(normalizedRelPath).toLowerCase();
    const isCodeFile = ['.js', '.jsx', '.ts', '.tsx'].includes(ext);

    let fullPath: string;
    if (normalizedRelPath.startsWith('data/migrations/')) {
      // Write into supabase migrations (filter is handled on read-tree; here we allow editing any selected file)
      const fileName = normalizedRelPath.replace(/^data\/migrations\//, '');
      fullPath = path.join(
        this.basePath,
        'supabase',
        'migrations',
        fileName,
      );
    } else if (normalizedRelPath.startsWith('data/seed/')) {
      // Write into supabase seed/{namespace}/{app}
      const rest = normalizedRelPath.replace(/^data\/seed\//, '');
      fullPath = path.join(
        this.basePath,
        'supabase',
        'seed',
        namespace,
        app,
        rest,
      );
    } else if (normalizedRelPath.startsWith('automations/app/')) {
      const rest = normalizedRelPath.replace(/^automations\/app\//, '');
      fullPath = path.join(
        this.basePath,
        'supabase',
        'functions',
        `app-${namespace}-${app}`,
        rest,
      );
    } else if (normalizedRelPath.startsWith('automations/router-on-user-events/')) {
      const rest = normalizedRelPath.replace(/^automations\/router-on-user-events\//, '');
      fullPath = path.join(
        this.basePath,
        'supabase',
        'functions',
        'router-on-user-events',
        `app-${namespace}-${app}`,
        rest,
      );
    } else if (isCodeFile) {
      const rel = normalizedRelPath.replace(/\\/g, '/');
      if (rel.startsWith('pages/')) {
        // Save Pages to web/src/pages/{namespace}/{app}/...
        const rest = rel.replace(/^pages\//, '');
        fullPath = path.join(
          this.basePath,
          'web',
          'src',
          'pages',
          namespace,
          app,
          rest,
        );
      } else if (rel.startsWith('components/')) {
        // Save Components to web/src/components/{namespace}/{app}/...
        const rest = rel.replace(/^components\//, '');
        fullPath = path.join(
          this.basePath,
          'web',
          'src',
          'components',
          namespace,
          app,
          rest,
        );
      } else if (rel.startsWith('navigation/')) {
        // Save Navigation under web/src/navigation (flat). Expected file: `${namespace}_${app}.js`
        const rest = rel.replace(/^navigation\//, '');
        fullPath = path.join(
          this.basePath,
          'web',
          'src',
          'navigation',
          rest,
        );
      } else if (rel.startsWith('controllers/')) {
        // Save Controllers to backend/src/api-web/{namespace}/{app}/...
        const rest = rel.replace(/^controllers\//, '');
        fullPath = path.join(
          this.basePath,
          'backend',
          'src',
          'api-web',
          namespace,
          app,
          rest,
        );
      } else {
        // Default: keep under apps for other code for now
        fullPath = path.join(
          this.basePath,
          'apps',
          namespace,
          app,
          normalizedRelPath,
        );
      }
    } else {
      // Non-code files (docs, json, etc) stay under /apps
      fullPath = path.join(
        this.basePath,
        'apps',
        namespace,
        app,
        normalizedRelPath,
      );
    }

    // Validate that the path is within the allowed directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedBasePath = path.resolve(this.basePath);
    
    if (!resolvedPath.startsWith(resolvedBasePath)) {
      throw new BadRequestException('Invalid file path - outside allowed directory');
    }

    try {
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Write file
      await fs.promises.writeFile(fullPath, content, 'utf8');

      return {
        success: true,
        message: 'File saved successfully',
        action: {
          content,
        },
        fullPath: resolvedPath,
      };
    } catch (error) {
      console.error('Error saving file:', error);
      throw new InternalServerErrorException('Failed to save file');
    }
  }

  async getFileTree(namespace: string, app: string, subPath?: string) {
    const appsBase = path.join(this.basePath, 'apps', namespace, app);
    const pagesBase = path.join(this.basePath, 'web', 'src', 'pages', namespace, app);
    const componentsBase = path.join(this.basePath, 'web', 'src', 'components', namespace, app);
    // Navigation is a flat directory with files like `${namespace}_${app}.js`
    const navigationDir = path.join(this.basePath, 'web', 'src', 'navigation');
    // Supabase roots
    const supabaseBase = path.join(this.basePath, 'supabase');
    const migrationsDir = path.join(supabaseBase, 'migrations');
    const seedBaseDir = path.join(supabaseBase, 'seed', namespace, app);
    const functionsAppDir = path.join(supabaseBase, 'functions', `app-${namespace}-${app}`);
    const functionsRouterUserDir = path.join(supabaseBase, 'functions', 'router-on-user-events', `app-${namespace}-${app}`);
    const controllersBase = path.join(this.basePath, 'backend', 'src', 'api-web', namespace, app);

    const rel = (subPath || '').replace(/^\.\/+/, '').replace(/\\/g, '/');

    // If navigating inside known code roots, build from new locations and prefix paths
    const buildPrefixed = async (baseDir: string, prefix: string) => {
      try {
        await fs.promises.access(baseDir);
      } catch {
        // Directory not present yet
        return {
          name: prefix,
          type: 'directory',
          path: prefix,
          children: [],
        };
      }

      const dirTree = await this.buildFileTree(baseDir, baseDir);
      const prefixChildrenPaths = (node: any, pfx: string) => {
        if (!node) return node;
        if (node.type === 'directory') {
          return {
            ...node,
            // For children of this dir, prefix their paths; skip prefixing '.' at root by mapping children only
            children: (node.children || []).map((child: any) => prefixChildrenPaths(child, pfx)).map((n: any) => ({
              ...n,
              path: n.path === '.' ? pfx : `${pfx}/${n.path}`,
            })),
          };
        }
        return node;
      };

      const prefixedChildren = prefixChildrenPaths(dirTree, prefix)?.children || [];
      return {
        name: prefix,
        type: 'directory',
        path: prefix,
        children: prefixedChildren,
      };
    };

    try {
      if (rel === 'pages' || rel.startsWith('pages/')) {
        const tree = await buildPrefixed(pagesBase, 'pages');
        return { tree };
      }
      if (rel === 'components' || rel.startsWith('components/')) {
        const tree = await buildPrefixed(componentsBase, 'components');
        return { tree };
      }
      if (rel === 'navigation' || rel.startsWith('navigation/')) {
        // List navigation files; prefer `${namespace}_${app}.js`, but include related files as fallback
        let children: any[] = [];
        try {
          const items = await fs.promises.readdir(navigationDir).catch(() => [] as string[]);
          const target = `${namespace}_${app}.js`;
          const jsFiles = (items || []).filter((f: any) => typeof f === 'string' && f.endsWith('.js')) as string[];
          const exact = jsFiles.find((f) => f === target);
          if (exact) {
            children = [{ name: exact, type: 'file', path: `navigation/${exact}` }];
          } else {
            const related = jsFiles.filter((f) => f.startsWith(`${namespace}_`) || f.endsWith(`_${app}.js`));
            children = related.map((f) => ({ name: f, type: 'file', path: `navigation/${f}` }));
          }
        } catch {}
        return {
          tree: {
            name: 'navigation',
            type: 'directory',
            path: 'navigation',
            children,
          },
        };
      }
      if (rel === 'controllers' || rel.startsWith('controllers/')) {
        const tree = await buildPrefixed(controllersBase, 'controllers');
        return { tree };
      }
      if (rel === 'data') {
        const migrationChildren = [];
        try {
          const allMigrations = await fs.promises.readdir(migrationsDir);
          const schemaIdentifier = `__${namespace}_${app}__`;
          const relevantMigrations = allMigrations.filter(f => f.includes(schemaIdentifier) && f.endsWith('.sql'));
          for (const migrationFile of relevantMigrations) {
            migrationChildren.push({
              name: migrationFile,
              type: 'file',
              path: `data/migrations/${migrationFile}`
            });
          }
        } catch (e) { /* migrations dir might not exist */ }

        const seedTree = await buildPrefixed(seedBaseDir, 'data/seed');

        return {
          tree: {
            name: 'data',
            type: 'directory',
            path: 'data',
            children: [
              { name: 'migrations', type: 'directory', path: 'data/migrations', children: migrationChildren },
              { name: 'seed', type: 'directory', path: seedTree.path, children: seedTree.children || [] }
            ]
          }
        };
      }

      if (rel === 'automations') {
        const appTree = await buildPrefixed(functionsAppDir, 'automations/app');
        const routerTree = await buildPrefixed(functionsRouterUserDir, 'automations/router-on-user-events');

        return {
          tree: {
            name: 'automations',
            type: 'directory',
            path: 'automations',
            children: [
              { name: 'app', type: 'directory', path: appTree.path, children: appTree.children || [] },
              { name: 'router-on-user-events', type: 'directory', path: routerTree.path, children: routerTree.children || [] }
            ]
          }
        };
      }


      // Root (or other folders) → merge new locations under a virtual root, keep docs/json in /apps
      await fs.promises.access(appsBase);
      const appsTree = await this.buildFileTree(appsBase, appsBase);

      // Filter out code directories from /apps root to avoid duplicates
      const excluded = new Set(['pages', 'components', 'navigation', 'controllers']);
      const filteredAppChildren = (appsTree.children || []).filter((c: any) => !excluded.has(c.name));

      const [pagesTree, componentsTree, controllersTree] = await Promise.all([
        buildPrefixed(pagesBase, 'pages'),
        buildPrefixed(componentsBase, 'components'),
        buildPrefixed(controllersBase, 'controllers'),
      ]);
      // Build navigation node; prefer `${namespace}_${app}.js`, include related files as fallback
      let navigationTree: any = {
        name: 'navigation',
        type: 'directory',
        path: 'navigation',
        children: [],
      };
      try {
        const items = await fs.promises.readdir(navigationDir).catch(() => [] as string[]);
        const target = `${namespace}_${app}.js`;
        const jsFiles = (items || []).filter((f: any) => typeof f === 'string' && f.endsWith('.js')) as string[];
        const exact = jsFiles.find((f) => f === target);
        if (exact) {
          navigationTree.children = [{ name: exact, type: 'file', path: `navigation/${exact}` }];
        } else {
          const related = jsFiles.filter((f) => f.startsWith(`${namespace}_`) || f.endsWith(`_${app}.js`));
          navigationTree.children = related.map((f) => ({ name: f, type: 'file', path: `navigation/${f}` }));
        }
      } catch {}

      const mergedChildren = [
        ...filteredAppChildren,
        pagesTree,
        componentsTree,
        navigationTree,
        controllersTree,
      ].filter(Boolean).sort((a: any, b: any) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const mergedRoot = {
        name: path.basename(appsBase),
        type: 'directory',
        path: '.',
        children: mergedChildren,
      };

      return { tree: mergedRoot };
    } catch (error) {
      console.error('Error reading file tree:', error);
      throw new InternalServerErrorException('Failed to read file tree');
    }
  }

  async getFileContent(namespace: string, app: string, relativePath: string) {
    const normalizedRelPath = relativePath.replace(/^\.\/+/, '').replace(/\\/g, '/');
    const ext = path.extname(normalizedRelPath).toLowerCase();
    const isCodeFile = ['.js', '.jsx', '.ts', '.tsx'].includes(ext);

    // Build candidate paths (new locations first), then fallback to /apps
    const candidates: string[] = [];
    if (normalizedRelPath.startsWith('data/migrations/')) {
      const fileName = normalizedRelPath.replace(/^data\/migrations\//, '');
      candidates.push(path.join(this.basePath, 'supabase', 'migrations', fileName));
    } else if (normalizedRelPath.startsWith('data/seed/')) {
      const rest = normalizedRelPath.replace(/^data\/seed\//, '');
      candidates.push(path.join(this.basePath, 'supabase', 'seed', namespace, app, rest));
    } else if (normalizedRelPath.startsWith('automations/app/')) {
      const rest = normalizedRelPath.replace(/^automations\/app\//, '');
      candidates.push(path.join(this.basePath, 'supabase', 'functions', `app-${namespace}-${app}`, rest));
    } else if (normalizedRelPath.startsWith('automations/router-on-user-events/')) {
      const rest = normalizedRelPath.replace(/^automations\/router-on-user-events\//, '');
      candidates.push(path.join(this.basePath, 'supabase', 'functions', 'router-on-user-events', `app-${namespace}-${app}`, rest));
    } else if (isCodeFile) {
      if (normalizedRelPath.startsWith('pages/')) {
        const rest = normalizedRelPath.replace(/^pages\//, '');
        candidates.push(path.join(this.basePath, 'web', 'src', 'pages', namespace, app, rest));
      } else if (normalizedRelPath.startsWith('components/')) {
        const rest = normalizedRelPath.replace(/^components\//, '');
        candidates.push(path.join(this.basePath, 'web', 'src', 'components', namespace, app, rest));
      } else if (normalizedRelPath.startsWith('navigation/')) {
        const rest = normalizedRelPath.replace(/^navigation\//, '');
        candidates.push(path.join(this.basePath, 'web', 'src', 'navigation', rest));
      } else if (normalizedRelPath.startsWith('controllers/')) {
        const rest = normalizedRelPath.replace(/^controllers\//, '');
        candidates.push(path.join(this.basePath, 'backend', 'src', 'api-web', namespace, app, rest));
      }
    }
    // Fallback to original /apps location
    candidates.push(path.join(this.basePath, 'apps', namespace, app, normalizedRelPath));

    // Validate all candidate paths are within base and return first that exists
    const resolvedBasePath = path.resolve(this.basePath);
    for (const candidate of candidates) {
      const resolvedPath = path.resolve(candidate);
      if (!resolvedPath.startsWith(resolvedBasePath)) {
        continue;
      }
      try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
        const content = await fs.promises.readFile(resolvedPath, 'utf8');
        return { content, relativePath };
      } catch {
        // try next
      }
    }

    throw new InternalServerErrorException('Failed to read file');
  }

  async getFileContentByOsPath(osPath: string) {
    if (!osPath || typeof osPath !== 'string') {
      throw new BadRequestException('Invalid path');
    }
    const requested = path.resolve(this.basePath, osPath);
    const resolvedBasePath = path.resolve(this.basePath);
    if (!requested.startsWith(resolvedBasePath)) {
      throw new BadRequestException('Path outside workspace');
    }
    try {
      await fs.promises.access(requested, fs.constants.R_OK);
      const content = await fs.promises.readFile(requested, 'utf8');
      return { content, osPath };
    } catch (e) {
      throw new InternalServerErrorException('Failed to read file');
    }
  }

  async getFileContentByAppPath(appPath: string) {
    if (!appPath || typeof appPath !== 'string') {
      throw new BadRequestException('Invalid path');
    }
    const requested = path.resolve(this.basePath, 'apps', appPath);
    const resolvedBasePath = path.resolve(this.basePath, 'apps');
    if (!requested.startsWith(resolvedBasePath)) {
      throw new BadRequestException('Path outside apps directory');
    }
    try {
      await fs.promises.access(requested, fs.constants.R_OK);
      const content = await fs.promises.readFile(requested, 'utf8');
      return { content, appPath };
    } catch (e) {
      throw new InternalServerErrorException('Failed to read file');
    }
  }

  private async buildFileTree(currentPath: string, basePath: string): Promise<any> {
    const stats = await fs.promises.stat(currentPath);
    const relativePath = path.relative(basePath, currentPath);
    const name = path.basename(currentPath);

    if (stats.isDirectory()) {
      const children = [];
      try {
        const items = await fs.promises.readdir(currentPath);
        for (const item of items) {
          // Skip hidden files and node_modules
          if (item.startsWith('.') || item === 'node_modules') continue;
          
          const childPath = path.join(currentPath, item);
          const child = await this.buildFileTree(childPath, basePath);
          children.push(child);
        }
      } catch (error) {
        // Skip directories we can't read
      }

      return {
        name,
        type: 'directory',
        path: relativePath || '.',
        children: children.sort((a, b) => {
          // Directories first, then files
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        }),
      };
    } else {
      return {
        name,
        type: 'file',
        path: relativePath,
      };
    }
  }
}
