import { useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext, useParams } from 'react-router-dom';
import { MainContent } from '../components/MainContent';

const VALID_AREAS = new Set(['branding', 'documentation', 'data', 'scopes', 'pages', 'automations', 'public-pages', 'agents']);

export function AreaPage() {
  const { namespace, app, area, showChat } = useOutletContext();
  const location = useLocation();
  const [sectionPath, setSectionPath] = useState('docs.md');

  useEffect(() => {
    if (location.state?.sectionPath) {
      setSectionPath(location.state.sectionPath);
    }
  }, [location.key]);

  if (!VALID_AREAS.has(area)) {
    return <div style={{ padding: 16 }}>Invalid area</div>;
  }

  return (
    <MainContent
      namespace={namespace}
      app={app}
      activeSection={area}
      sectionPath={sectionPath}
      showChat={showChat}
    />
  );
}


