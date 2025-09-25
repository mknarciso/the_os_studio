import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { NavigationSidebar } from '../components/NavigationSidebar';
import { MainContent } from '../components/MainContent';

export function RootLayout() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [showChat, setShowChat] = useState(true);

  const { customer = 'quero', namespace = 'quero', app = 'flow', area = 'documentation' } = params;

  const handleContextChange = (newCustomer, newNamespace, newApp) => {
    const nextPath = `/${newCustomer}/${newNamespace}/${newApp}/${area}`;
    if (location.pathname !== nextPath) navigate(nextPath, { replace: false });
  };

  const handleSectionChange = (nextArea, path) => {
    const nextPath = `/${customer}/${namespace}/${app}/${nextArea}`;
    if (location.pathname !== nextPath) navigate(nextPath, { replace: false, state: { sectionPath: path } });
  };

  return (
    <div className="app">
      <TopBar
        customer={customer}
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
          customer={customer}
          namespace={namespace}
          app={app}
        />
        <Outlet context={{ customer, namespace, app, area, showChat }} />
      </div>
    </div>
  );
}


