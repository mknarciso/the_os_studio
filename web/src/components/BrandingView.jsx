import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { ApiService } from '../services/api';

export function BrandingView({ activeTab, onTabChange, refreshKey }) {
  const [guideline, setGuideline] = useState('');
  const [css, setCss] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFiles();
  }, [refreshKey]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, c] = await Promise.all([
        ApiService.getBrandingFile('guideline.yaml').catch(() => ({ content: '' })),
        ApiService.getBrandingFile('index.css').catch(() => ({ content: '' })),
      ]);
      setGuideline(g?.content || '');
      setCss(c?.content || '');
    } catch (e) {
      setError(e?.message || 'Failed to load branding files');
    } finally {
      setLoading(false);
    }
  };

  const previewStyleTag = useMemo(() => {
    return <style dangerouslySetInnerHTML={{ __html: css }} />;
  }, [css]);

  const Preview = () => (
    <div style={{ padding: 16 }}>
      {previewStyleTag}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Cards</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--muted, #1a1a1a)', borderRadius: '8px', padding: 12, border: '1px solid #2a2a2a' }}>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ba3af)' }}>Card {i}</div>
                <div style={{ marginTop: 6, fontSize: 14 }}>Content</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Dashboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--muted, #1a1a1a)', borderRadius: '8px', padding: 12, border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ba3af)' }}>Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>$12,340</div>
            </div>
            <div style={{ background: 'var(--muted, #1a1a1a)', borderRadius: '8px', padding: 12, border: '1px solid #2a2a2a' }}>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ba3af)' }}>Users</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>1,248</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Mail</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background, #0b0b0b)', border: '1px solid #2a2a2a', borderRadius: 6, padding: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Subject {i}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ba3af)' }}>preview text goes here</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground, #9ba3af)' }}>10:{i}2</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Pricing</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {['Basic', 'Pro', 'Enterprise'].map((p, idx) => (
              <div key={p} style={{ background: 'var(--background, #0b0b0b)', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 700 }}>{p}</div>
                <div style={{ fontSize: 24, marginTop: 8 }}>${(idx+1)*9}</div>
                <button style={{ marginTop: 12, background: 'var(--primary, #4f46e5)', color: 'var(--primary-foreground, #fff)', border: 'none', padding: '8px 12px', borderRadius: 6 }}>Choose</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Color Palette</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {['background','foreground','muted','muted-foreground','primary','secondary'].map(k => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `var(--${k}, #444)`, border: '1px solid #2a2a2a' }} />
                <div style={{ fontSize: 10, color: 'var(--muted-foreground, #9ba3af)' }}>{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--card, #111)', borderRadius: '8px', padding: 16, border: '1px solid #333' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Typography</div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Heading 1</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Heading 2</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Heading 3</div>
            <div style={{ marginTop: 8, lineHeight: 1.6 }}>Body text example — lorem ipsum dolor sit amet, consectetur adipiscing elit.</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading-container"><div className="loading-text">Loading branding...</div></div>;
  }

  if (activeTab === 'guideline') {
    return (
      <Editor
        height="100%"
        language="yaml"
        value={guideline}
        onChange={() => {}}
        theme="vs-dark"
        options={{ readOnly: true, minimap: { enabled: false } }}
      />
    );
  }

  if (activeTab === 'css') {
    return (
      <Editor
        height="100%"
        language="css"
        value={css}
        onChange={() => {}}
        theme="vs-dark"
        options={{ readOnly: true, minimap: { enabled: false } }}
      />
    );
  }

  return <Preview />;
}


