import { useState, useEffect, useRef } from 'react';
import { PanelLeft, MessageSquare, Code, Edit, Compass, BookOpen } from 'lucide-react';
import { FileTree } from './FileTree';
import { MonacoEditor } from './MonacoEditor';
import { DocumentationView } from './DocumentationView';
import { ChatPanel } from './ChatPanel';
import { EditorSessionStore } from '../stores/EditorSessionStore';
import PagesGraph from './PagesGraph';
import DataSchemaGraph from './DataSchemaGraph';
import { ReactFlowProvider } from 'reactflow';
import { BrandingView } from './BrandingView';

export function MainContent({
  namespace, 
  app, 
  activeSection, 
  sectionPath,
  showChat
}) {
  const [activeTab, setActiveTab] = useState(activeSection === 'documentation' ? 'explorar' : (activeSection === 'branding' ? 'guideline' : 'code'));
  const [showFileTree, setShowFileTree] = useState(true);

  const [selectedFile, setSelectedFile] = useState(EditorSessionStore.getSelectedFileForArea(activeSection));
  const [brandingRefresh, setBrandingRefresh] = useState(0);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [chatWidthPx, setChatWidthPx] = useState(360);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    const saved = Number(localStorage.getItem('chatWidthPx') || '0');
    if (saved && saved >= 260 && saved <= 800) setChatWidthPx(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('chatWidthPx', String(chatWidthPx));
  }, [chatWidthPx]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!isResizingRef.current) return;
      const dx = startXRef.current - (e.touches ? e.touches[0].clientX : e.clientX);
      let next = startWidthRef.current + dx;
      next = Math.max(260, Math.min(800, next));
      setChatWidthPx(next);
      e.preventDefault();
    };
    const stop = () => { isResizingRef.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', handleMove, { passive: false });
      window.removeEventListener('touchend', stop);
    };
  }, []);

  const beginResize = (e) => {
    isResizingRef.current = true;
    startXRef.current = e.touches ? e.touches[0].clientX : e.clientX;
    startWidthRef.current = chatWidthPx;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleStoreChange = () => {
      setSelectedFile(EditorSessionStore.getSelectedFileForArea(activeSection));
    };
    const unsubscribe = EditorSessionStore.subscribe(handleStoreChange);
    return unsubscribe;
  }, [activeSection]);


  const handleFileSelect = (filePath) => {
    EditorSessionStore.setSelectedFileForArea(activeSection, filePath);
    // The store will notify the component to update state
    setActiveTab('code');
  };

  // Ajustar aba padrão quando a seção muda
  useEffect(() => {
    if (activeSection === 'documentation') {
      setActiveTab('explorar');
    } else if (activeSection === 'branding') {
      setActiveTab('guideline');
    } else {
      setActiveTab('code');
      // Also update selected file from store when section changes
      setSelectedFile(EditorSessionStore.getSelectedFileForArea(activeSection));
    }
  }, [activeSection]);

  const getFileTreeTitle = () => {
    switch (activeSection) {
      case 'data':
        return 'Data (Supabase)';
      case 'scopes':
        return 'Controllers';
      case 'pages':
        return 'Pages & Components';
      case 'automations':
        return 'Automations';
      default:
        return 'Explorer';
    }
  };

  const getFileTreeBasePath = () => {
    switch (activeSection) {
      case 'data':
        return 'data';
      case 'scopes':
        return 'controllers';
      case 'pages':
        // Use root to allow showing a whitelisted merge of pages, components and navigation
        return '';
      case 'automations':
        return 'automations';
      default:
        return '';
    }
  };

  const shouldShowFileTree = () => {
    return false; // external FileTree removed; it now lives inside the Code editor
  };

  const handleRunBranding = async () => {
    if (!domainInput) return;
    try {
      setRunning(true);
      setRunError(null);
      const { ApiService } = await import('../services/api');
      await ApiService.runBranding(domainInput);
      setShowDomainModal(false);
      setBrandingRefresh((x) => x + 1);
    } catch (e) {
      setRunError(e?.message || 'Failed to run');
    } finally {
      setRunning(false);
    }
  };

  const renderMainPanel = () => {
    if (activeSection === 'documentation') {
      return (
        <DocumentationView
          namespace={namespace} 
          app={app}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      );
    }

    if (activeSection === 'branding') {
      return (
        <BrandingView
          activeTab={activeTab}
          onTabChange={setActiveTab}
          refreshKey={brandingRefresh}
        />
      );
    }

    if (activeTab === 'code') {
      return (
        <MonacoEditor
          namespace={namespace}
          app={app}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          basePath={getFileTreeBasePath()}
          showHeader={false}
        />
      );
    }

    if (activeTab === 'preview') {
      return (
        <div className="preview-panel">
          Preview functionality coming soon
        </div>
      );
    }

    if (activeSection === 'pages' && activeTab === 'graph') {
      return (
        <div className="graph-panel" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
          <ReactFlowProvider>
            <PagesGraph namespace={namespace} app={app} />
          </ReactFlowProvider>
        </div>
      );
    }

    if (activeSection === 'data' && activeTab === 'schema') {
      return (
        <div className="graph-panel" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
          <ReactFlowProvider>
            <DataSchemaGraph namespace={namespace} app={app} />
          </ReactFlowProvider>
        </div>
      );
    }

    return null;
  };

  const showFileTreeToggleButton = false; // now tree is inside the editor

  const renderHeaderTabs = () => {
    if (activeSection === 'documentation') {
      return (
        <div className="tabs" style={{ display: 'flex', gap: 8 }}>
          <div className={`tab ${activeTab === 'explorar' ? 'active' : ''}`} onClick={() => setActiveTab('explorar')}>
            <Compass size={14} />
            Explorar
          </div>
          <div className={`tab ${activeTab === 'read' ? 'active' : ''}`} onClick={() => setActiveTab('read')}>
            <BookOpen size={14} />
            Read
          </div>
          <div className={`tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>
            <Edit size={14} />
            Edit
          </div>
          <div className={`tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>
            <Code size={14} />
            Code
          </div>
        </div>
      );
    }

    if (activeSection === 'branding') {
      return (
        <div className="tabs" style={{ display: 'flex', gap: 8 }}>
          <div className={`tab ${activeTab === 'guideline' ? 'active' : ''}`} onClick={() => setActiveTab('guideline')}>
            <BookOpen size={14} />
            Guideline
          </div>
          <div className={`tab ${activeTab === 'css' ? 'active' : ''}`} onClick={() => setActiveTab('css')}>
            <Code size={14} />
            CSS
          </div>
          <div className={`tab ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
            <Edit size={14} />
            Preview
          </div>
        </div>
      );
    }

    return (
      <div className="tabs" style={{ display: 'flex', gap: 8 }}>
        <div className={`tab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>
          <Code size={14} />
          Code
        </div>
        <div className={`tab ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
          <Edit size={14} />
          Preview
        </div>
        {activeSection === 'pages' && (
          <div className={`tab ${activeTab === 'graph' ? 'active' : ''}`} onClick={() => setActiveTab('graph')}>
            <Code size={14} />
            Graph
          </div>
        )}
        {activeSection === 'data' && (
          <div className={`tab ${activeTab === 'schema' ? 'active' : ''}`} onClick={() => setActiveTab('schema')}>
            <Code size={14} />
            {} Schema
          </div>
        )}
      </div>
    );
  };

  const renderHeaderActions = () => {
    if (activeSection === 'branding') {
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="save-button"
            onClick={async () => {
              try {
                const { ApiService } = await import('../services/api');
                const res = await ApiService.testHello('studio');
                alert(res?.message || JSON.stringify(res));
              } catch (e) {
                alert(e?.message || 'Failed to run test');
              }
            }}
          >
            Test
          </button>
          <button className="save-button" onClick={() => setShowDomainModal(true)} disabled={running}>
            Extract from domain
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="content-area">
      {shouldShowFileTree() && (
        <FileTree
          namespace={namespace}
          app={app}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          basePath={getFileTreeBasePath()}
          title={getFileTreeTitle()}
        />
      )}
      
      <div className="main-content" style={{ minWidth: 0 }}>
        {/* New header area with tabs and actions */}
        <div className="tab-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="tab-controls">
            {showFileTreeToggleButton && (
              <button
                className={`toggle-button ${showFileTree ? 'active' : ''}`}
                onClick={() => setShowFileTree(!showFileTree)}
                title="Toggle File Tree"
              >
                <PanelLeft size={16} />
              </button>
            )}
          </div>
          <div style={{ flex: 1, paddingLeft: 8, paddingRight: 8 }}>
            {renderHeaderTabs()}
          </div>
          <div className="tab-controls">
            {renderHeaderActions()}
          </div>
        </div>
        
        <div className="editor-area" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {renderMainPanel()}
        </div>
      </div>
      
      {/* Domain modal (simple) */}
      {showDomainModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, width: 420 }}>
            <div style={{ padding: 16, borderBottom: '1px solid #2a2a2a', fontWeight: 600 }}>Extract from domain</div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: '#9ba3af', marginBottom: 8 }}>Enter a domain like example.com or https://example.com</div>
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="domain"
                style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #2a2a2a', background: '#111', color: '#e5e7eb' }}
              />
              {runError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{runError}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16, borderTop: '1px solid #2a2a2a' }}>
              <button className="save-button" onClick={() => setShowDomainModal(false)} disabled={running}>
                Cancel
              </button>
              <button className="save-button" onClick={handleRunBranding} disabled={!domainInput || running}>
                {running ? 'Running...' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChat && (
        <>
          <div
            className="chat-resizer"
            onMouseDown={beginResize}
            onTouchStart={beginResize}
            title="Arraste para ajustar a largura do chat"
          />
          <div style={{ width: chatWidthPx, minWidth: 260, maxWidth: 800, height: '100%', display: 'flex' }}>
            <ChatPanel 
              isVisible={showChat} 
              currentContext={{
                projectPath: `/apps/${namespace}/${app}`,
                currentFile: EditorSessionStore.getSelectedFileForArea(activeSection) || '',
                area: activeSection,
                namespace,
                app,
              }}
              width={chatWidthPx}
            />
          </div>
        </>
      )}
    </div>
  );
}
