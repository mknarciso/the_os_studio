import { useEffect, useRef, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { ApiService } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { FileTree } from './FileTree';
import { useIsDark } from '../hooks/useIsDark';

export function DiffEditorDialog({ open, onOpenChange, diffs = [], selectedDiff, onSelectDiff, namespace, app, onApplied }) {
  const isDark = useIsDark();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  // We won't rely on key remounts; we'll dispose explicitly on close/submit
  const diffEditorRef = useRef(null);
  const [commitMessage, setCommitMessage] = useState('');

  // Safely detach models and dispose editor to avoid Monaco race during unmount/close
  const safeDispose = () => {
    const editor = diffEditorRef.current;
    if (!editor) return;
    try {
      if (typeof editor.setModel === 'function') {
        editor.setModel({ original: null, modified: null });
      }
    } catch (_) {}
    try {
      if (typeof editor.dispose === 'function') {
        editor.dispose();
      }
    } catch (_) {}
    diffEditorRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!selectedDiff) return;
      setLoading(true);
      setError(null);
      try {
        let left = '';
        let right = '';
        if (selectedDiff.appPath) {
          try {
            const res = await ApiService.getFileContentByAppPath(selectedDiff.appPath);
            left = res.content || '';
          } catch {}
        }
        if (selectedDiff.osPath) {
          try {
            const res = await ApiService.getFileContentByOsPath(selectedDiff.osPath);
            right = res.content || '';
          } catch {}
        }
        if (!cancelled) {
          setOriginal(left);
          setModified(right);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Falha ao carregar conteúdo');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (open) load();
    return () => { cancelled = true; };
  }, [open, selectedDiff]);

  const language = guessLanguage(selectedDiff?.osPath || selectedDiff?.appPath);

  const tree = buildTreeFromDiffs(diffs, namespace, app);
  const customTree = convertToFileTree(tree, namespace, app);

  const handleOpenChange = (next) => {
    if (!next) {
      // Detach models and dispose editor before portal unmounts
      safeDispose();
    }
    if (onOpenChange) onOpenChange(next);
  };

  useEffect(() => {
    return () => {
      // Component unmount safety
      safeDispose();
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revise alterações para salvar</DialogTitle>
        </DialogHeader>
        <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
          <div style={{ width: 300, borderRight: '1px solid #2a2a2a', overflow: 'auto' }}>
            <FileTree
              namespace={null}
              app={null}
              selectedFile={selectedDiff?.appPath || selectedDiff?.osPath}
              onFileSelect={(p) => {
                // map path back to diff by matching appPath or osPath
                const found = diffs.find((d) => d.appPath === p || d.osPath === p);
                if (found && onSelectDiff) onSelectDiff(found);
              }}
              customTree={customTree}
              expandAllOnLoad
              renderRootChildrenOnly
            />
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 16, color: '#9ba3af' }}>Carregando...</div>
            ) : error ? (
              <div style={{ padding: 16, color: '#ef4444' }}>{error}</div>
            ) : !selectedDiff ? (
              <div style={{ padding: 16, color: '#9ba3af' }}>Selecione um arquivo para ver as diferenças</div>
            ) : (
              <DiffEditor
                height="70vh"
                theme={isDark ? 'vs-dark' : 'light'}
                language={language}
                original={original}
                modified={modified}
                onMount={(editor /* monaco */) => {
                  diffEditorRef.current = editor;
                }}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                }}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              placeholder="Mensagem do commit (opcional)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
          </div>
          <DialogClose asChild>
            <Button variant="ghost">Fechar</Button>
          </DialogClose>
          <Button
            disabled={!diffs?.length}
            onClick={async () => {
              try {
                // Detach models and dispose before apply and close to avoid Monaco dispose race
                safeDispose();
                await ApiService.applyDiffs(
                  namespace,
                  app,
                  diffs.map(d => ({ osPath: d.osPath, appPath: d.appPath })).filter(d => d.osPath && d.appPath),
                  commitMessage && commitMessage.trim().length ? commitMessage.trim() : undefined
                );
                if (onApplied) onApplied();
                try { window.dispatchEvent(new CustomEvent('studio:ai-tools-finished')); } catch {}
                setCommitMessage('');
                onOpenChange(false);
              } catch (e) {
                // TODO: show toast
                console.error('Failed to apply diffs', e);
              }
            }}
          >
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function guessLanguage(filePath) {
  const ext = (filePath?.split('.').pop() || '').toLowerCase();
  const map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', json: 'json', html: 'html', css: 'css', scss: 'scss', md: 'markdown' };
  return map[ext] || 'plaintext';
}

function buildTreeFromDiffs(diffs, namespace, app) {
  const root = { name: 'apps', children: {}, files: [] };
  for (const d of diffs || []) {
    const p0 = (d.appPath || d.osPath || '').replace(/^\.\/?/, '');
    if (!p0) continue;
    const parts0 = p0.split('/');
    // Remove first three levels: 'apps', namespace, app
    const parts = (parts0[0] === 'apps' && parts0[1] && parts0[2]) ? parts0.slice(3) : parts0;
    if (!parts.length) continue;
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node.files.push({ name: part, diff: d });
      } else {
        node.children[part] = node.children[part] || { name: part, children: {}, files: [] };
        node = node.children[part];
      }
    }
  }
  return root;
}

function convertToFileTree(tree, namespace, app) {
  // Convert our internal tree object to FileTree component expected shape
  // Expected root: { name, type: 'directory', path: '.', children: [...] }
  function toNode(node, basePath = '') {
    const children = [];
    for (const dir of Object.keys(node.children).sort()) {
      const dirPath = basePath ? `${basePath}/${dir}` : dir;
      children.push({
        name: dir,
        type: 'directory',
        path: dirPath,
        children: toNode(node.children[dir], dirPath).children,
      });
    }
    for (const f of node.files) {
      const filePath = basePath ? `${basePath}/${f.name}` : f.name;
      // Prefer appPath, fallback osPath
      const pathRef = f.diff.appPath || f.diff.osPath || filePath;
      children.push({ name: f.name, type: 'file', path: pathRef });
    }
    return { children };
  }
  
  // Navigate to the app level: tree -> {namespace} -> {app}
  let appNode = tree;
  if (tree.children && tree.children[namespace] && tree.children[namespace].children && tree.children[namespace].children[app]) {
    appNode = tree.children[namespace].children[app];
  }
  
  const out = toNode(appNode, '');
  return { name: app, type: 'directory', path: '.', children: out.children };
}


