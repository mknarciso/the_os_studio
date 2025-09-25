import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { 
  AppDocumentationSchema,
  FlowSchema,
  RoleSchema,
  ActivitySchema,
  StorySchema,
  VendorSchema,
  TestCaseSchema
} from '@zazos/schemas';

const entitySchemas = {
  app: AppDocumentationSchema,
  flow: FlowSchema,
  role: RoleSchema,
  activity: ActivitySchema,
  story: StorySchema,
  vendor: VendorSchema,
  testCase: TestCaseSchema,
};

export function DocumentationEditor({ namespace = 'quero', app = 'flow', selectedEntity, onSave, onDelete }) {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [availableOptions, setAvailableOptions] = useState({
    flows: {},
    roles: {},
    activities: {},
    stories: {},
    vendors: {}
  });

  useEffect(() => {
    // Clear errors when the entity changes
    setError(null);
    setValidationErrors({});

    if (selectedEntity) {
      loadEntityData();
      loadAvailableOptions();
    }
  }, [selectedEntity]);

  const loadAvailableOptions = async () => {
    try {
      const [flows, roles, activities, stories, vendors] = await Promise.all([
        ApiService.getEntities(namespace, app, 'flows'),
        ApiService.getEntities(namespace, app, 'roles'),
        ApiService.getEntities(namespace, app, 'activities'),
        ApiService.getEntities(namespace, app, 'stories'),
        ApiService.getEntities(namespace, app, 'vendors')
      ]);
      
      setAvailableOptions({ flows, roles, activities, stories, vendors });
    } catch (error) {
      console.error('Failed to load options:', error);
    }
  };

  const loadEntityData = async () => {
    if (!selectedEntity || selectedEntity.slug === 'new') {
      setFormData(getDefaultFormData(selectedEntity?.type));
      return;
    }

    try {
      setLoading(true);
      const data = await ApiService.getDocumentation(namespace, app);
      
      let entityData = {};
      switch (selectedEntity.type) {
        case 'app':
          entityData = data.app || getDefaultFormData('app');
          break;
        case 'flow':
          entityData = data.flows[selectedEntity.slug] || getDefaultFormData('flow');
          break;
        case 'role':
          entityData = data.roles[selectedEntity.slug] || getDefaultFormData('role');
          break;
        case 'activity':
          entityData = data.activities[selectedEntity.slug] || getDefaultFormData('activity');
          break;
        case 'story':
          entityData = data.stories[selectedEntity.slug] || getDefaultFormData('story');
          break;
        case 'vendor':
          entityData = data.vendors[selectedEntity.slug] || getDefaultFormData('vendor');
          break;
        case 'testCase':
          entityData = data.test_cases[selectedEntity.slug] || getDefaultFormData('testCase');
          break;
        default:
          entityData = getDefaultFormData(selectedEntity.type);
      }
      
      setFormData(entityData);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultFormData = (type) => {
    const defaults = {
      app: {
        slug: '',
        title: '',
        context: '',
        problems: [''],
        features_preview: ['']
      },
      flow: {
        slug: '',
        title: '',
        description: '',
        flow_states: []
      },
      role: {
        slug: '',
        name: '',
        description: '',
        type: 'human',
        vendor: ''
      },
      activity: {
        slug: '',
        title: '',
        description: '',
        flow: '',
        type: 'manual',
        roles: [],
        trigger: ''
      },
      story: {
        slug: '',
        title: '',
        description: '',
        activity: '',
        roles: []
      },
      vendor: {
        slug: '',
        name: '',
        description: ''
      },
      testCase: {
        slug: '',
        title: '',
        story: '',
        role: '',
        interface: {
          type: 'page',
          target: ''
        },
        steps: [''],
        input: {},
        output: {
          status: 'success',
          description: ''
        }
      }
    };
    
    return defaults[type] || {};
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayAdd = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), '']
    }));
  };

  const handleArrayRemove = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const handleArrayChange = (field, index, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const handleSave = async () => {
    const schema = entitySchemas[selectedEntity.type];
    if (schema) {
      const result = schema.safeParse(formData);
      if (!result.success) {
        setValidationErrors(result.error.flatten().fieldErrors);
        return;
      }
    }
    
    setValidationErrors({});
    try {
      setSaving(true);
      setError(null);
      
      let result;
      const isNew = selectedEntity.slug === 'new';
      
      switch (selectedEntity.type) {
        case 'app':
          result = await ApiService.updateApp(namespace, app, formData);
          break;
        case 'flow':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'flows', formData)
            : await ApiService.updateEntity(namespace, app, 'flows', selectedEntity.slug, formData);
          break;
        case 'role':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'roles', formData)
            : await ApiService.updateEntity(namespace, app, 'roles', selectedEntity.slug, formData);
          break;
        case 'activity':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'activities', formData)
            : await ApiService.updateEntity(namespace, app, 'activities', selectedEntity.slug, formData);
          break;
        case 'story':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'stories', formData)
            : await ApiService.updateEntity(namespace, app, 'stories', selectedEntity.slug, formData);
          break;
        case 'vendor':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'vendors', formData)
            : await ApiService.updateEntity(namespace, app, 'vendors', selectedEntity.slug, formData);
          break;
        case 'testCase':
          result = isNew 
            ? await ApiService.createEntity(namespace, app, 'test-cases', formData)
            : await ApiService.updateEntity(namespace, app, 'test-cases', selectedEntity.slug, formData);
          break;
      }
      
      onSave(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    try {
      setSaving(true);
      setError(null);
      
      switch (selectedEntity.type) {
        case 'flow':
          await ApiService.deleteEntity(namespace, app, 'flows', selectedEntity.slug);
          break;
        case 'role':
          await ApiService.deleteEntity(namespace, app, 'roles', selectedEntity.slug);
          break;
        case 'activity':
          await ApiService.deleteEntity(namespace, app, 'activities', selectedEntity.slug);
          break;
        case 'story':
          await ApiService.deleteEntity(namespace, app, 'stories', selectedEntity.slug);
          break;
        case 'vendor':
          await ApiService.deleteEntity(namespace, app, 'vendors', selectedEntity.slug);
          break;
        case 'testCase':
          await ApiService.deleteEntity(namespace, app, 'test-cases', selectedEntity.slug);
          break;
      }
      
      onDelete();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field, label, type = "text", placeholder = '') => {
    const Component = type === 'textarea' ? 'textarea' : 'input';
    return (
      <div className="form-group">
        <label>{label}</label>
        <Component
          type={type}
          value={formData[field] || ''}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          className={validationErrors[field] ? 'input-error' : ''}
        />
        {validationErrors[field] && (
          <p className="error-message">{validationErrors[field].join(', ')}</p>
        )}
      </div>
    );
  };
  
  const renderArrayField = (field, label, placeholder = '') => (
    <div className="form-group">
      <label>{label}</label>
      {(formData[field] || []).map((item, index) => (
        <div key={index} className="array-item">
          <input
            type="text"
            value={item}
            onChange={(e) => handleArrayChange(field, index, e.target.value)}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => handleArrayRemove(field, index)}
            className="remove-btn"
          >
            <X size={14} />
          </button>
        </div>
      ))}
       {validationErrors[field] && !Array.isArray(validationErrors[field]) && (
        <p className="error-message">{validationErrors[field].join(', ')}</p>
      )}
      <button
        type="button"
        onClick={() => handleArrayAdd(field)}
        className="add-btn"
      >
        <Plus size={14} />
        Add {label.slice(0, -1)}
      </button>
    </div>
  );

  const renderSelectField = (field, label, options, multiple = false) => {
    const handleChange = (e) => {
      const value = multiple
        ? Array.from(e.target.selectedOptions, option => option.value)
        : e.target.value;
      handleInputChange(field, value);
    };

    return (
      <div className="form-group">
        <label>{label}</label>
        <select
          multiple={multiple}
          value={formData[field] || (multiple ? [] : '')}
          onChange={handleChange}
          className={validationErrors[field] ? 'input-error' : ''}
        >
          {!multiple && <option value="">Select {label}</option>}
          {Object.entries(options).map(([slug, entity]) => (
            <option key={slug} value={slug}>
              {entity.title || entity.name}
            </option>
          ))}
        </select>
        {validationErrors[field] && (
          <p className="error-message">{validationErrors[field].join(', ')}</p>
        )}
      </div>
    );
  };

  const renderFormFields = () => {
    if (!selectedEntity?.type) return <div>Select an entity to edit</div>;

    switch (selectedEntity?.type) {
      case 'app':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'app_slug')}
            {renderField('title', 'Title', 'text', 'App Title')}
            {renderField('context', 'Context', 'textarea', 'App context and description')}
            {renderArrayField('problems', 'Problems', 'Problem description')}
            {renderArrayField('features_preview', 'Features Preview', 'Feature description')}
          </>
        );

      case 'flow':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'flow_slug')}
            {renderField('title', 'Title', 'text', 'Flow Title')}
            {renderField('description', 'Description', 'textarea', 'Flow description')}
          </>
        );

      case 'role':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'role_slug')}
            {renderField('name', 'Name', 'text', 'Role Name')}
            {renderField('description', 'Description', 'textarea', 'Role description')}
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.type || 'human'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className={validationErrors['type'] ? 'input-error' : ''}
              >
                <option value="human">Human</option>
                <option value="system">System</option>
              </select>
               {validationErrors['type'] && (
                <p className="error-message">{validationErrors['type'].join(', ')}</p>
              )}
            </div>
            {formData.type === 'system' && renderSelectField('vendor', 'Vendor', availableOptions.vendors)}
          </>
        );

      case 'activity':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'activity_slug')}
            {renderField('title', 'Title', 'text', 'Activity Title')}
            {renderField('description', 'Description', 'textarea', 'Activity description')}
            {renderSelectField('flow', 'Flow', availableOptions.flows)}
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.type || 'manual'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className={validationErrors['type'] ? 'input-error' : ''}
              >
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
                <option value="hybrid">Hybrid</option>
              </select>
              {validationErrors['type'] && (
                <p className="error-message">{validationErrors['type'].join(', ')}</p>
              )}
            </div>
            {renderSelectField('roles', 'Roles', availableOptions.roles, true)}
            {(formData.type === 'automated' || formData.type === 'hybrid') && (
              renderField('trigger', 'Trigger', 'text', 'Trigger description')
            )}
          </>
        );
      
      case 'story':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'story_slug')}
            {renderField('title', 'Title', 'text', 'Story Title')}
            {renderField('description', 'Description', 'textarea', 'Story description')}
            {renderSelectField('activity', 'Activity', availableOptions.activities)}
            {renderSelectField('roles', 'Roles', availableOptions.roles, true)}
          </>
        );

      case 'vendor':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'vendor_slug')}
            {renderField('name', 'Name', 'text', 'Vendor Name')}
            {renderField('description', 'Description', 'textarea', 'Vendor description')}
          </>
        );

      case 'testCase':
        return (
          <>
            {renderField('slug', 'Slug', 'text', 'test_case_slug')}
            {renderField('title', 'Title', 'text', 'Test Case Title')}
            {renderSelectField('story', 'Story', availableOptions.stories)}
            {renderSelectField('role', 'Role', availableOptions.roles)}
            <div className="form-group">
              <label>Interface Type</label>
              <select
                value={formData.interface?.type || 'page'}
                onChange={(e) => handleInputChange('interface', { ...formData.interface, type: e.target.value })}
                className={validationErrors['interface'] ? 'input-error' : ''}
              >
                <option value="page">Page</option>
                <option value="agent">Agent</option>
                <option value="api">API</option>
                <option value="database">Database</option>
                <option value="email">Email</option>
                <option value="slack">Slack</option>
              </select>
              {validationErrors['interface'] && (
                <p className="error-message">Invalid interface type</p>
              )}
            </div>
             <div className="form-group">
              <label>Interface Target</label>
              <input
                type="text"
                value={formData.interface?.target || ''}
                onChange={(e) => handleInputChange('interface', { ...formData.interface, target: e.target.value })}
                placeholder="e.g., PaginaSolicitacao, POST /api/solicitacoes"
                className={validationErrors['interface'] ? 'input-error' : ''}
              />
              {validationErrors['interface'] && (
                <p className="error-message">Invalid interface target</p>
              )}
            </div>
            {renderArrayField('steps', 'Steps', 'Test step description')}
          </>
        );

      default:
        return <div>Select an entity to edit</div>;
    }
  };

  if (!selectedEntity) {
    return (
      <div className="documentation-editor empty">
        <div className="empty-state">
          <p>Select an entity from the navigation to start editing</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="documentation-editor loading">
        <div className="loading-text">Loading entity data...</div>
      </div>
    );
  }

  return (
    <div className="documentation-editor">
      <div className="editor-header">
        <h3>
          {selectedEntity.slug === 'new' ? 'New' : 'Edit'} {selectedEntity.type.charAt(0).toUpperCase() + selectedEntity.type.slice(1)}
        </h3>
        <div className="editor-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-btn"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          {selectedEntity.slug !== 'new' && selectedEntity.type !== 'app' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="delete-btn"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="editor-form-wrapper">
        {error && (
          <div className="api-error-message">
            <strong>Error:</strong> {error}
          </div>
        )}
        <div className="editor-form">
          {renderFormFields()}
        </div>
      </div>
    </div>
  );
}
