import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionLineType,
  Panel,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ApiService } from '../services/api';
import { X, LayoutGrid } from 'lucide-react';

// Custom node component
const CustomNode = ({ data, selected }) => {
  const getNodeColors = () => {
    if (data.type === 'page') {
      return {
        bg: 'bg-gradient-to-r from-blue-600 to-blue-700',
        border: 'border-blue-300',
        text: 'text-white'
      };
    } else {
      return {
        bg: 'bg-gradient-to-r from-emerald-600 to-emerald-700', 
        border: 'border-emerald-300',
        text: 'text-white'
      };
    }
  };

  const colors = getNodeColors();

  const shouldShowPath = data.path && data.path !== data.name && data.path.trim() !== '';

  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-yellow-400' : ''}`}
      style={{
        width: '240px',
        height: shouldShowPath ? '80px' : '60px', // 2 linhas com path, 1 linha sem path
        padding: '12px 16px',
        background: 'rgba(37, 17, 50, 0.9)',
        backdropFilter: 'blur(10px)',
        border: data.type === 'page'
          ? '1px solid rgba(59, 130, 246, 0.25)' // Azul mais sutil para pages
          : '1px solid rgba(16, 185, 129, 0.25)', // Verde mais sutil para components
        borderRadius: '8px',
        boxShadow: data.type === 'page'
          ? '0 0 0 1px rgba(59, 130, 246, 0.12), 0 0 16px rgba(59, 130, 246, 0.08)'
          : '0 0 0 1px rgba(16, 185, 129, 0.12), 0 0 16px rgba(16, 185, 129, 0.08)',
        color: '#d4d4d4',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Input handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'rgba(138,43,226,0.8)',
          border: '2px solid rgba(255,56,255,0.5)',
          width: 10,
          height: 10,
          borderRadius: '50%',
        }}
      />
      
      <div 
        className="font-medium text-sm text-white" 
        style={{ 
          lineHeight: '1.2',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%'
        }}
        title={data.name}
      >
        {data.name}
      </div>
      {shouldShowPath && (
        <div 
          className="text-xs opacity-70 mt-1" 
          style={{ 
            color: '#969696', 
            lineHeight: '1.2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            width: '100%'
          }}
          title={data.path}
        >
          {data.path}
        </div>
      )}
      
      {/* Output handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'rgba(138,43,226,0.8)',
          border: '2px solid rgba(255,56,255,0.5)',
          width: 10,
          height: 10,
          borderRadius: '50%',
        }}
      />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// Layout algorithms
const getAutoLayoutedElements = (nodes, edges, direction = 'LR') => {
  const nodeWidth = 240;
  const nodeHeight = 80; // Altura para 2 linhas
  const horizontalSpacing = 400;
  const verticalSpacing = 120;
  
  // Separar pages e components
  const pages = nodes.filter(node => node.data.type === 'page');
  const components = nodes.filter(node => node.data.type === 'component');
  
  // Contar quantas vezes cada component é importado
  const importCount = new Map();
  components.forEach(comp => importCount.set(comp.id, 0));
  
  edges.forEach(edge => {
    if (importCount.has(edge.target)) {
      importCount.set(edge.target, importCount.get(edge.target) + 1);
    }
  });
  
  // Classificar components por nível
  const componentsByLevel = new Map();
  
  // Nível 1: Components importados diretamente por pages
  const level1Components = new Set();
  pages.forEach(page => {
    edges.forEach(edge => {
      if (edge.source === page.id && components.find(c => c.id === edge.target)) {
        level1Components.add(edge.target);
      }
    });
  });
  
  // Nível 2: Components importados por outros components (mas não por pages)
  const level2Components = new Set();
  components.forEach(comp => {
    if (!level1Components.has(comp.id)) {
      const isImportedByComponent = edges.some(edge => 
        edge.target === comp.id && 
        components.find(c => c.id === edge.source)
      );
      if (isImportedByComponent) {
        level2Components.add(comp.id);
      }
    }
  });
  
  // Nível 3: Components órfãos (não importados por ninguém)
  const level3Components = new Set();
  components.forEach(comp => {
    if (!level1Components.has(comp.id) && !level2Components.has(comp.id)) {
      const isImported = edges.some(edge => edge.target === comp.id);
      if (!isImported) {
        level3Components.add(comp.id);
      }
    }
  });
  
  // Organizar components por nível e ordenar por quantidade de importações
  const sortComponentsByImports = (componentIds) => {
    return [...componentIds].sort((a, b) => {
      const countA = importCount.get(a) || 0;
      const countB = importCount.get(b) || 0;
      if (countB !== countA) {
        return countB - countA; // Mais importados primeiro
      }
      // Em caso de empate, ordenar por nome para consistência
      const nodeA = components.find(c => c.id === a);
      const nodeB = components.find(c => c.id === b);
      return (nodeA?.data.name || '').localeCompare(nodeB?.data.name || '');
    });
  };
  
  componentsByLevel.set(1, sortComponentsByImports(level1Components));
  componentsByLevel.set(2, sortComponentsByImports(level2Components));
  componentsByLevel.set(3, sortComponentsByImports(level3Components));
  
  // Posicionar nodes
  const layoutedNodes = [];
  
  // Nível 0: Pages (ordenar por nome)
  const sortedPages = [...pages].sort((a, b) => 
    a.data.name.localeCompare(b.data.name)
  );
  
  sortedPages.forEach((page, index) => {
    const levelHeight = (sortedPages.length - 1) * verticalSpacing;
    const startY = -levelHeight / 2;
    
    layoutedNodes.push({
      ...page,
      position: {
        x: 0,
        y: startY + index * verticalSpacing
      }
    });
  });
  
  // Níveis 1, 2, 3: Components
  [1, 2, 3].forEach(level => {
    const levelComponents = componentsByLevel.get(level) || [];
    const levelNodes = levelComponents.map(id => components.find(c => c.id === id)).filter(Boolean);
    
    levelNodes.forEach((comp, index) => {
      const levelHeight = (levelNodes.length - 1) * verticalSpacing;
      const startY = -levelHeight / 2;
      
      layoutedNodes.push({
        ...comp,
        position: {
          x: level * horizontalSpacing,
          y: startY + index * verticalSpacing
        }
      });
    });
  });
  
  return { nodes: layoutedNodes, edges };
};

const getForceLayoutedElements = (nodes, edges) => {
  // Simple force-directed layout simulation
  const iterations = 100;
  const repulsion = 1000;
  const attraction = 0.1;
  const damping = 0.9;
  
  let layoutedNodes = nodes.map(node => ({
    ...node,
    position: {
      x: Math.random() * 800,
      y: Math.random() * 600
    },
    velocity: { x: 0, y: 0 }
  }));
  
  for (let i = 0; i < iterations; i++) {
    // Calculate forces
    layoutedNodes.forEach(node => {
      let fx = 0, fy = 0;
      
      // Repulsion between all nodes
      layoutedNodes.forEach(other => {
        if (node.id !== other.id) {
          const dx = node.position.x - other.position.x;
          const dy = node.position.y - other.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (distance * distance);
          
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        }
      });
      
      // Attraction along edges
      edges.forEach(edge => {
        if (edge.source === node.id) {
          const target = layoutedNodes.find(n => n.id === edge.target);
          if (target) {
            const dx = target.position.x - node.position.x;
            const dy = target.position.y - node.position.y;
            
            fx += dx * attraction;
            fy += dy * attraction;
          }
        }
        if (edge.target === node.id) {
          const source = layoutedNodes.find(n => n.id === edge.source);
          if (source) {
            const dx = source.position.x - node.position.x;
            const dy = source.position.y - node.position.y;
            
            fx += dx * attraction;
            fy += dy * attraction;
          }
        }
      });
      
      // Update velocity and position
      node.velocity.x = (node.velocity.x + fx) * damping;
      node.velocity.y = (node.velocity.y + fy) * damping;
      
      node.position.x += node.velocity.x;
      node.position.y += node.velocity.y;
    });
  }
  
  // Remove velocity property
  const finalNodes = layoutedNodes.map(({ velocity, ...node }) => node);
  
  return { nodes: finalNodes, edges };
};

const PagesGraph = ({ namespace, app, uiData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [loadedUiData, setLoadedUiData] = useState(uiData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load UI data from file if not provided as prop
  useEffect(() => {
    if (uiData) {
      setLoadedUiData(uiData);
      return;
    }

    if (!namespace || !app) {
      return;
    }

    const loadUiData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to load ui.json from docs folder
        const uiJsonPath = 'docs/ui.json';
        const response = await ApiService.getFileContent(namespace, app, uiJsonPath);
        const parsedData = JSON.parse(response.content);
        setLoadedUiData(parsedData);
      } catch (err) {
        console.warn('Could not load ui.json:', err.message);
        setError(`Could not load ui.json: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadUiData();
  }, [namespace, app, uiData]);

  // Parse UI data and create nodes and edges
  const { parsedNodes, parsedEdges } = useMemo(() => {
    if (!loadedUiData) return { parsedNodes: [], parsedEdges: [] };

    const allItems = { ...loadedUiData.components, ...loadedUiData.pages };
    const parsedNodes = [];
    const parsedEdges = [];

    // Create nodes
    Object.entries(allItems).forEach(([key, item], index) => {
      const isPage = loadedUiData.pages && loadedUiData.pages[key];
      const path = item.file_path
        ? item.file_path.replace(/^(pages|components)\//, '').replace(/\.[^/.]+$/, '')
        : '';

      parsedNodes.push({
        id: key,
        type: 'custom',
        position: { x: (index % 5) * 250, y: Math.floor(index / 5) * 150 },
        data: {
          name: item.name,
          path: path,
          type: isPage ? 'page' : 'component',
        },
      });
    });

    // Create edges based on component dependencies
    Object.entries(allItems).forEach(([key, item]) => {
      if (item.components && Array.isArray(item.components)) {
        item.components.forEach((componentName) => {
          if (allItems[componentName]) {
            parsedEdges.push({
              id: `${key}-${componentName}`,
              source: key,
              target: componentName,
              type: 'bezier',
              style: { stroke: '#64748b', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
                color: '#64748b',
              },
            });
          }
        });
      }
    });

    return { parsedNodes, parsedEdges };
  }, [loadedUiData]);

  // Initialize nodes and edges with auto layout
  useEffect(() => {
    if (parsedNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getAutoLayoutedElements(parsedNodes, parsedEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [parsedNodes, parsedEdges, setNodes, setEdges]);

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    if (selectedNodeId === node.id) {
      // If clicking the same node, clear selection
      clearSelection();
      return;
    }

    setSelectedNodeId(node.id);

    // Find connected nodes
    const connectedNodeIds = new Set([node.id]);
    
    // Find nodes that depend on this node (targets)
    const dependents = parsedEdges
      .filter(edge => edge.source === node.id)
      .map(edge => edge.target);
    
    // Find nodes that this node depends on (sources)
    const dependencies = parsedEdges
      .filter(edge => edge.target === node.id)
      .map(edge => edge.source);

    dependents.forEach(id => connectedNodeIds.add(id));
    dependencies.forEach(id => connectedNodeIds.add(id));

    // Filter nodes and edges to show only connected ones
    const filteredNodes = parsedNodes.filter(n => connectedNodeIds.has(n.id));
    const filteredEdges = parsedEdges.filter(e => 
      connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target)
    );

    // Position nodes: dependencies on left, selected in center, dependents on right
    const positionedNodes = filteredNodes.map((n, index) => {
      let x = 0;
      let y = 0;
      
      if (n.id === node.id) {
        x = 0; // Center
        y = 0;
      } else if (dependencies.includes(n.id)) {
        x = -350; // Left (dependencies)
        y = dependencies.indexOf(n.id) * 120; // Espaçamento vertical
      } else if (dependents.includes(n.id)) {
        x = 350; // Right (dependents)
        y = dependents.indexOf(n.id) * 120; // Espaçamento vertical
      }

      return {
        ...n,
        position: { x, y },
      };
    });

    setNodes(positionedNodes);
    setEdges(filteredEdges);

    // Fit view after a short delay to ensure nodes are positioned
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
    }, 100);
  }, [selectedNodeId, parsedNodes, parsedEdges, setNodes, setEdges, reactFlowInstance]);

  // Clear selection and show all nodes
  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
    
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.1 });
      }
    }, 100);
  }, [parsedNodes, parsedEdges, setNodes, setEdges, reactFlowInstance]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onInit = useCallback((instance) => {
    setReactFlowInstance(instance);
  }, []);

  // Layout functions
  const applyAutoLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getAutoLayoutedElements(parsedNodes, parsedEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.1 });
      }
    }, 100);
  }, [parsedNodes, parsedEdges, setNodes, setEdges, reactFlowInstance]);


  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">Loading UI Graph...</div>
          <div className="text-sm text-gray-400">
            Reading ui.json from {namespace}/{app}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2 text-red-400">Error loading UI data</div>
          <div className="text-sm text-gray-400 mb-4">
            {error}
          </div>
          <div className="text-xs text-gray-500">
            Make sure docs/ui.json exists in {namespace}/{app}
          </div>
        </div>
      </div>
    );
  }

  if (!loadedUiData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-xl mb-2">No UI data available</div>
          <div className="text-sm text-gray-400">
            Load a ui.json file to visualize the component graph
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={{
          type: 'bezier',
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color: '#64748b' },
        }}
        className="bg-gray-900"
        style={{ width: '100%', height: '100%' }}
        fitView
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitViewOptions={{ 
          padding: 0.1,
          includeHiddenNodes: false,
          minZoom: 0.1,
          maxZoom: 1
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" className="rf-controls--dark">
          {selectedNodeId && (
            <ControlButton title="Clear Selection" onClick={clearSelection} className="rf-controls__btn rf-controls__btn--danger">
              <X size={12} color="#ffffff" />
            </ControlButton>
          )}
          <ControlButton title="Auto Layout" onClick={applyAutoLayout} className="rf-controls__btn rf-controls__btn--primary">
            <LayoutGrid size={12} color="#ffffff" />
          </ControlButton>
          <button
            onClick={async () => {
              try {
                const res = await ApiService.runUiGraph({ action: 'update_all', namespace, app });
                const updated = res?.result?.updated ?? 0;
                alert(`Atualizado todos os ui.json: ${updated} itens`);
                // Força recarregar o ui.json e redesenhar
                const ui = await ApiService.getUiJson(namespace, app);
                if (ui) {
                  const pagesRecord = ui.pages ?? {};
                  const componentsRecord = ui.components ?? {};
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
                  // setPageNames(pageNamesLocal); // These states are not defined in the original file
                  // setComponentNames(componentNamesLocal); // These states are not defined in the original file
                  // setPagesPathByName(pagesPathMap); // These states are not defined in the original file
                  // setComponentsPathByName(componentsPathMap); // These states are not defined in the original file
                  const pageNameSet = new Set(pageNamesLocal);
                  const componentNameSet = new Set(componentNamesLocal);
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
                  const deduped = edges.filter(e => {
                    const key = `${e.from}->${e.to}`;
                    if (unique.has(key)) return false;
                    unique.add(key);
                    return true;
                  });
                  // setEdgesFromUi(deduped); // This state is not defined in the original file
                }
              } catch (err) {
                alert(`Erro ao atualizar ui.json: ${err.message}`);
              }
            }}
            title="Atualizar TODA a documentação de UI (todos os ui.json)"
            style={{ fontSize: 12, padding: '6px 8px', background: '#b91c1c', color: '#e5e7eb', border: '1px solid #991b1b', borderRadius: 6 }}
          >
            Update All
          </button>
        </Controls>
        <Background color="#4b5563" gap={20} />
        
        <Panel position="top-left" className="react-flow__panel legend--dark">
          <div 
            className="flex gap-3 p-3"
          >
            <div className="flex items-center gap-2 text-sm text-white">
              <div className="dot" style={{ color: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.2)' }}></div>
              <span>Pages</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white">
              <div className="dot" style={{ color: 'rgba(16, 185, 129, 1)', backgroundColor: 'rgba(16, 185, 129, 0.2)' }}></div>
              <span>Components</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default PagesGraph;
