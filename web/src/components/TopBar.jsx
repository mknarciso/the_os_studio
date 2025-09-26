import { useState, useEffect } from 'react';
import { WandSparkles } from 'lucide-react';
import { ApiService } from '../services/api';
import { Button } from './ui/button';
import { AnimatedThemeToggler } from './ui/animated-theme-toggler';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function TopBar({ namespace, app, onContextChange, showChat, onToggleChat }) {
  const [namespaceApps] = useState(['quero/flow', 'core/agents', 'core/configs']);
  const [diffs, setDiffs] = useState({ count: 0, diffs: [] });
  const [showDiffsModal, setShowDiffsModal] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState(null);

  const handleNamespaceAppChange = (namespaceApp) => {
    const [newNamespace, newApp] = namespaceApp.split('/');
    onContextChange( newNamespace, newApp);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await ApiService.getUnsavedDiffs(namespace, app);
        if (!cancelled) {
          setDiffs(res || { count: 0, diffs: [] });
          setSelectedDiff((res?.diffs && res.diffs[0]) || null);
        }
      } catch {
        if (!cancelled) {
          setDiffs({ count: 0, diffs: [] });
          setSelectedDiff(null);
        }
      }
    };
    load();
    const onRefresh = () => load();
    window.addEventListener('studio:file-saved', onRefresh);
    window.addEventListener('studio:ai-tools-finished', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('studio:file-saved', onRefresh);
      window.removeEventListener('studio:ai-tools-finished', onRefresh);
    };
  }, [namespace, app]);

  const currentNamespaceApp = `${namespace}/${app}`;

  return (
    <>
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div className="top-bar-logo">
          <img src="/icon.png" alt="Studio Logo" className="logo-image" />
          <span className="logo-text">Studio</span>
        </div>
        
        <div className="top-bar-section">
          <Select 
            value={currentNamespaceApp} 
            onValueChange={handleNamespaceAppChange}
          >
            <SelectTrigger className="w-[200px] h-9 px-3 py-1 text-xs">
              <SelectValue placeholder="Selecione um app" />
            </SelectTrigger>
            <SelectContent>
              {namespaceApps?.map(na => (
                <SelectItem key={na} value={na}>{na}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="top-bar-actions">
        <Button asChild size="sm" variant="ghost" title="Alternar tema">
          <AnimatedThemeToggler />
        </Button>
        <Button
          variant={diffs.count === 0 ? "outline" : "default"}
          size="sm"
          onClick={async () => {
            try {
              const res = await ApiService.getUnsavedDiffs(namespace, app);
              setDiffs(res || { count: 0, diffs: [] });
              setSelectedDiff((res?.diffs && res.diffs[0]) || null);
            } catch {
              setDiffs({ count: 0, diffs: [] });
              setSelectedDiff(null);
            } finally {
              setShowDiffsModal(true);
            }
          }}
          title={diffs.count === 0 ? 'App Salvo' : `Salvar ${diffs.count} alterações`}
        >
          {diffs.count === 0 ? 'App Salvo' : `Salvar ${diffs.count} alterações`}
        </Button>
        <Button
          variant={showChat ? "default" : "outline"}
          size="sm"
          onClick={onToggleChat}
          title="Toggle E-Zaz AI Assistant"
        >
          <WandSparkles size={16} />
        </Button>
      </div>
    </div>
    {showDiffsModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowDiffsModal(false)}>
        <div style={{ width: 720, maxWidth: '95%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 16, borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>Alterações não salvas</div>
            <Button variant="ghost" onClick={() => setShowDiffsModal(false)}>Fechar</Button>
          </div>
          <div style={{ display: 'flex', height: 480 }}>
            <div style={{ width: 320, borderRight: '1px solid #2a2a2a', overflow: 'auto' }}>
              {diffs.diffs?.length ? diffs.diffs.map((d, i) => (
                <div key={i} style={{ padding: 10, borderBottom: '1px solid #2a2a2a', cursor: 'pointer', background: selectedDiff === d ? '#111' : undefined }} onClick={() => setSelectedDiff(d)}>
                  <div style={{ fontSize: 12, color: '#9ba3af' }}>{d.status}</div>
                  <div style={{ fontSize: 12 }}>{d.osPath}</div>
                  {d.appPath && <div style={{ fontSize: 11, color: '#6b7280' }}>{d.appPath}</div>}
                </div>
              )) : (
                <div style={{ padding: 16, color: '#9ba3af' }}>Nenhuma alteração</div>
              )}
            </div>
            <DiffPreview selected={selectedDiff} />
          </div>
          <div style={{ padding: 12, borderTop: '1px solid #2a2a2a', textAlign: 'right' }}>
            <Button disabled>{diffs.count === 0 ? 'Nada para salvar' : 'Salvar (em breve)'}</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function DiffPreview({ selected }) {
  if (!selected) return <div style={{ flex: 1, padding: 16, color: '#9ba3af' }}>Selecione um arquivo para ver detalhes</div>;
  return (
    <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#9ba3af' }}>{selected.osPath}</div>
      {selected.hunks ? (
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ marginBottom: 6 }}>Linhas adicionadas: {selected.hunks.added.join(', ') || '—'}</div>
          <div>Linhas removidas: {selected.hunks.removed.join(', ') || '—'}</div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9ba3af' }}>Sem detalhes de linhas</div>
      )}
    </div>
  );
}
