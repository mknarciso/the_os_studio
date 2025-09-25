import { useState, useEffect } from 'react';
import { Edit, Code } from 'lucide-react';
import { DocumentationNavigation } from './DocumentationNavigation';
import { DocumentationEditor } from './DocumentationEditor';
import { DocumentationExplorer } from './DocumentationExplorer';
import { DocumentationReader } from './DocumentationReader';
import { MonacoEditor } from './MonacoEditor';
import { ApiService } from '../services/api';

export function DocumentationView({ customer, namespace, app, activeTab, onTabChange }) {
  const [selectedEntity, setSelectedEntity] = useState({ type: 'app', slug: 'app' });
  const [documentation, setDocumentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocumentation();
  }, [customer, namespace, app]);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await ApiService.getDocumentation(customer, namespace, app);
      setDocumentation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity);
  };

  const handleSave = async (savedEntity) => {
    await loadDocumentation();
    // Update selected entity if slug changed
    if (savedEntity.slug !== selectedEntity?.slug) {
      setSelectedEntity({ ...selectedEntity, slug: savedEntity.slug });
    }
  };

  const handleDelete = async () => {
    await loadDocumentation();
    setSelectedEntity(null);
  };

  const renderContent = () => {
    if (activeTab === 'explorar') {
      return <DocumentationExplorer customer={customer} namespace={namespace} app={app} />;
    }

    if (activeTab === 'read') {
      return (
        <DocumentationReader documentation={documentation} />
      );
    }

    if (activeTab === 'edit') {
      return (
        <DocumentationEditor
          customer={customer}
          namespace={namespace}
          app={app}
          selectedEntity={selectedEntity}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      );
    }

    if (activeTab === 'code') {
      return (
        <MonacoEditor
          customer={customer}
          namespace={namespace}
          app={app}
          selectedFile="documentation.json"
          showHeader={false}
          language="json"
        />
      );
    }

    return null;
  };

  return (
    <div className="documentation-view">
      {loading ? (
        <div className="loading-container">
          <div className="loading-text">Loading documentation...</div>
        </div>
      ) : (
        <div className={`documentation-layout ${activeTab === 'explorar' ? 'explorer-mode' : ''}`}>
          {activeTab === 'edit' && (
            <DocumentationNavigation
              selectedEntity={selectedEntity}
              onEntitySelect={handleEntitySelect}
            />
          )}
          
          <div className="documentation-main">
            {error && (
              <div className="error-message">
                Error loading documentation: {error}
              </div>
            )}
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}
