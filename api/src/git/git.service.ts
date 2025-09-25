import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import simpleGit from 'simple-git';
import { spawn } from 'node:child_process';
import { resolveOsAppPaths, getCustomerRoot, toOsPathFromFull, toAppPathFromFull } from '../mastra/tools/file-system/fs-utils';
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
  async getUnsavedDiffs(params: { customer: string; namespace: string; app: string; verbose?: boolean }) {
    const { customer, namespace, app } = params;
    const { web, backend, supabase, customerRoot, appPath } = await resolveOsAppPaths(customer, namespace, app);

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
        const osPath = await toOsPathFromFull(chosenAbs, customer);

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
    // Use existing check_diffs.js under customer root for robust mapping
    const req = createRequire(__filename);
    const scriptPath = path.resolve(customerRoot, 'check_diffs.js');
    let originalCwd = process.cwd();
    try {
      process.chdir(customerRoot);
    } catch {}
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = req(scriptPath);
      const rawDiffs = await mod.checkAppDiffs(namespace, app);
      for (const d of rawDiffs || []) {
        const destFull = d.dest ? path.resolve(customerRoot, d.dest) : '';
        const sourceFull = d.source ? path.resolve(customerRoot, d.source) : '';
        const destExists = d.destExists === true && destFull ? await fs.stat(destFull).then(() => true).catch(() => false) : false;
        const sourceExists = d.sourceExists === true && sourceFull ? await fs.stat(sourceFull).then(() => true).catch(() => false) : false;

        const chosenFull = destExists ? destFull : (sourceExists ? sourceFull : (destFull || sourceFull));
        if (!chosenFull) continue;
        const osPath = (await toOsPathFromFull(chosenFull, customer)).replace(/\\/g, '/');
        const appPathMaybe = (sourceExists ? await toAppPathFromFull(sourceFull, customer) : (destExists ? await toAppPathFromFull(sourceFull || destFull, customer).catch(() => '') : '')) as string | '';

        const status: FileDiff['status'] = d.status === 'different' ? 'modified' : (d.status === 'dest_missing' ? 'created' : 'deleted');

        const rec: FileDiff = { osPath, appPath: appPathMaybe || undefined, status };

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
            if (hunks) rec.hunks = hunks;
          } catch {}
        }

        diffs.push(rec);
      }
    } catch (e) {
      // Fallback: no diffs
    } finally {
      try { process.chdir(originalCwd); } catch {}
    }

    return {
      context: { customer, namespace, app },
      count: diffs.length,
      diffs,
    };
  }
}


