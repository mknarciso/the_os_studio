import { useState, useEffect } from 'react';
import { WandSparkles } from 'lucide-react';
import { ApiService } from '../services/api';
import { Button } from './ui/button';
import { AnimatedThemeToggler } from './ui/animated-theme-toggler';
import { DiffEditorDialog } from './DiffEditorDialog';
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
        const res = await ApiService.getUnsavedDiffs(namespace, app, true);
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
              const res = await ApiService.getUnsavedDiffs(namespace, app, true);
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
    <DiffEditorDialog
      open={showDiffsModal}
      onOpenChange={setShowDiffsModal}
      diffs={diffs.diffs || []}
      selectedDiff={selectedDiff}
      onSelectDiff={setSelectedDiff}
      namespace={namespace}
      app={app}
      onApplied={async () => {
        try {
          const res = await ApiService.getUnsavedDiffs(namespace, app, true);
          setDiffs(res || { count: 0, diffs: [] });
          setSelectedDiff((res?.diffs && res.diffs[0]) || null);
        } catch {}
      }}
    />
    </>
  );
}

// moved diff preview into DiffEditorDialog component
