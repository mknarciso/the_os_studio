import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, FileText, Code, Image, Settings, Database, Palette, Globe, Package } from 'lucide-react';
import { ApiService } from '../services/api';

export function FileTree({ namespace, app, selectedFile, onFileSelect, basePath = '', title = 'Explorer', whitelistRoots = null, customTree = null, expandAllOnLoad = false, renderRootChildrenOnly = false }) {
  const [fileTree, setFileTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDirs, setExpandedDirs] = useState(new Set());

  const collectDirs = (node, set) => {
    if (!node) return;
    if (node.type === 'directory' && typeof node.path === 'string') set.add(node.path);
    for (const child of node.children || []) collectDirs(child, set);
  };

  useEffect(() => {
    if (customTree) {
      // Use provided tree (diffs-only, etc.)
      setLoading(true);
      setError(null);
      try {
        setFileTree(customTree);
        if (customTree && expandedDirs.size === 0) {
          if (expandAllOnLoad) {
            const all = new Set();
            collectDirs(customTree, all);
            setExpandedDirs(all);
          } else {
            setExpandedDirs(new Set([customTree.path]));
          }
        }
      } catch (e) {
        setError((e && e.message) || 'Failed to load tree');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (namespace && app) {
      loadFileTree();
    }
  }, [namespace, app, basePath, customTree]);

  const loadFileTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getFileTree(namespace, app, basePath);
      let tree = data.tree;
      // Apply whitelist at root level if provided
      if (whitelistRoots && Array.isArray(whitelistRoots) && whitelistRoots.length > 0 && tree && tree.path === '.') {
        const allowed = new Set(whitelistRoots);
        const children = (tree.children || []).filter((c) => allowed.has(c.name));
        tree = { ...tree, children };
      }
      setFileTree(tree);
      
      // Auto-expand root directory
      if (tree) {
        setExpandedDirs(new Set([tree.path]));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return <FileText size={14} />;
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const iconMap = {
      'js': <Code size={14} style={{ color: '#f7df1e' }} />,
      'jsx': <Code size={14} style={{ color: '#61dafb' }} />,
      'ts': <Code size={14} style={{ color: '#3178c6' }} />,
      'tsx': <Code size={14} style={{ color: '#61dafb' }} />,
      'json': <Settings size={14} style={{ color: '#ffd700' }} />,
      'html': <Globe size={14} style={{ color: '#e34c26' }} />,
      'css': <Palette size={14} style={{ color: '#1572b6' }} />,
      'scss': <Palette size={14} style={{ color: '#cf649a' }} />,
      'sass': <Palette size={14} style={{ color: '#cf649a' }} />,
      'md': <FileText size={14} style={{ color: '#083fa1' }} />,
      'py': <Code size={14} style={{ color: '#3776ab' }} />,
      'sql': <Database size={14} style={{ color: '#336791' }} />,
      'xml': <Code size={14} style={{ color: '#ff6600' }} />,
      'yaml': <Settings size={14} style={{ color: '#cb171e' }} />,
      'yml': <Settings size={14} style={{ color: '#cb171e' }} />,
      'png': <Image size={14} style={{ color: '#4caf50' }} />,
      'jpg': <Image size={14} style={{ color: '#4caf50' }} />,
      'jpeg': <Image size={14} style={{ color: '#4caf50' }} />,
      'gif': <Image size={14} style={{ color: '#4caf50' }} />,
      'svg': <Image size={14} style={{ color: '#ff9800' }} />,
      'package': <Package size={14} style={{ color: '#cb3837' }} />,
    };
    
    return iconMap[extension] || <FileText size={14} style={{ color: '#a0a0a0' }} />;
  };

  const renderTreeItem = (item, depth = 0) => {
    const isExpanded = expandedDirs.has(item.path);
    const fullPath = item.path;
    const isSelected = selectedFile === fullPath;

    if (item.type === 'directory') {
      return (
        <div key={item.path}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `${8 + depth * 12}px`,
              paddingRight: '8px',
              height: '22px',
              cursor: 'pointer',
              fontSize: '13px',
              color: "var(--foreground)",
              backgroundColor: isSelected ? "color-mix(in srgb, var(--accent) 10%, var(--foreground) 10%)" : 'transparent',
              borderRadius: '3px',
              margin: '1px 4px',
            }}
            onClick={() => toggleDirectory(item.path)}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--accent) 20%, var(--foreground) 20%)";
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ marginRight: '4px', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
            <span style={{ 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              minWidth: 0,
              flex: 1
            }}>
              {item.name}
            </span>
          </div>
          {isExpanded && item.children && item.children.map(child => 
            renderTreeItem(child, depth + 1)
          )}
        </div>
      );
    } else {
      return (
        <div
          key={item.path}
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${20 + depth * 12}px`,
            paddingRight: '8px',
            height: '22px',
            cursor: 'pointer',
            fontSize: '13px',
            color: "var(--foreground)",
            backgroundColor: isSelected ? "color-mix(in srgb, var(--accent) 10%, var(--foreground) 10%)" : 'transparent',
            borderRadius: '3px',
            margin: '1px 4px',
          }}
          onClick={() => onFileSelect(fullPath)}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--accent) 20%, var(--foreground) 20%)";
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
            {getFileIcon(item.name)}
          </div>
          <span style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: 1
          }}>
            {item.name}
          </span>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '8px', color: "var(--muted-foreground)", fontSize: '12px' }}>Loading…</div>
    );
  }

  if (error) {
    return <div style={{ padding: '8px', color: '#f48771', fontSize: '12px' }}>Error: {error}</div>;
  }

  return (
    <div style={{ minWidth: 0, overflow: 'auto', background: "var(--background)", color: "var(--foreground)" }} className="py-2">
      {fileTree && (
        renderRootChildrenOnly && Array.isArray(fileTree.children)
          ? fileTree.children.map((child) => renderTreeItem(child))
          : renderTreeItem(fileTree)
      )}
    </div>
  );
}
