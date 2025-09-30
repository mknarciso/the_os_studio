import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { JsonEditor, githubLightTheme, githubDarkTheme } from 'json-edit-react';
import { ApiService } from '../services/api';
import { useIsDark } from '../hooks/useIsDark';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function SchemaJsonEditor({ namespace, app }) {
  const isDark = useIsDark();
  const theme = isDark ? githubDarkTheme : githubLightTheme;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [collapseLevel, setCollapseLevel] = useState(2);
  const [searchText, setSearchText] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ApiService.getFileContent(namespace, app, 'data/schemas/schema.json');
      const obj = JSON.parse(res.content || '{}');
      setData(obj);
    } catch (e) {
      setError(e?.message || 'Failed to load schema.json');
      setData({});
    } finally {
      setLoading(false);
    }
  }, [namespace, app]);

  useEffect(() => {
    load();
  }, [load]);

  const contentString = useMemo(() => {
    try { return JSON.stringify(data ?? {}, null, 2); } catch { return '{}'; }
  }, [data]);

  const save = useCallback(async () => {
    try {
      setSaving(true);
      const payload = JSON.stringify(data ?? {}, null, 2);
      await ApiService.saveFile(namespace, app, 'data/schemas/schema.json', payload);
      window.dispatchEvent(new CustomEvent('studio:file-saved'));
    } catch (e) {
      alert(e?.message || 'Failed to save schema.json');
    } finally {
      setSaving(false);
    }
  }, [namespace, app, data]);

  if (loading) return <div className="w-full h-full flex items-center justify-center">Loading schema.json…</div>;
  if (error) return <div className="w-full h-full flex items-center justify-center">Error: {error}</div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 500 }}>
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 8, zIndex: 5 }}>
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search..."
          className="h-7 w-[260px]"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Collapse</span>
          <Select value={String(collapseLevel)} onValueChange={(v) => setCollapseLevel(Number(v))}>
            <SelectTrigger className="h-7 w-[80px] px-2 py-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={save} disabled={saving} title="Save schema.json">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <div style={{ position: 'absolute', inset: 0 }}>
        <JsonEditor
          data={data ?? {}}
          setData={setData}
          theme={theme}
          showStringQuotes={false}
          keySort={false}
          restrictEdit={true}
          restrictAdd={true}
          restrictDelete={true}
          collapse={collapseLevel}
          searchText={searchText}
          searchFilter="all"
          searchDebounceTime={150}
        />
      </div>
    </div>
  );
}

export default SchemaJsonEditor;

