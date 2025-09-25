import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiService } from '../services/api';
import ReactFlow, { Background, Controls, MiniMap, useEdgesState, useNodesState, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

function parseImportSpecifiers(content) {
  const results = new Set();
  if (!content) return [];

  const patterns = [
    /import\s+[^'";]+?from\s+['"]([^'"\n]+)['"];?/g,
    /import\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /import\s+['"]([^'"\n]+)['"];?/g,
  ];
  for (const re of patterns) {
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(content)) !== null) results.add(m[1]);
  }
  return Array.from(results);
}

const EXTS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

function normalizePath(p) {
  if (!p) return '';
  const parts = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length) parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join('/');
}

function sanitizeLabel(p) {
  return p.replace(/^\.\//, '').replace(/^pages\/?/, '').replace(/^components\/?/, '');
}

function splitPathLabel(p) {
  const parts = p.split('/');
  const file = parts.pop() || p;
  const dir = parts.join('/');
  return { file, dir };
}

function truncateEnd(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)) + '…';
}

function truncateMiddle(str, max) {
  if (!str) return '';
  if (str.length <= max) return str;
  const half = Math.floor((max - 1) / 2);
  return str.slice(0, half) + '…' + str.slice(str.length - half);
}

function findInTree(tree, path) {
  if (!tree) return null;
  if (tree.path === path) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findInTree(child, path);
      if (found) return found;
    }
  }
  return null;
}

function flattenFiles(tree) {
  const items = [];
  if (!tree) return items;
  const stack = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === 'file') items.push(node.path);
    if (node.children) {
      for (const child of node.children) stack.push(child);
    }
  }
  return items;
}

function resolveRelative(importer, spec, files) {
  // Relative imports
  if (spec.startsWith('./') || spec.startsWith('../')) {
    const importerDir = importer.split('/').slice(0, -1).join('/');
    const base = normalizePath((importerDir ? importerDir + '/' : '') + spec);
    if (files.has(base)) return base;
    for (const ext of EXTS) {
      const cand = base.endsWith(ext) ? base : base + ext;
      if (files.has(cand)) return cand;
    }
    return undefined;
  }

  // Root-like short imports commonly used in apps
  if (spec.startsWith('components/')) {
    const base = normalizePath(spec);
    if (files.has(base)) return base;
    for (const ext of EXTS) {
      const cand = base.endsWith(ext) ? base : base + ext;
      if (files.has(cand)) return cand;
    }
  }
  if (spec.startsWith('pages/')) {
    const base = normalizePath(spec);
    if (files.has(base)) return base;
    for (const ext of EXTS) {
      const cand = base.endsWith(ext) ? base : base + ext;
      if (files.has(cand)) return cand;
    }
  }

  return undefined;
}

function findAllDirsByName(tree, targetName) {
  const result = [];
  if (!tree) return result;
  const stack = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.type === 'directory' && node.name === targetName) {
      result.push(node.path);
    }
    if (node.children) {
      for (const child of node.children) stack.push(child);
    }
  }
  return result;
}

export function PagesGraph({ namespace, app }) {
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [pageNames, setPageNames] = useState([]);
  const [componentNames, setComponentNames] = useState([]);
  const [pagesPathByName, setPagesPathByName] = useState({});
  const [componentsPathByName, setComponentsPathByName] = useState({});
  const [edgesFromUi, setEdgesFromUi] = useState([]);
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [focused, setFocused] = useState(null);
  const [overridePlaced, setOverridePlaced] = useState(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const update = () => {
      if (!svgRef.current) return;
      setSize({ width: svgRef.current.clientWidth || 800, height: svgRef.current.clientHeight || 600 });
    };
    update();
    const ro = new ResizeObserver(update);
    if (svgRef.current) ro.observe(svgRef.current);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      try { ro.disconnect(); } catch {}
    };
  }, []);

  useEffect(() => {
    async function loadFromUi() {
      const ui = await ApiService.getUiJson(namespace, app);
      if (!ui || (!ui.pages && !ui.components)) {
        setPageNames([]);
        setComponentNames([]);
        setPagesPathByName({});
        setComponentsPathByName({});
        setEdgesFromUi([]);
        return;
      }

      const pagesRecord = ui.pages || {};
      const componentsRecord = ui.components || {};

      const pageNamesLocal = [];
      const pagesPathMap = {};
      for (const [key, val] of Object.entries(pagesRecord)) {
        const name = val?.name || key;
        const path = typeof val?.file_path === 'string' ? val.file_path.replace(/^\//, '') : '';
        pageNamesLocal.push(name);
        pagesPathMap[name] = path;
      }

      const componentNamesLocal = [];
      const componentsPathMap = {};
      for (const [key, val] of Object.entries(componentsRecord)) {
        const name = val?.name || key;
        const path = typeof val?.file_path === 'string' ? val.file_path.replace(/^\//, '') : '';
        componentNamesLocal.push(name);
        componentsPathMap[name] = path;
      }

      setPageNames(pageNamesLocal);
      setComponentNames(componentNamesLocal);
      setPagesPathByName(pagesPathMap);
      setComponentsPathByName(componentsPathMap);

      const componentNameSet = new Set(componentNamesLocal);
      const pageNameSet = new Set(pageNamesLocal);
      const edges = [];

      // Edges: Page -> Component (pages[].components by name)
      for (const [key, val] of Object.entries(pagesRecord)) {
        const pageName = val?.name || key;
        const used = Array.isArray(val?.components) ? val.components : [];
        for (const u of used) {
          const refName = typeof u === 'string' ? u : u?.name;
          if (refName && componentNameSet.has(refName) && pageNameSet.has(pageName)) {
            edges.push({ from: pageName, to: refName });
          }
        }
      }

      // Edges: Component -> Component (components[].components by name)
      for (const [key, val] of Object.entries(componentsRecord)) {
        const compName = val?.name || key;
        const used = Array.isArray(val?.components) ? val.components : [];
        for (const u of used) {
          const refName = typeof u === 'string' ? u : u?.name;
          if (refName && componentNameSet.has(refName) && componentNameSet.has(compName)) {
            edges.push({ from: compName, to: refName });
          }
        }
      }

      // Deduplicate edges
      const unique = new Set();
      const deduped = [];
      for (const e of edges) {
        const k = `${e.from}->${e.to}`;
        if (!unique.has(k)) {
          unique.add(k);
          deduped.push(e);
        }
      }
      setEdgesFromUi(deduped);
    }
    loadFromUi();
  }, [namespace, app]);

  // Removed legacy file-content loading; we rely solely on ui.json

  const graph = useMemo(() => {
    return { pages: pageNames, components: componentNames, edges: edgesFromUi };
  }, [pageNames, componentNames, edgesFromUi]);

  const nodeHeight = 48;
  const vGap = 12;
  const leftX = Math.max(160, Math.min(240, Math.floor(size.width * 0.2)));
  const rightBaseX = Math.max(Math.floor(size.width * 0.65), size.width - Math.max(300, leftX + 300));
  const rightMaxX = Math.max(Math.floor(size.width * 0.9), rightBaseX + 120);

  const componentNameSet = new Set(graph.components);
  const pageNameSet = new Set(graph.pages);

  const basePlacedNodes = useMemo(() => {
    const map = {};
    const pagesSorted = [...graph.pages].sort((a, b) => a.localeCompare(b));
    const compsSorted = [...graph.components].sort((a, b) => a.localeCompare(b));
    const laneHeight = nodeHeight + vGap;
    pagesSorted.forEach((name, index) => {
      const rawPath = pagesPathByName[name] || '';
      const cleanPath = sanitizeLabel(rawPath);
      const { file, dir } = splitPathLabel(cleanPath || name);
      const key = `p:${name}`;
      map[key] = { id: key, name, labelMain: file, labelSub: dir, kind: 'page', x: leftX, y: 40 + index * laneHeight };
    });
    // Compute component import counts (how many components each component imports)
    const compImportCounts = new Map();
    for (const comp of compsSorted) compImportCounts.set(comp, 0);
    edgesFromUi.forEach((e) => {
      if (componentNameSet.has(e.from) && componentNameSet.has(e.to)) {
        compImportCounts.set(e.from, (compImportCounts.get(e.from) || 0) + 1);
      }
    });
    const maxCount = Math.max(1, ...Array.from(compImportCounts.values()));

    // Group components by first path segment; within group, order by imports desc
    const groups = new Map();
    compsSorted.forEach((name) => {
      const raw = componentsPathByName[name] || '';
      const seg = (raw.split('/')[1] || '').toLowerCase();
      const g = seg || 'root';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(name);
    });
    let lane = 0;
    for (const [_g, names] of groups) {
      names
        .slice()
        .sort((a, b) => (compImportCounts.get(b) || 0) - (compImportCounts.get(a) || 0) || a.localeCompare(b))
        .forEach((name) => {
          const rawPath = componentsPathByName[name] || '';
          const cleanPath = sanitizeLabel(rawPath);
          const { file, dir } = splitPathLabel(cleanPath || name);
          const key = `c:${name}`;
          const count = compImportCounts.get(name) || 0;
          const t = maxCount === 0 ? 0 : count / maxCount; // 0..1
          const x = Math.floor(rightBaseX + t * (rightMaxX - rightBaseX));
          map[key] = { id: key, name, labelMain: file, labelSub: dir, kind: 'component', x, y: 40 + lane * laneHeight };
          lane++;
        });
      lane += 1;
    }
    return map;
  }, [graph.pages, graph.components, pagesPathByName, componentsPathByName, leftX, rightBaseX, rightMaxX, nodeHeight, vGap, edgesFromUi]);

  const focusPlacedNodes = useMemo(() => {
    if (!focused) return null;
    const { name, kind } = focused;
    const centerX = size.width / 2;
    const leftColX = centerX - 240;
    const rightColX = centerX + 240;

    const selectedKey = `${kind === 'page' ? 'p' : 'c'}:${name}`;
    const importers = [];
    const imports = [];
    for (const e of edgesFromUi) {
      if (e.to === name) importers.push(e.from);
      if (e.from === name) imports.push(e.to);
    }
    // De-dup
    const uniq = (arr) => Array.from(new Set(arr));
    const importersU = uniq(importers);
    const importsU = uniq(imports);

    const map = {};
    // Selected center
    const selRaw = kind === 'page' ? pagesPathByName[name] || '' : componentsPathByName[name] || '';
    const selPath = sanitizeLabel(selRaw);
    const { file: selFile, dir: selDir } = splitPathLabel(selPath || name);
    map[selectedKey] = { id: selectedKey, name, labelMain: selFile, labelSub: selDir, kind, x: centerX, y: 30 + Math.max(importersU.length, importsU.length) / 2 * (nodeHeight + vGap) };

    // Left: importers (nodes that import selected)
    importersU.forEach((n, i) => {
      const k = componentNameSet.has(n) ? `c:${n}` : `p:${n}`;
      const raw = componentNameSet.has(n) ? componentsPathByName[n] || '' : pagesPathByName[n] || '';
      const clean = sanitizeLabel(raw);
      const { file, dir } = splitPathLabel(clean || n);
      map[k] = { id: k, name: n, labelMain: file, labelSub: dir, kind: componentNameSet.has(n) ? 'component' : 'page', x: leftColX, y: 30 + i * (nodeHeight + vGap) };
    });

    // Right: imports (nodes that selected imports)
    importsU.forEach((n, i) => {
      const k = componentNameSet.has(n) ? `c:${n}` : `p:${n}`;
      const raw = componentNameSet.has(n) ? componentsPathByName[n] || '' : pagesPathByName[n] || '';
      const clean = sanitizeLabel(raw);
      const { file, dir } = splitPathLabel(clean || n);
      map[k] = { id: k, name: n, labelMain: file, labelSub: dir, kind: componentNameSet.has(n) ? 'component' : 'page', x: rightColX, y: 30 + i * (nodeHeight + vGap) };
    });

    return map;
  }, [focused, edgesFromUi, size.width, pagesPathByName, componentsPathByName, componentNameSet]);

  const placedNodes = overridePlaced || focusPlacedNodes || basePlacedNodes;

  function makeUiNodeComponent() {
    return ({ data }) => {
      const isPage = data?.kind === 'page';
      const stroke = isPage ? '#7c3aed' : '#2563eb';
      const bg = isPage ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)';
      return (
        <div style={{
          width: 200,
          height: 48,
          borderRadius: 8,
          padding: 6,
          background: bg,
          border: `1.5px solid ${stroke}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}>
          <div style={{ width: 12, height: 12, borderRadius: 999, background: stroke }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', lineHeight: '14px', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data?.labelMain || ''}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: '14px', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data?.labelSub || ''}</div>
          </div>
        </div>
      );
    };
  }
  const nodeTypes = useMemo(() => ({ uiNode: makeUiNodeComponent() }), []);

  const rfNodes = useMemo(() => {
    return Object.values(placedNodes).map((n) => ({
      id: n.id,
      position: { x: n.x - 100, y: n.y },
      data: { labelMain: n.labelMain, labelSub: n.labelSub, kind: n.kind, name: n.name },
      type: 'uiNode',
      sourcePosition: 'right',
      targetPosition: 'left',
    }));
  }, [placedNodes, nodeHeight]);

  const rfEdges = useMemo(() => {
    const edges = [];
    graph.edges.forEach((e, i) => {
      const fromKey = pageNameSet.has(e.from) ? `p:${e.from}` : `c:${e.from}`;
      const toKey = componentNameSet.has(e.to) ? `c:${e.to}` : `p:${e.to}`;
      if (!placedNodes[fromKey] || !placedNodes[toKey]) return;
      edges.push({
        id: `e-${fromKey}-${toKey}-${i}`,
        source: fromKey,
        target: toKey,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#cbd5e1',
        },
        style: { stroke: '#cbd5e1', strokeWidth: 2 },
      });
    });
    return edges;
  }, [graph.edges, placedNodes, pageNameSet, componentNameSet]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => setNodes(rfNodes), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges), [rfEdges, setEdges]);

  const onNodeDoubleClick = useCallback((event, node) => {
    event.stopPropagation();
    const name = node.data?.name;
    const kind = node.data?.kind;
    if (!name || !kind) return;
    setOverridePlaced(null);
    setFocused({ name, kind });
  }, []);

  // Auto-fit whenever focus changes
  useEffect(() => {
    if (focused) {
      // Defer to allow focusPlacedNodes to be computed
      const id = setTimeout(() => {
        if (focusPlacedNodes) {
          fitView(focusPlacedNodes);
        }
      }, 0);
      return () => clearTimeout(id);
    }
  }, [focused, focusPlacedNodes, size.width, size.height]);

  const totalRows = Math.max(graph.pages.length, graph.components.length);
  const svgH = Math.max(120 + totalRows * (nodeHeight + vGap), size.height - 20);
  const svgW = size.width;

  const padding = 24;

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(4, Math.max(0.2, transform.scale * delta));

    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // Convert cursor to graph coords before scaling
    const graphX = (cursorX - transform.x) / transform.scale;
    const graphY = (cursorY - transform.y) / transform.scale;

    // After scaling, keep the cursor fixed on the same graph point
    const newX = cursorX - graphX * newScale;
    const newY = cursorY - graphY * newScale;

    setTransform({ scale: newScale, x: newX, y: newY });
  }

  function onMouseDown(e) {
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { x: transform.x, y: transform.y };
  }
  function onMouseMove(e) {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTransform((t) => ({ ...t, x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy }));
  }
  function onMouseUp() {
    isPanningRef.current = false;
  }
  function onMouseLeave() {
    isPanningRef.current = false;
  }

  function resetView() {
    setTransform({ scale: 1, x: 0, y: 0 });
  }

  function fitView(targetNodesMap = placedNodes) {
    const nodeList = Object.values(targetNodesMap);
    if (nodeList.length === 0) {
      resetView();
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodeList) {
      const left = n.x - 100;
      const right = n.x + 100;
      const top = n.y;
      const bottom = n.y + nodeHeight;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const sx = (size.width - padding * 2) / (width || 1);
    const sy = (size.height - padding * 2) / (height || 1);
    const s = Math.max(0.2, Math.min(2, Math.min(sx, sy)));
    const tx = padding + (size.width - padding * 2 - width * s) / 2 - minX * s;
    const ty = padding + (size.height - padding * 2 - height * s) / 2 - minY * s;
    setTransform({ scale: s, x: tx, y: ty });
  }

  return (
    <>
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, display: 'flex', gap: 8 }}>
        <button onClick={resetView} style={{ fontSize: 12, padding: '6px 8px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}>Reset 100%</button>
        <button onClick={() => fitView()} style={{ fontSize: 12, padding: '6px 8px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}>Fit</button>
        <button
          onClick={() => { setOverridePlaced(null); setFocused(null); setTimeout(() => fitView(basePlacedNodes), 0); }}
          title="Auto-layout"
          style={{ fontSize: 12, padding: '6px 8px', background: '#334155', color: '#e5e7eb', border: '1px solid #475569', borderRadius: 6 }}
        >
          Auto Layout
        </button>
        <button
          onClick={() => {
            // simple force-like layout: push components further right based on out-degree and in-degree
            const outCounts = new Map();
            const inCounts = new Map();
            graph.components.forEach((c) => { outCounts.set(c, 0); inCounts.set(c, 0); });
            edgesFromUi.forEach((e) => {
              if (componentNameSet.has(e.from)) outCounts.set(e.from, (outCounts.get(e.from) || 0) + 1);
              if (componentNameSet.has(e.to)) inCounts.set(e.to, (inCounts.get(e.to) || 0) + 1);
            });
            const maxOut = Math.max(1, ...Array.from(outCounts.values()));
            const maxIn = Math.max(1, ...Array.from(inCounts.values()));

            const laneHeight = nodeHeight + vGap;
            const pagesSorted = [...graph.pages].sort((a, b) => a.localeCompare(b));
            const compsSorted = [...graph.components].sort((a, b) => (outCounts.get(b) || 0) - (outCounts.get(a) || 0) || (inCounts.get(b) || 0) - (inCounts.get(a) || 0) || a.localeCompare(b));

            const layout = {};
            pagesSorted.forEach((name, i) => {
              const raw = pagesPathByName[name] || '';
              const clean = sanitizeLabel(raw);
              const { file, dir } = splitPathLabel(clean || name);
              const key = `p:${name}`;
              layout[key] = { id: key, name, labelMain: file, labelSub: dir, kind: 'page', x: leftX, y: 40 + i * laneHeight };
            });
            compsSorted.forEach((name, i) => {
              const raw = componentsPathByName[name] || '';
              const clean = sanitizeLabel(raw);
              const { file, dir } = splitPathLabel(clean || name);
              const key = `c:${name}`;
              const tOut = (outCounts.get(name) || 0) / maxOut;
              const tIn = (inCounts.get(name) || 0) / maxIn;
              const t = Math.min(1, 0.6 * tOut + 0.4 * tIn);
              const x = Math.floor(rightBaseX + t * (rightMaxX - rightBaseX));
              layout[key] = { id: key, name, labelMain: file, labelSub: dir, kind: 'component', x, y: 40 + i * laneHeight };
            });

            setOverridePlaced(layout);
            setFocused(null);
            setTimeout(() => fitView(layout), 0);
          }}
          title="Force layout"
          style={{ fontSize: 12, padding: '6px 8px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        >
          Force Layout
        </button>
        {focused && (
          <button
            onClick={() => {
              setFocused(null);
              setTimeout(() => fitView(basePlacedNodes), 0);
            }}
            title="Clear focus"
            style={{ fontSize: 12, padding: '6px 8px', background: '#374151', color: '#e5e7eb', border: '1px solid #4b5563', borderRadius: 6 }}
          >
            Clear Focus
          </button>
        )}
        <button
          onClick={async () => {
            try {
              const res = await ApiService.runUiGraph({ action: 'update_all', namespace, app });
              // Feedback e recarrega ui.json
              const updated = res?.result?.updated ?? 0;
              alert(`Atualizado ui.json: ${updated} itens`);
              // Força recarregar o ui.json e redesenhar
              const ui = await ApiService.getUiJson(namespace, app);
              if (!ui || (!ui.pages && !ui.components)) {
                setPageNames([]);
                setComponentNames([]);
                setPagesPathByName({});
                setComponentsPathByName({});
                setEdgesFromUi([]);
              } else {
                const pagesRecord = ui.pages || {};
                const componentsRecord = ui.components || {};

                const pageNamesLocal = [];
                const pagesPathMap = {};
                for (const [key, val] of Object.entries(pagesRecord)) {
                  const name = val?.name || key;
                  const path = typeof val?.file_path === 'string' ? val.file_path.replace(/^\//, '') : '';
                  pageNamesLocal.push(name);
                  pagesPathMap[name] = path;
                }

                const componentNamesLocal = [];
                const componentsPathMap = {};
                for (const [key, val] of Object.entries(componentsRecord)) {
                  const name = val?.name || key;
                  const path = typeof val?.file_path === 'string' ? val.file_path.replace(/^\//, '') : '';
                  componentNamesLocal.push(name);
                  componentsPathMap[name] = path;
                }

                setPageNames(pageNamesLocal);
                setComponentNames(componentNamesLocal);
                setPagesPathByName(pagesPathMap);
                setComponentsPathByName(componentsPathMap);

                const componentNameSet = new Set(componentNamesLocal);
                const pageNameSet = new Set(pageNamesLocal);
                const edges = [];

                for (const [key, val] of Object.entries(pagesRecord)) {
                  const pageName = val?.name || key;
                  const used = Array.isArray(val?.components) ? val.components : [];
                  for (const u of used) {
                    const refName = typeof u === 'string' ? u : u?.name;
                    if (refName && componentNameSet.has(refName) && pageNameSet.has(pageName)) {
                      edges.push({ from: pageName, to: refName });
                    }
                  }
                }

                for (const [key, val] of Object.entries(componentsRecord)) {
                  const compName = val?.name || key;
                  const used = Array.isArray(val?.components) ? val.components : [];
                  for (const u of used) {
                    const refName = typeof u === 'string' ? u : u?.name;
                    if (refName && componentNameSet.has(refName) && componentNameSet.has(compName)) {
                      edges.push({ from: compName, to: refName });
                    }
                  }
                }

                const unique = new Set();
                const deduped = [];
                for (const e of edges) {
                  const k = `${e.from}->${e.to}`;
                  if (!unique.has(k)) {
                    unique.add(k);
                    deduped.push(e);
                  }
                }
                setEdgesFromUi(deduped);
              }
            } catch (e) {
              alert(`Falha ao atualizar UI: ${e?.message || e}`);
            }
          }}
          title="Atualizar documentação de UI (ui.json)"
          style={{ fontSize: 12, padding: '6px 8px', background: '#065f46', color: '#e5e7eb', border: '1px solid #064e3b', borderRadius: 6 }}
        >
          Update UI Doc
        </button>
      </div>
      <div ref={svgRef} style={{ width: '100%', height: '100%' }} onDoubleClick={() => { setFocused(null); setOverridePlaced(null); }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable={false}
          zoomOnDoubleClick={false}
          elementsSelectable={false}
          panOnDrag
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background gap={16} color="#2a2a2a" />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </>
  );
}

export default PagesGraph;


