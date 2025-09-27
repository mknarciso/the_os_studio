import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import simpleGit from 'simple-git';
import { spawn } from 'node:child_process';
import { resolveOsAppPaths, getWorkspaceRoot, toOsPathFromFull, toAppPathFromFull } from '../mastra/tools/file-system/fs-utils';
import { createRequire } from 'node:module';

type DiffHunk = {
  added: number[];
  removed: number[];
};

type FileDiff = {
  osPath: string; // e.g. web/src/pages/ns/app/file.jsx
  appPath?: string; // apps/{namespace}/{app}/...
  status: 'modified' | 'created' | 'deleted';
  hunks?: DiffHunk;
};

@Injectable()
export class GitService {
  async getUnsavedDiffs(params: { namespace: string; app: string; verbose?: boolean }) {
    const { namespace, app, verbose } = params;
    const { web, backend, supabase, workspaceRoot, appPath } = await resolveOsAppPaths(namespace, app);

    

    const diffs: FileDiff[] = [];

    const addMapping = (record: FileDiff) => {
      const osRelPath = record.osPath;
      if (osRelPath.startsWith(`web/src/pages/${namespace}/${appPath}`)) {
        const rel = osRelPath.replace(`web/src/pages/${namespace}/${appPath}/`, 'pages/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      } else if (osRelPath.startsWith(`web/src/components/${namespace}/${app}`)) {
        const rel = osRelPath.replace(`web/src/components/${namespace}/${app}/`, 'components/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      } else if (osRelPath.startsWith(`web/src/navigation/`)) {
        record.appPath = `apps/${namespace}/${app}/navigation/${namespace}_${app}.js`;
      } else if (osRelPath.startsWith(`backend/src/api-web/${namespace}/${app}`)) {
        const rel = osRelPath.replace(`backend/src/api-web/${namespace}/${app}/`, 'controllers/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      } else if (osRelPath.startsWith(`supabase/migrations/`)) {
        const rel = osRelPath.replace(`supabase/migrations/`, 'data/migrations/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      } else if (osRelPath.startsWith(`supabase/seed/${namespace}/${app}`)) {
        const rel = osRelPath.replace(`supabase/seed/${namespace}/${app}/`, 'data/seed/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      } else if (osRelPath.startsWith(`supabase/functions/app-${namespace}-${app}`)) {
        const rel = osRelPath.replace(`supabase/functions/app-${namespace}-${app}/`, 'automations/functions/');
        record.appPath = `apps/${namespace}/${app}/${rel}`;
      }
      return record;
    };

    const parseUnifiedDiff = async (raw: string, leftRoot: string, rightRoot: string): Promise<FileDiff[]> => {
      const results: FileDiff[] = [];
      if (!raw || !raw.includes('diff --git ')) return results;

      // Split into blocks starting at each "diff --git" line (including the first at position 0)
      const indices: number[] = [];
      const re = /^diff --git .*$/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        indices.push(m.index);
      }
      if (indices.length === 0) return results;
      indices.push(raw.length);

      for (let i = 0; i < indices.length - 1; i++) {
        const start = indices[i];
        const end = indices[i + 1];
        const block = raw.slice(start, end);
        const lines = block.split('\n');
        const aLine = lines.find((l) => l.startsWith('--- ')) || '';
        const bLine = lines.find((l) => l.startsWith('+++ ')) || '';
        const aPathRaw = aLine.replace(/^---\s+a\//, '').trim();
        const bPathRaw = bLine.replace(/^\+\+\+\s+b\//, '').trim();
        if (!aPathRaw && !bPathRaw) continue;

        const isNew = aPathRaw === '/dev/null' || lines.some((l) => l.startsWith('new file mode'));
        const isDeleted = bPathRaw === '/dev/null' || lines.some((l) => l.startsWith('deleted file mode'));
        const status: FileDiff['status'] = isNew ? 'created' : isDeleted ? 'deleted' : 'modified';

        // Use whichever side isn't /dev/null
        const aAbs = aPathRaw && aPathRaw !== '/dev/null' ? aPathRaw : '';
        const bAbs = bPathRaw && bPathRaw !== '/dev/null' ? bPathRaw : '';
        const chosenAbs = !isNew ? aAbs : bAbs;
        if (!chosenAbs) continue;
        const osPath = await toOsPathFromFull(chosenAbs);

        const added: number[] = [];
        const removed: number[] = [];
        for (const l of lines) {
          if (l.startsWith('@@ ')) {
            const m = l.match(/@@ -(?<aStart>\d+)(,(?<aLen>\d+))? \+(?<bStart>\d+)(,(?<bLen>\d+))? @@/);
            if (m && m.groups) {
              const aStart = parseInt(m.groups.aStart || '0', 10);
              const aLen = parseInt(m.groups.aLen || '0', 10);
              const bStart = parseInt(m.groups.bStart || '0', 10);
              const bLen = parseInt(m.groups.bLen || '0', 10);
              for (let i = 0; i < aLen; i++) removed.push(aStart + i);
              for (let i = 0; i < bLen; i++) added.push(bStart + i);
            }
          }
        }

        const rec: FileDiff = addMapping({ osPath: osPath.replace(/\\/g, '/'), status, hunks: (added.length || removed.length) ? { added, removed } : undefined });
        results.push(rec);
      }
      return results;
    };

    const git = simpleGit();
    const runGitRaw = async (args: string[]): Promise<string> => {
      return await new Promise<string>((resolve) => {
        const child = spawn('git', args, {
          env: { ...process.env, GIT_PAGER: 'cat' },
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('error', () => resolve(stdout || ''));
        child.on('close', () => resolve(stdout || ''));
      });
    };
    // Use existing check_diffs.js under workspace root for robust mapping
    const req = createRequire(__filename);
    const scriptPath = path.resolve(workspaceRoot, 'check_diffs.js');
    
    let originalCwd = process.cwd();
    try {
      process.chdir(workspaceRoot);
    } catch {}
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = req(scriptPath);
      const rawDiffs = await mod.checkAppDiffs(namespace, app);
      // Helpers that do not depend on process.cwd()
      const relOs = (full: string) => path.relative(workspaceRoot, full).replace(/\\/g, '/');
      const relApp = (full: string) => path.relative(path.resolve(workspaceRoot, 'apps'), full).replace(/\\/g, '/');
      for (const d of rawDiffs || []) {
        
        const destFull = d.dest ? path.resolve(workspaceRoot, d.dest) : '';
        const sourceFull = d.source ? path.resolve(workspaceRoot, d.source) : '';
        const destExists = d.destExists === true && destFull ? await fs.stat(destFull).then(() => true).catch(() => false) : false;
        const sourceExists = d.sourceExists === true && sourceFull ? await fs.stat(sourceFull).then(() => true).catch(() => false) : false;

        const chosenFull = destExists ? destFull : (sourceExists ? sourceFull : (destFull || sourceFull));
        if (!chosenFull) continue;
        const osPath = relOs(chosenFull);
        const appPathMaybe = (sourceExists ? relApp(sourceFull) : (destExists ? relApp(sourceFull || destFull) : '')) as string | '';

        const status: FileDiff['status'] = d.status === 'different' ? 'modified' : (d.status === 'dest_missing' ? 'created' : 'deleted');

        const rec: FileDiff = { osPath, appPath: appPathMaybe || undefined, status } as any;

        

        // Compute hunks when both exist and are different
        if (destExists && sourceExists && status === 'modified') {
          try {
            const raw = await runGitRaw(['--no-pager', 'diff', '--no-index', '--unified=0', '--no-color', '--', destFull, sourceFull]);
            const hunks = await (async () => {
              const added: number[] = [];
              const removed: number[] = [];
              const lines = raw.split('\n');
              for (const l of lines) {
                if (l.startsWith('@@ ')) {
                  const m = l.match(/@@ -(?<aStart>\d+)(,(?<aLen>\d+))? \+(?<bStart>\d+)(,(?<bLen>\d+))? @@/);
                  if (m && m.groups) {
                    const aStart = parseInt(m.groups.aStart || '0', 10);
                    const aLen = parseInt(m.groups.aLen || '0', 10);
                    const bStart = parseInt(m.groups.bStart || '0', 10);
                    const bLen = parseInt(m.groups.bLen || '0', 10);
                    for (let i = 0; i < aLen; i++) removed.push(aStart + i);
                    for (let i = 0; i < bLen; i++) added.push(bStart + i);
                  }
                }
              }
              return (added.length || removed.length) ? { added, removed } : undefined;
            })();
            if (hunks) (rec as any).hunks = hunks;
          } catch {}
        }

        if (verbose) {
          (rec as any).sourceOsPath = sourceFull ? relOs(sourceFull) : undefined;
          (rec as any).destOsPath = destFull ? relOs(destFull) : undefined;
          
        }

        diffs.push(rec);
      }
    } catch (e) {
      // Fallback: no diffs
    } finally {
      try { process.chdir(originalCwd); } catch {}
    }

    return {
      context: { namespace, app },
      count: diffs.length,
      diffs,
    };
  }

  async applyUnsavedDiffs(params: { namespace: string; app: string; files?: Array<{ osPath?: string; appPath?: string }> }) {
    const { namespace, app, files } = params || {} as any;
    // eslint-disable-next-line no-console
    console.log('[applyUnsavedDiffs] received params:', JSON.stringify(params, null, 2));

    if (!namespace || !app) {
      // eslint-disable-next-line no-console
      console.error('[applyUnsavedDiffs] error: namespace and app are required');
      throw new Error('namespace and app are required');
    }
    const { workspaceRoot } = await resolveOsAppPaths(namespace, app);
    // eslint-disable-next-line no-console
    console.log('[applyUnsavedDiffs] workspaceRoot:', workspaceRoot);

    // When files not provided, compute current unsaved diffs set
    let targets: Array<{ osPath: string; appPath: string }> = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        const osPath = (f.osPath || '').trim();
        const appPath = (f.appPath || '').trim();
        if (osPath && appPath) targets.push({ osPath, appPath });
      }
    } else {
      // eslint-disable-next-line no-console
      console.log('[applyUnsavedDiffs] no files provided, re-computing diffs...');
      const current = await this.getUnsavedDiffs({ namespace, app, verbose: true });
      for (const d of current.diffs || []) {
        if (d.osPath && d.appPath) targets.push({ osPath: d.osPath, appPath: d.appPath });
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[applyUnsavedDiffs] processing ${targets.length} targets.`);

    // Copy os -> apps for each target
    const fsPromises = await import('node:fs/promises');
    const pathMod = await import('node:path');
    const copied: Array<{ osPath: string; appPath: string }> = [];
    for (const t of targets) {
      try {
        const fromFull = pathMod.resolve(workspaceRoot, t.osPath);
        const toFull = pathMod.resolve(workspaceRoot, 'apps', t.appPath);
        // eslint-disable-next-line no-console
        console.log(`[applyUnsavedDiffs] copying from: ${fromFull} to: ${toFull}`);
        
        // Ensure destination directory exists
        const dir = pathMod.dirname(toFull);
        await fsPromises.mkdir(dir, { recursive: true }).catch(() => {});
        const content = await fsPromises.readFile(fromFull, 'utf8');
        await fsPromises.writeFile(toFull, content, 'utf8');
        copied.push(t);
        // eslint-disable-next-line no-console
        console.log(`[applyUnsavedDiffs] OK copied ${t.osPath}`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[applyUnsavedDiffs] FAILED to copy ${t.osPath}:`, e);
      }
    }

    // eslint-disable-next-line no-console
    console.log('[applyUnsavedDiffs] result:', { ok: true, copiedCount: copied.length });
    return { ok: true, copiedCount: copied.length, copied };
  }
}


