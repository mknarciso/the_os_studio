import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Save, Folder, GitBranch } from 'lucide-react';
import { ApiService } from '../services/api';
import { editorStore } from '../stores/EditorStore';
import { FileTree } from './FileTree';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

export function MonacoEditor({ namespace, app, selectedFile, onFileSelect, basePath = '', showHeader = true }) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [explorerWidth, setExplorerWidth] = useState(320);
  const previousExplorerWidthRef = useRef(320);
  const shellRef = useRef(null);
  const editorRef = useRef(null);

  const hasChanges = content !== originalContent;

  useEffect(() => {
    if (selectedFile) {
      loadFileContent();
    } else {
      setContent('');
      setOriginalContent('');
      setError(null);
    }
  }, [selectedFile, namespace, app]);

  const loadFileContent = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await ApiService.getFileContent(namespace, app, selectedFile);
      setContent(data.content);
      setOriginalContent(data.content);
    } catch (err) {
      setError(err.message);
      setContent('');
      setOriginalContent('');
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || !hasChanges) return;

    try {
      setSaving(true);
      setError(null);

      // Simulate webcontainer.fs.writeFile behavior
      const data = await ApiService.saveFile(namespace, app, selectedFile, content);
      
      // Update the original content to reflect saved state
      setOriginalContent(content);
      
      // Update editor store (similar to this.#editorStore.updateFile)
      editorStore.updateFile(data.fullPath, data.action.content);
      
      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      
      console.log('File saved successfully:', data);

      // Notify TopBar to refresh diffs
      try { window.dispatchEvent(new CustomEvent('studio:file-saved')); } catch {}
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add save keyboard shortcut (Cmd+S / Ctrl+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile();
    });
  };

  const getLanguageFromFileName = (fileName) => {
    if (!fileName) return 'plaintext';
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'md': 'markdown',
      'py': 'python',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
    };
    
    return languageMap[extension] || 'plaintext';
  };

  const triggerLayout = () => {
    // Force Monaco to re-layout when container size changes
    if (editorRef.current) {
      const editor = editorRef.current;
      if (editor.layout) {
        const container = editor.getContainerDomNode();
        // Defer to next frame to ensure DOM has settled
        requestAnimationFrame(() => {
          editor.layout({ width: container.clientWidth, height: container.clientHeight });
        });
      }
    }
  };

  useEffect(() => {
    // re-layout on explorer toggle/resize
    const id = setTimeout(triggerLayout, 0);
    return () => clearTimeout(id);
  }, [showExplorer, explorerWidth]);

  // Persist and restore explorer width
  useEffect(() => {
    try {
      const saved = localStorage.getItem('studio_explorer_width_expanded');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) {
          setExplorerWidth(parsed);
          previousExplorerWidthRef.current = parsed;
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (showExplorer) {
        // Only persist when explorer is visible (expanded width)
        localStorage.setItem('studio_explorer_width_expanded', String(explorerWidth));
        previousExplorerWidthRef.current = explorerWidth;
      }
    } catch {}
  }, [explorerWidth, showExplorer]);

  const handleToggleExplorer = () => {
    if (showExplorer) {
      previousExplorerWidthRef.current = explorerWidth;
      try {
        localStorage.setItem('studio_explorer_width_expanded', String(explorerWidth));
      } catch {}
      setShowExplorer(false);
    } else {
      let widthToRestore = previousExplorerWidthRef.current || 320;
      try {
        const saved = localStorage.getItem('studio_explorer_width_expanded');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (!Number.isNaN(parsed)) widthToRestore = parsed;
        }
      } catch {}
      setExplorerWidth(widthToRestore);
      setShowExplorer(true);
      // layout will be triggered by effect
    }
  };

  // Use react-resizable-panels for split layout

  const renderEditor = () => (
    <Editor
      height="100%"
      language={getLanguageFromFileName(selectedFile || 'txt')}
      value={content}
      onChange={(value) => setContent(value || '')}
      onMount={handleEditorDidMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        wordWrap: 'on',
      }}
    />
  );

  return (
    <div className="editor-area" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showHeader && (
        <div className="editor-header">
          <div className="editor-title">
            {selectedFile || 'Select a file'} {hasChanges && '•'}
          </div>
          <button
            className="save-button"
            onClick={saveFile}
            disabled={!hasChanges || saving}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
      
      {error && (
        <div className="error">
          {error}
        </div>
      )}
      
      <div ref={shellRef} className="editor-shell" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left vertical icon bar */}
        <div className="editor-left-icons" style={{ width: '40px', borderRight: '1px solid #2a2a2a', background: '#111' }}>
          <button
            title="File Explorer"
            onClick={handleToggleExplorer}
            className="icon-button"
            style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Folder size={18} />
          </button>
          <button
            title="Source Control (coming soon)"
            disabled
            className="icon-button"
            style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}
          >
            <GitBranch size={18} />
          </button>
        </div>

        <div className="editor-container" style={{ flex: 1, minWidth: 0 }}>
          {showExplorer ? (
            <PanelGroup direction="horizontal">
              <Panel
                defaultSize={25}
                minSize={12}
                maxSize={40}
                onResize={(size) => {
                  // Debounce the resize to prevent excessive updates
                  const containerWidth = shellRef.current?.clientWidth || 1200;
                  const px = Math.round((size / 100) * containerWidth);
                  if (Math.abs(px - explorerWidth) > 5) {
                    setExplorerWidth(px);
                  }
                }}
              >
                <div style={{ height: '100%', background: '#1e1e1e', overflow: 'auto' }}>
                  <FileTree
                    namespace={namespace}
                    app={app}
                    selectedFile={selectedFile}
                    onFileSelect={onFileSelect}
                    basePath={basePath}
                    title="Explorer"
                    whitelistRoots={
                      basePath === ''
                        ? ['pages', 'components', 'navigation']
                        : basePath === 'controllers'
                          ? ['controllers']
                          : basePath === 'data'
                            ? ['data']
                            : basePath === 'automations'
                              ? ['automations']
                              : null
                    }
                  />
                </div>
              </Panel>
              <PanelResizeHandle style={{ 
                width: '1px', 
                background: '#2a2a2a', 
                cursor: 'col-resize',
                minWidth: '1px',
                maxWidth: '1px'
              }} />
              <Panel minSize={30}>
                <div style={{ height: '100%' }}>
                  {loading ? <div className="loading">Loading file content...</div> : renderEditor()}
                </div>
              </Panel>
            </PanelGroup>
          ) : (
            <div style={{ height: '100%' }}>
              {loading ? <div className="loading">Loading file content...</div> : renderEditor()}
            </div>
          )}
        </div>
      </div>
      
      {showSuccessMessage && (
        <div className="success-message">
          File saved successfully!
        </div>
      )}
      
      {/* Floating save button when header is hidden */}
      {!showHeader && selectedFile && hasChanges && (
        <button
          className="save-button"
          onClick={saveFile}
          disabled={saving}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      )}
    </div>
  );
}
