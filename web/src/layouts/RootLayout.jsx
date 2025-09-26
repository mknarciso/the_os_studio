import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavigationSidebar } from '../components/NavigationSidebar';
import { MainContent } from '../components/MainContent';
import { LightRays } from "@/components/ui/light-rays"

export function RootLayout() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [showChat, setShowChat] = useState(true);

  const { namespace = 'quero', app = 'flow', area = 'documentation' } = params;

  const handleContextChange = (newNamespace, newApp) => {
    const nextPath = `/${newNamespace}/${newApp}/${area}`;
    if (location.pathname !== nextPath) navigate(nextPath, { replace: false });
  };

  const handleSectionChange = (nextArea, path) => {
    const nextPath = `/${namespace}/${app}/${nextArea}`;
    if (location.pathname !== nextPath) navigate(nextPath, { replace: false, state: { sectionPath: path } });
  };

  return (
    <div className="app relative" style={{ backgroundColor: "var(--background)" }}>
      <LightRays color="var(--primary)" />
      <TopBar
        namespace={namespace}
        app={app}
        onContextChange={handleContextChange}
        showChat={showChat}
        onToggleChat={() => setShowChat(!showChat)}
      />
      <div className="main-layout">
        <NavigationSidebar
          activeSection={area}
          onSectionChange={handleSectionChange}
          namespace={namespace}
          app={app}
        />
        <Outlet context={{ namespace, app, area, showChat }} />
      </div>
    </div>
  );
}


