import { useMemo, useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

function ensureArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.values(value);
  return [];
}

function buildFlowSection(doc) {
  // Support both shapes: doc.app.flows (array) or doc.flows (object/array)
  const flows = ensureArray(doc?.app?.flows?.length ? doc.app.flows : doc?.flows);
  if (!flows.length) return '';

  let md = '## Flows\n\n';
  flows.forEach((flow, idx) => {
    const flowTitle = flow?.title || flow?.name || flow?.slug || `Flow ${idx + 1}`;
    const flowDesc = flow?.description ? `\n\n${flow.description}\n` : '';
    md += `### ${flowTitle}\n`;
    md += flowDesc ? `${flowDesc}\n` : '\n';

    const states = ensureArray(flow?.flow_states).sort((a, b) => {
      const ao = typeof a?.order === 'number' ? a.order : 0;
      const bo = typeof b?.order === 'number' ? b.order : 0;
      return ao - bo;
    });
    if (states.length) {
      md += `#### States\n`;
      states.forEach((st) => {
        const flags = [
          st?.is_initial ? 'initial' : null,
          st?.is_final ? 'final' : null,
        ].filter(Boolean);
        const flagsStr = flags.length ? ` (${flags.join(', ')})` : '';
        const transitions = ensureArray(st?.allowed_transitions);
        const roles = ensureArray(st?.required_roles);
        md += `- ${st?.name || st?.title || st?.slug}${flagsStr}\n`;
        if (transitions.length) md += `  - transitions: ${transitions.join(', ')}\n`;
        if (roles.length) md += `  - roles: ${roles.join(', ')}\n`;
      });
      md += '\n';
    }
  });
  return md;
}

function buildEntitiesSection(title, entitiesLike, opts = {}) {
  const list = ensureArray(entitiesLike);
  if (!list.length) return '';
  let md = `## ${title}\n\n`;
  list.forEach((ent, idx) => {
    const name = ent?.title || ent?.name || ent?.slug || `${title} ${idx + 1}`;
    const desc = ent?.description || ent?.context || '';
    md += `- **${name}**${desc ? `: ${desc}` : ''}\n`;
    // common fields
    const fields = Object.keys(ent || {}).filter(k => !['title','name','slug','description','context'].includes(k));
    fields.forEach((k) => {
      const v = ent[k];
      if (v == null) return;
      if (Array.isArray(v)) {
        md += `  - ${k}: ${v.join(', ')}\n`;
      } else if (typeof v === 'object') {
        md += `  - ${k}: ${JSON.stringify(v)}\n`;
      } else {
        md += `  - ${k}: ${String(v)}\n`;
      }
    });
  });
  md += '\n';
  return md;
}

function buildMarkdown(doc) {
  if (!doc) return '# Documentation\n';

  const appTitle = doc?.app?.title || doc?.metadata?.title || 'Documentation';
  const appContext = doc?.app?.context || doc?.metadata?.description || '';

  let md = `# ${appTitle}\n\n`;
  if (appContext) md += `${appContext}\n\n`;

  md += buildFlowSection(doc);

  // Optional sections if present in alt shapes
  // vendors (array or dict)
  const vendorsArr = ensureArray(doc?.app?.vendors?.length ? doc.app.vendors : (doc?.vendors));
  md += buildEntitiesSection('Vendors', vendorsArr);
  // roles
  const rolesArr = ensureArray(doc?.app?.roles?.length ? doc.app.roles : (doc?.roles));
  md += buildEntitiesSection('Roles', rolesArr);
  // activities
  const activitiesArr = ensureArray(doc?.app?.activities?.length ? doc.app.activities : (doc?.activities));
  md += buildEntitiesSection('Activities', activitiesArr);
  // stories
  const storiesArr = ensureArray(doc?.app?.stories?.length ? doc.app.stories : (doc?.stories));
  md += buildEntitiesSection('Stories', storiesArr);

  // test cases, including steps/input/output in detail
  const testsArr = ensureArray(doc?.test_cases);
  if (testsArr.length) {
    md += `## Test Cases\n\n`;
    testsArr.forEach((tc, i) => {
      const title = tc?.title || tc?.slug || `Test ${i + 1}`;
      md += `### ${title}\n`;
      if (tc?.story) md += `- story: ${tc.story}\n`;
      if (tc?.role) md += `- role: ${tc.role}\n`;
      if (tc?.interface) {
        md += `- interface: type=${tc.interface?.type || ''} target=${tc.interface?.target || ''}\n`;
      }
      if (Array.isArray(tc?.steps) && tc.steps.length) {
        md += `- steps:\n`;
        tc.steps.forEach((s, idx) => {
          md += `  ${idx + 1}. ${s}\n`;
        });
      }
      if (tc?.input) {
        md += `- input:\n`;
        Object.entries(tc.input).forEach(([k, v]) => {
          const valStr = Array.isArray(v) ? v.join(', ') : (typeof v === 'object' ? '\n' + '    ' + JSON.stringify(v) : String(v));
          if (typeof v === 'object' && !Array.isArray(v)) {
            md += `  - ${k}: ${JSON.stringify(v)}\n`;
          } else {
            md += `  - ${k}: ${valStr}\n`;
          }
        });
      }
      if (tc?.output) {
        md += `- output:\n`;
        Object.entries(tc.output).forEach(([k, v]) => {
          if (typeof v === 'object') {
            md += `  - ${k}: ${JSON.stringify(v)}\n`;
          } else {
            md += `  - ${k}: ${String(v)}\n`;
          }
        });
      }
      md += `\n`;
    });
  }

  // metadata
  if (doc?.metadata) {
    md += `## Metadata\n\n`;
    Object.entries(doc.metadata).forEach(([k, v]) => {
      md += `- ${k}: ${String(v)}\n`;
    });
    md += `\n`;
  }

  // Appendix: raw JSON
  md += `## Appendix: Raw JSON\n\n`;
  md += '```json\n' + JSON.stringify(doc, null, 2) + '\n```\n\n';

  return md.trim() + '\n';
}

export function DocumentationReader({ documentation }) {
  const markdown = useMemo(() => buildMarkdown(documentation), [documentation]);
  const editorRef = useRef(null);
  const [visibleTopLine, setVisibleTopLine] = useState(1);
  const [stickyPath, setStickyPath] = useState([]);
  const [outline, setOutline] = useState([]);

  const headings = useMemo(() => {
    const lines = (markdown || '').split('\n');
    const collected = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const title = match[2].trim();
        collected.push({ level, title, line: i + 1 });
      }
    }
    return collected;
  }, [markdown]);

  useEffect(() => {
    if (editorRef.current) {
      const container = editorRef.current.getContainerDomNode?.();
      if (container && editorRef.current.layout) {
        requestAnimationFrame(() => {
          editorRef.current.layout({ width: container.clientWidth, height: container.clientHeight });
        });
      }
    }
  }, [markdown]);

  const handleMount = (editor/* , monaco */) => {
    editorRef.current = editor;

    const updateTopLine = () => {
      try {
        const ranges = editor.getVisibleRanges?.();
        if (ranges && ranges[0]) {
          const top = ranges[0].startLineNumber;
          setVisibleTopLine(top);
        }
      } catch {}
    };

    updateTopLine();
    const scrollDisposable = editor.onDidScrollChange?.(() => updateTopLine());
    const contentDisposable = editor.onDidChangeModelContent?.(() => updateTopLine());

    editor.onDidDispose?.(() => {
      try { scrollDisposable && scrollDisposable.dispose && scrollDisposable.dispose(); } catch {}
      try { contentDisposable && contentDisposable.dispose && contentDisposable.dispose(); } catch {}
    });
  };

  useEffect(() => {
    if (!headings.length) {
      setStickyPath([]);
      setOutline([]);
      return;
    }
    // Build outline tree structure for left panel
    const stack = [];
    const root = [];
    headings.forEach((h) => {
      const node = { ...h, children: [] };
      while (stack.length && stack[stack.length - 1].level >= h.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    });
    setOutline(root);
    const path = [];
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (h.line <= visibleTopLine) {
        while (path.length && path[path.length - 1].level >= h.level) {
          path.pop();
        }
        path.push(h);
      } else {
        break;
      }
    }
    setStickyPath(path);
  }, [visibleTopLine, headings]);

  return (
    <div className="documentation-reader" style={{ position: 'relative', height: '100%', width: '100%', display: 'flex' }}>
      {/* Internal outline panel */}
      <div style={{ width: 260, borderRight: '1px solid #2a2a2a', background: '#111', overflow: 'auto' }}>
        <div style={{ padding: 8, fontSize: 12, color: '#9aa0a6', borderBottom: '1px solid #2a2a2a' }}>Outline</div>
        <div style={{ padding: 8 }}>
          {outline.map((node) => (
            <OutlineNode key={`${node.level}-${node.line}-${node.title}`} node={node} editorRef={editorRef} />
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
      {stickyPath.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            background: 'linear-gradient(rgba(20,20,20,0.9), rgba(20,20,20,0.85))',
            borderBottom: '1px solid #2a2a2a',
            pointerEvents: 'none',
          }}
        >
          {stickyPath.map((h, idx) => (
            <div
              key={`${h.level}-${h.line}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#c7c7c7',
                padding: '2px 8px',
                paddingLeft: 8 + (h.level - 1) * 12,
                borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={`L${h.line} • ${'#'.repeat(h.level)} ${h.title}`}
            >
              <span style={{ opacity: 0.6 }}>{'#'.repeat(h.level)}</span>
              <span>{h.title}</span>
              <span style={{ marginLeft: 'auto', opacity: 0.4 }}>L{h.line}</span>
            </div>
          ))}
        </div>
      )}
      {/* push editor down so overlay doesn't cover content */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        paddingTop: `${Math.max(0, stickyPath.length * 22)}px`
      }}>
        <Editor
          height="100%"
          language="markdown"
          value={markdown}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            readOnly: true,
            domReadOnly: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            stickyScroll: { enabled: false },
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'none',
            smoothScrolling: true,
          }}
        />
      </div>
      </div>
    </div>
  );
}

function OutlineNode({ node, editorRef }) {
  const handleClick = () => {
    try {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(node.line);
      editor.setPosition({ lineNumber: node.line, column: 1 });
      editor.focus();
    } catch {}
  };

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          paddingLeft: 4 + (node.level - 1) * 10,
          borderRadius: 4,
          color: '#e8eaed',
          fontSize: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={`L${node.line} • ${'#'.repeat(node.level)} ${node.title}`}
      >
        <span style={{ opacity: 0.5, marginRight: 6 }}>{'#'.repeat(node.level)}</span>
        {node.title}
      </div>
      {node.children?.length > 0 && (
        <div>
          {node.children.map((child) => (
            <OutlineNode key={`${child.level}-${child.line}-${child.title}`} node={child} editorRef={editorRef} />
          ))}
        </div>
      )}
    </div>
  );
}


