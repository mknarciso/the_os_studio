import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  ConnectionLineType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ApiService } from '../services/api';
import { X } from 'lucide-react';
import Editor from '@monaco-editor/react';

// Basic validator that respects the structure from shared `entities.ts`
function validateEntityStructure(entity) {
  const errors = [];
  if (!entity || typeof entity !== 'object') {
    errors.push('Entity must be an object');
    return { valid: false, errors };
  }
  if (typeof entity.name !== 'string' || !entity.name) {
    errors.push('Missing string field: name');
  }
  if (entity.type !== 'object') {
    errors.push("Field 'type' must be 'object'");
  }
  if (!entity.properties || typeof entity.properties !== 'object') {
    errors.push('Missing object field: properties');
  } else {
    // Shallow validate properties
    for (const [propName, propSchema] of Object.entries(entity.properties)) {
      if (!propSchema || typeof propSchema !== 'object') {
        errors.push(`Property '${propName}' must be an object schema`);
        continue;
      }
      const t = propSchema.type;
      const allowed = ['string', 'number', 'boolean', 'object', 'array'];
      if (!allowed.includes(t)) {
        errors.push(`Property '${propName}': invalid type '${t}'`);
      }
      if (t === 'object') {
        if (propSchema.properties && typeof propSchema.properties !== 'object') {
          errors.push(`Property '${propName}': object.properties must be a record`);
        }
      }
      if (t === 'array') {
        if (!propSchema.items) {
          errors.push(`Property '${propName}': array.items is required`);
        }
      }
      if (propSchema.reference) {
        const ref = propSchema.reference;
        if (typeof ref !== 'object' || typeof ref.entity !== 'string' || !ref.entity) {
          errors.push(`Property '${propName}': reference.entity must be a non-empty string`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

// Custom node to show entity name and reference fields
const EntityNode = ({ data, selected }) => {
  return (
    <div
      className={`relative ${selected ? 'ring-2 ring-yellow-400' : ''}`}
      style={{
        width: 260,
        padding: '12px 14px',
        background: 'rgba(17, 24, 39, 0.9)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 8,
        color: '#e5e7eb',
        boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.12), 0 0 12px rgba(99, 102, 241, 0.08)'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'rgba(99,102,241,0.9)', width: 8, height: 8 }} />
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={data.name}>
        {data.name}
      </div>
      {Array.isArray(data.refFields) && data.refFields.length > 0 && (
        <div style={{ fontSize: 11, color: '#a1a1aa', maxHeight: 120, overflowY: 'auto' }}>
          {data.refFields.map((rf) => (
            <div key={`${rf.field}:${rf.target}`} title={`${rf.field} → ${rf.target}`}>• {rf.field} → {rf.target}</div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: 'rgba(99,102,241,0.9)', width: 8, height: 8 }} />
    </div>
  );
};

const nodeTypes = { entity: EntityNode };

function guessReferencesForEntity(entityName, entityDef, allEntityNames) {
  const refFields = [];
  const addRef = (field, target) => {
    if (target && allEntityNames.has(target) && target !== entityName) {
      refFields.push({ field, target });
    }
  };
  const props = entityDef?.properties || {};
  for (const [propName, schema] of Object.entries(props)) {
    // Explicit reference
    if (schema && typeof schema === 'object' && schema.reference && typeof schema.reference.entity === 'string') {
      addRef(propName, schema.reference.entity);
      continue;
    }
    // Array of references
    if (schema?.type === 'array') {
      const items = schema.items;
      if (items && typeof items === 'object') {
        if (items.reference && typeof items.reference.entity === 'string') {
          addRef(propName, items.reference.entity);
          continue;
        }
        if (typeof items.type === 'string' && propName.endsWith('_ids')) {
          const base = propName.slice(0, -4); // remove _ids
          if (allEntityNames.has(base)) addRef(propName, base);
        }
      }
    }
    // Heuristic: *_id points to {base}
    if (typeof schema?.type === 'string' && propName.endsWith('_id')) {
      const base = propName.slice(0, -3);
      if (allEntityNames.has(base)) addRef(propName, base);
    }
    // Heuristic: property equals exact entity name
    if (allEntityNames.has(propName)) addRef(propName, propName);
  }
  return refFields;
}

export default function DataSchemaGraph({ customer, namespace, app }) {
  const [rawEntities, setRawEntities] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const [selectedEntityName, setSelectedEntityName] = useState(null);
  const [editorValue, setEditorValue] = useState('');
  const [validationErrors, setValidationErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  // Load docs/entities.json
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await ApiService.getFileContent(customer, namespace, app, 'docs/entities.json');
        const obj = JSON.parse(res.content);
        if (isMounted) setRawEntities(obj);
      } catch (e) {
        if (isMounted) setError(e.message || 'Failed to load entities.json');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [customer, namespace, app]);

  // Build graph
  const { parsedNodes, parsedEdges } = useMemo(() => {
    if (!rawEntities || typeof rawEntities !== 'object') return { parsedNodes: [], parsedEdges: [] };
    const entityNames = new Set(Object.keys(rawEntities));
    const parsedNodes = [];
    const parsedEdges = [];
    let index = 0;
    for (const [name, def] of Object.entries(rawEntities)) {
      const refFields = guessReferencesForEntity(name, def, entityNames);
      parsedNodes.push({
        id: name,
        type: 'entity',
        position: { x: (index % 5) * 320, y: Math.floor(index / 5) * 160 },
        data: { name, refFields }
      });
      index++;
      for (const rf of refFields) {
        parsedEdges.push({
          id: `${name}:${rf.field}->${rf.target}`,
          source: name,
          target: rf.target,
          type: 'bezier',
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color: '#64748b' }
        });
      }
    }
    return { parsedNodes, parsedEdges };
  }, [rawEntities]);

  useEffect(() => {
    setNodes(parsedNodes);
    setEdges(parsedEdges);
    setTimeout(() => { if (rfInstance) rfInstance.fitView({ padding: 0.1 }); }, 100);
  }, [parsedNodes, parsedEdges]);

  const onInit = useCallback((inst) => setRfInstance(inst), []);

  const onNodeClick = useCallback((evt, node) => {
    const name = node?.id;
    if (!name || !rawEntities?.[name]) return;
    setSelectedEntityName(name);
    const entity = rawEntities[name];
    const text = JSON.stringify(entity, null, 2);
    setEditorValue(text);
    const v = validateEntityStructure(entity);
    setValidationErrors(v.valid ? [] : v.errors);
  }, [rawEntities]);

  const closeModal = useCallback(() => {
    setSelectedEntityName(null);
    setEditorValue('');
    setValidationErrors([]);
  }, []);

  const onEditorChange = useCallback((value) => {
    setEditorValue(value || '');
    try {
      const parsed = JSON.parse(value || '{}');
      const v = validateEntityStructure(parsed);
      setValidationErrors(v.valid ? [] : v.errors);
    } catch (e) {
      setValidationErrors([e.message]);
    }
  }, []);

  const saveEntity = useCallback(async () => {
    try {
      setSaving(true);
      const parsed = JSON.parse(editorValue || '{}');
      const v = validateEntityStructure(parsed);
      if (!v.valid) {
        alert('Fix validation errors before saving');
        return;
      }
      // Merge into file
      const updated = { ...(rawEntities || {}) };
      updated[parsed.name || selectedEntityName] = parsed;
      const content = JSON.stringify(updated, null, 2);
      await ApiService.saveFile(customer, namespace, app, 'docs/entities.json', content);
      setRawEntities(updated);
      closeModal();
    } catch (e) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [editorValue, rawEntities, customer, namespace, app, selectedEntityName, closeModal]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        Loading entities...
      </div>
    );
  }
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        Error: {error}
      </div>
    );
  }
  if (!rawEntities) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
        No entities found. Ensure docs/entities.json exists.
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
        onNodeClick={onNodeClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        defaultEdgeOptions={{
          type: 'bezier',
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed', color: '#64748b' }
        }}
        className="bg-gray-900"
        style={{ width: '100%', height: '100%' }}
        fitView
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" className="rf-controls--dark" />
        <Background color="#4b5563" gap={20} />

        <Panel position="top-left" className="react-flow__panel legend--dark">
          <div className="p-2 text-sm text-white">{namespace}_{app} schema</div>
        </Panel>
      </ReactFlow>

      {selectedEntityName && (
        <div
          className="fixed inset-0"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={closeModal}
        >
          <div
            style={{
              width: '80%',
              height: '80%',
              background: '#0b1220',
              border: '1px solid #1f2937',
              borderRadius: 8,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: '#0f172a', borderBottom: '1px solid #1f2937', color: '#e5e7eb' }}>
              <div style={{ fontWeight: 600 }}>Edit entity: {selectedEntityName}</div>
              <button onClick={closeModal} title="Close" style={{ color: '#e5e7eb' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', height: 'calc(100% - 46px)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  value={editorValue}
                  onChange={onEditorChange}
                  options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                />
              </div>
              <div style={{ width: 320, borderLeft: '1px solid #1f2937', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: 12, color: '#e5e7eb', fontSize: 12, borderBottom: '1px solid #1f2937' }}>Validation</div>
                <div style={{ padding: 12, color: '#94a3b8', fontSize: 12, overflowY: 'auto' }}>
                  {validationErrors.length === 0 ? (
                    <div style={{ color: '#10b981' }}>No validation errors</div>
                  ) : (
                    <ul style={{ listStyle: 'disc', paddingLeft: 18 }}>
                      {validationErrors.map((err, idx) => (
                        <li key={idx} style={{ marginBottom: 6 }}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ padding: 12, marginTop: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={closeModal} style={{ padding: '6px 10px', background: '#374151', color: '#e5e7eb', borderRadius: 6, border: '1px solid #4b5563' }}>Cancel</button>
                  <button onClick={saveEntity} disabled={saving || validationErrors.length > 0} style={{ padding: '6px 10px', background: validationErrors.length > 0 ? '#6b7280' : '#2563eb', color: '#e5e7eb', borderRadius: 6, border: '1px solid #1d4ed8' }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


