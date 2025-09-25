import { useState, useEffect } from 'react';
import { 
  FileText, 
  GitBranch, 
  Users, 
  Zap, 
  BookOpen, 
  TestTube, 
  Building, 
  Plus,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { ApiService } from '../services/api';

export function DocumentationNavigation({ selectedEntity, onEntitySelect }) {
  const [documentation, setDocumentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    app: false,
    flows: false,
    roles: false,
    activities: false,
    stories: false,
    vendors: false,
    testCases: false
  });

  useEffect(() => {
    loadDocumentation();
  }, []);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getDocumentation();
      setDocumentation(data);
    } catch (error) {
      console.error('Failed to load documentation:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleEntitySelect = (type, slug = null) => {
    onEntitySelect({ type, slug });
  };

  const renderEntityList = (entities, type, icon) => {
    const entityArray = Object.entries(entities || {});
    
    return (
      <div className="entity-list">
        {entityArray.map(([slug, entity]) => (
          <div
            key={slug}
            className={`entity-item ${selectedEntity?.type === type && selectedEntity?.slug === slug ? 'active' : ''}`}
            onClick={() => handleEntitySelect(type, slug)}
          >
            {icon}
            <span className="entity-name">{entity.title || entity.name}</span>
          </div>
        ))}
        <div
          className="entity-item add-new"
          onClick={() => handleEntitySelect(type, 'new')}
        >
          <Plus size={14} />
          <span>Add New {type.charAt(0).toUpperCase() + type.slice(1)}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="documentation-nav loading">
        <div className="loading-text">Loading documentation...</div>
      </div>
    );
  }

  return (
    <div className="documentation-nav">
      <div className="nav-header">
        <h3>Documentation Structure</h3>
      </div>

      <div className="nav-sections">
        {/* App Overview */}
        <div
          className={`entity-item nav-section-item ${selectedEntity?.type === 'app' ? 'active' : ''}`}
          onClick={() => handleEntitySelect('app')}
        >
          <FileText size={14} />
          <span>App Overview</span>
        </div>

        {/* Flows */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('flows')}
          >
            {expandedSections.flows ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <GitBranch size={14} />
            <span>Flows ({Object.keys(documentation?.flows || {}).length})</span>
          </div>
          {expandedSections.flows && (
            <div className="section-content">
              {renderEntityList(documentation?.flows, 'flow', <GitBranch size={14} />)}
            </div>
          )}
        </div>

        {/* Roles */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('roles')}
          >
            {expandedSections.roles ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Users size={14} />
            <span>Roles ({Object.keys(documentation?.roles || {}).length})</span>
          </div>
          {expandedSections.roles && (
            <div className="section-content">
              {renderEntityList(documentation?.roles, 'role', <Users size={14} />)}
            </div>
          )}
        </div>

        {/* Activities */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('activities')}
          >
            {expandedSections.activities ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Zap size={14} />
            <span>Activities ({Object.keys(documentation?.activities || {}).length})</span>
          </div>
          {expandedSections.activities && (
            <div className="section-content">
              {renderEntityList(documentation?.activities, 'activity', <Zap size={14} />)}
            </div>
          )}
        </div>

        {/* Stories */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('stories')}
          >
            {expandedSections.stories ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <BookOpen size={14} />
            <span>Stories ({Object.keys(documentation?.stories || {}).length})</span>
          </div>
          {expandedSections.stories && (
            <div className="section-content">
              {renderEntityList(documentation?.stories, 'story', <BookOpen size={14} />)}
            </div>
          )}
        </div>

        {/* Vendors */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('vendors')}
          >
            {expandedSections.vendors ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Building size={14} />
            <span>Vendors ({Object.keys(documentation?.vendors || {}).length})</span>
          </div>
          {expandedSections.vendors && (
            <div className="section-content">
              {renderEntityList(documentation?.vendors, 'vendor', <Building size={14} />)}
            </div>
          )}
        </div>

        {/* Test Cases */}
        <div className="nav-section">
          <div
            className="section-header"
            onClick={() => toggleSection('testCases')}
          >
            {expandedSections.testCases ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <TestTube size={14} />
            <span>Test Cases ({Object.keys(documentation?.test_cases || {}).length})</span>
          </div>
          {expandedSections.testCases && (
            <div className="section-content">
              {renderEntityList(documentation?.test_cases, 'testCase', <TestTube size={14} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
