import { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { NavigationSidebar } from './components/NavigationSidebar';
import { MainContent } from './components/MainContent';
import { AreaPage } from './pages/AreaPage';
import { RootLayout } from './layouts/RootLayout';

function App() {
  const router = useMemo(() => {
    const RootOutlet = () => <Outlet />;
    return createBrowserRouter([
      {
        path: '/',
        element: <RootOutlet />,
        children: [
          { index: true, element: <Navigate to="/quero/quero/flow/documentation" replace /> },
          {
            path: ':customer/:namespace/:app',
            element: <RootLayout />,
            children: [
              { index: true, element: <Navigate to="documentation" replace /> },
              { path: ':area', element: <AreaPage /> },
            ],
          },
        ],
      },
    ]);
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
