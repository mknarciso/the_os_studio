import { useState, useEffect } from 'react';
import { WandSparkles } from 'lucide-react';
import { ApiService } from '../services/api';

export function TopBar({ customer, namespace, app, onContextChange, showChat, onToggleChat }) {
  const [customers] = useState(['quero', 'brendi', 'start', 'omelete']); // Mock data
  const [namespaceApps] = useState({
    'omelete': ['omelete/beneficios'],
    'quero': ['quero/flow', 'core/agents', 'core/configs'],
    'brendi': ['brendi/main'],
    'start': ['start/base']
  });
  const [diffs, setDiffs] = useState({ count: 0, diffs: [] });
  const [showDiffsModal, setShowDiffsModal] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState(null);

  const handleCustomerChange = (newCustomer) => {
    const firstNamespaceApp = namespaceApps[newCustomer]?.[0] || '';
    const [newNamespace, newApp] = firstNamespaceApp.split('/');
    onContextChange(newCustomer, newNamespace, newApp);
  };

  const handleNamespaceAppChange = (namespaceApp) => {
    const [newNamespace, newApp] = namespaceApp.split('/');
    onContextChange(customer, newNamespace, newApp);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await ApiService.getUnsavedDiffs(customer, namespace, app);
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
  }, [customer, namespace, app]);

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
          <span className="top-bar-label">Customer:</span>
          <select 
            className="top-bar-select" 
            value={customer} 
            onChange={(e) => handleCustomerChange(e.target.value)}
          >
            {customers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        
        <div className="top-bar-section">
          <span className="top-bar-label">App:</span>
          <select 
            className="top-bar-select" 
            value={currentNamespaceApp} 
            onChange={(e) => handleNamespaceAppChange(e.target.value)}
          >
            {namespaceApps[customer]?.map(na => (
              <option key={na} value={na}>{na}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="top-bar-actions">
        <button
          className="save-button"
          onClick={async () => {
            try {
              const res = await ApiService.getUnsavedDiffs(customer, namespace, app);
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
        </button>
        <button
          className={`ezaz-button ${showChat ? 'active' : ''}`}
          onClick={onToggleChat}
          title="Toggle E-Zaz AI Assistant"
        >
          <WandSparkles size={16} />
        </button>
      </div>
    </div>
    {showDiffsModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowDiffsModal(false)}>
        <div style={{ width: 720, maxWidth: '95%', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 16, borderBottom: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600 }}>Alterações não salvas</div>
            <button className="save-button" onClick={() => setShowDiffsModal(false)}>Fechar</button>
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
            <button className="save-button" disabled>{diffs.count === 0 ? 'Nada para salvar' : 'Salvar (em breve)'}</button>
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
