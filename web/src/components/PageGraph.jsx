import React from 'react';
import PagesGraph from './PagesGraph';

// Demo component that shows how to use PagesGraph
// In the actual app, PagesGraph is used directly in MainContent.jsx
const PageGraph = ({ customer = 'quero', namespace = 'quero', app = 'flow' }) => {
  return (
    <div className="w-full h-screen">
      <PagesGraph 
        customer={customer} 
        namespace={namespace} 
        app={app} 
      />
    </div>
  );
};

export default PageGraph;
