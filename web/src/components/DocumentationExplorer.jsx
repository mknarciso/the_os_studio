import { useState, useEffect } from 'react';
import { 
  FileText, 
  GitBranch, 
  Users, 
  Zap, 
  BookOpen, 
  TestTube, 
  Building, 
  ChevronRight,
  ChevronDown,
  User,
  Settings,
  BarChart3,
  Clock,
  Target,
  CheckCircle,
  Map,
  Eye,
  ArrowRight
} from 'lucide-react';
import { ApiService } from '../services/api';

export function DocumentationExplorer({ namespace = 'quero', app = 'flow' }) {
  const [documentation, setDocumentation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    flows: false,
    roles: false,
    activities: false,
    stories: false,
    tests: false
  });

  useEffect(() => {
    loadDocumentation();
  }, [namespace, app]);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiService.getDocumentation(namespace, app);
      setDocumentation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityClick = (type, slug, entity) => {
    setSelectedEntity({ type, slug, entity });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };



  const renderExpandableSection = (type, title, icon, entities, entityType) => {
    const entityEntries = Object.entries(entities || {});
    const isExpanded = expandedSections[type];

    return (
      <div className="expandable-section">
        <div 
          className="expandable-header"
          onClick={() => toggleSection(type)}
        >
          <div className="expandable-title">
            <div className="expandable-icon">
              {icon}
            </div>
            <h3>{title}</h3>
            <span className="count">({entityEntries.length})</span>
          </div>
          <div className="expand-indicator">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="expandable-content">
            {entityEntries.length === 0 ? (
              <div className="empty-section">Nenhum {title.toLowerCase()} configurado</div>
            ) : (
              <div className="entity-buttons">
                {entityEntries.map(([slug, entity]) => (
                  <button
                    key={slug}
                    className="entity-button"
                    onClick={() => handleEntityClick(entityType, slug, entity)}
                  >
                    {entity.title || entity.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActivitiesByFlows = () => {
    const activities = documentation?.activities || {};
    const flows = documentation?.flows || {};
    const isExpanded = expandedSections['activities'];

    // Group activities by flow
    const activitiesByFlow = Object.entries(activities).reduce((acc, [slug, activity]) => {
      const flowSlug = activity.flow || 'unassigned';
      if (!acc[flowSlug]) {
        acc[flowSlug] = [];
      }
      acc[flowSlug].push([slug, activity]);
      return acc;
    }, {});

    const totalActivities = Object.keys(activities).length;

    return (
      <div className="expandable-section">
        <div 
          className="expandable-header"
          onClick={() => toggleSection('activities')}
        >
          <div className="expandable-title">
            <div className="expandable-icon">
              <Zap size={20} />
            </div>
            <h3>Atividades</h3>
            <span className="count">({totalActivities})</span>
          </div>
          <div className="expand-indicator">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="expandable-content">
            {totalActivities === 0 ? (
              <div className="empty-section">Nenhuma atividade configurada</div>
            ) : (
              <div className="activities-by-flow">
                {Object.entries(activitiesByFlow).map(([flowSlug, flowActivities]) => {
                  const flow = flows[flowSlug];
                  const flowTitle = flow?.title || (flowSlug === 'unassigned' ? 'Sem Fluxo Atribuído' : flowSlug);
                  
                  return (
                    <div key={flowSlug} className="flow-group">
                      <div className="flow-group-header">
                        <div className="flow-group-title">
                          <GitBranch size={16} />
                          <h4>{flowTitle}</h4>
                          <span className="flow-count">({flowActivities.length})</span>
                        </div>
                        {flow && (
                          <button
                            className="flow-link-button"
                            onClick={() => handleEntityClick('flow', flowSlug, flow)}
                          >
                            Ver Fluxo
                          </button>
                        )}
                      </div>
                      <div className="flow-activities">
                        {flowActivities.map(([activitySlug, activity]) => (
                          <button
                            key={activitySlug}
                            className="entity-button activity-button"
                            onClick={() => handleEntityClick('activity', activitySlug, activity)}
                          >
                            <div className="activity-button-content">
                              <span className="activity-title">{activity.title}</span>
                              <span className="activity-type">{activity.type}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTestsSection = () => {
    const testCases = documentation?.test_cases || {};
    const testEntries = Object.entries(testCases);
    const isExpanded = expandedSections['tests'];

    return (
      <div className="expandable-section">
        <div 
          className="expandable-header"
          onClick={() => toggleSection('tests')}
        >
          <div className="expandable-title">
            <div className="expandable-icon">
              <TestTube size={20} />
            </div>
            <h3>Casos de Teste</h3>
            <span className="count">({testEntries.length})</span>
          </div>
          <div className="expand-indicator">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="expandable-content">
            {testEntries.length === 0 ? (
              <div className="empty-section">Nenhum caso de teste configurado</div>
            ) : (
              <div className="tests-grid">
                {testEntries.map(([slug, testCase]) => (
                  <div 
                    key={slug} 
                    className="test-card-compact clickable"
                    onClick={() => handleEntityClick('testCase', slug, testCase)}
                  >
                    <div className="test-header-compact">
                      <div className="test-icon-compact">
                        <TestTube size={16} />
                      </div>
                      <h4>{testCase.title}</h4>
                    </div>
                    
                    <div className="test-meta-compact">
                      <div className="test-story-compact">
                        Story: {documentation?.stories?.[testCase.story]?.title || testCase.story}
                      </div>
                      <div className="test-role-compact">
                        Role: {documentation?.roles?.[testCase.role]?.name || testCase.role}
                      </div>
                      {testCase.interface && (
                        <div className="test-interface-compact">
                          Interface: {testCase.interface.type}
                        </div>
                      )}
                    </div>

                    {testCase.steps && (
                      <div className="test-steps-compact">
                        <strong>{testCase.steps.length} passos</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMainContent = () => {
    const app = documentation?.app;
    if (!app) return <div className="empty-state">Nenhum app configurado</div>;

    return (
      <div className="explorer-content">
        <div className="app-overview">
          <div className="section-header">
            <div className="section-icon">
              <CheckCircle size={24} />
            </div>
            <div className="section-info">
              <h2>{app.title || 'App Overview'}</h2>
              <p>{app.context || 'Sem descrição disponível'}</p>
            </div>
          </div>
          
          {app.problems && app.problems.length > 0 && (
            <div className="pain-points">
              <h3>Pontos de Dor & Soluções</h3>
              {app.problems.filter(p => p && p.trim()).map((problem, index) => (
                <div key={index} className="pain-point">
                  <div className="pain-point-indicator"></div>
                  <p>{problem}</p>
                </div>
              ))}
            </div>
          )}

          {app.features_preview && app.features_preview.length > 0 && (
            <div className="features-preview">
              <h3>Funcionalidades</h3>
              {app.features_preview.filter(f => f && f.trim()).map((feature, index) => (
                <div key={index} className="feature-item">
                  <CheckCircle size={16} />
                  <p>{feature}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="expandable-sections">
          {(() => {
            // Combinar flows da raiz com flows do app
            let allFlows = { ...documentation?.flows };
            
            // Adicionar flows do app.flows se existirem
            if (documentation?.app?.flows) {
              documentation.app.flows.forEach(flow => {
                allFlows[flow.slug] = flow;
              });
            }
            
            return renderExpandableSection(
              'flows', 
              'Fluxos', 
              <GitBranch size={20} />, 
              allFlows, 
              'flow'
            );
          })()}
          
          {renderExpandableSection(
            'roles', 
            'Roles', 
            <Users size={20} />, 
            documentation?.roles, 
            'role'
          )}
          
          {renderActivitiesByFlows()}
          
          {renderExpandableSection(
            'stories', 
            'Stories', 
            <BookOpen size={20} />, 
            documentation?.stories, 
            'story'
          )}

          {renderTestsSection()}
        </div>
      </div>
    );
  };





  const renderEntityDetail = () => {
    if (!selectedEntity) return null;

    const { type, slug, entity } = selectedEntity;

    return (
      <div className="entity-detail">
        <div className="entity-detail-header">
          <button 
            className="back-button"
            onClick={() => setSelectedEntity(null)}
          >
            ← Voltar
          </button>
          <h3>{entity.title || entity.name}</h3>
          <span className="entity-type">{type}</span>
        </div>

        <div className="entity-detail-content">
          {entity.description && (
            <div className="entity-section">
              <h4>Descrição</h4>
              <p>{entity.description}</p>
            </div>
          )}

          {entity.context && (
            <div className="entity-section">
              <h4>Contexto</h4>
              <p>{entity.context}</p>
            </div>
          )}

          {type === 'flow' && (
            <>
              {(() => {
                // Buscar flow_states tanto do próprio entity quanto do app.flows
                let flowStates = [];
                
                // 1. Tentar pegar do próprio entity (estrutura da raiz)
                if (Array.isArray(entity.flow_states)) {
                  flowStates = entity.flow_states;
                }
                
                // 2. Se não encontrou, buscar no app.flows (estrutura completa)
                if (flowStates.length === 0 && documentation?.app?.flows) {
                  const appFlow = documentation.app.flows.find(f => f.slug === slug);
                  if (appFlow && Array.isArray(appFlow.flow_states)) {
                    flowStates = appFlow.flow_states;
                  }
                }
                
                // 3. Se ainda não encontrou, buscar states globais relacionados ao flow
                if (flowStates.length === 0 && documentation?.flow_states) {
                  // Aqui você pode implementar lógica para associar states ao flow
                  // Por enquanto, vamos mostrar todos os states disponíveis
                  flowStates = Object.values(documentation.flow_states);
                }
                
                return flowStates.length > 0 && (
                  <div className="entity-section">
                    <h4>Fluxo de Estados</h4>
                    <div className="flow-states-flowchart">
                      {[...flowStates]
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((state, index) => (
                          <div key={state.slug}>
                            <div className={`flow-state-card ${state.is_initial ? 'initial' : ''} ${state.is_final ? 'final' : ''}`}>
                              <div className="flow-state-header">
                                <h5 className="flow-state-title">{state.name}</h5>
                                <div className="flow-state-badges">
                                  {state.is_initial && (
                                    <span className="flow-state-badge initial">Inicial</span>
                                  )}
                                  {state.is_final && (
                                    <span className="flow-state-badge final">Final</span>
                                  )}
                                </div>
                              </div>
                              
                              {state.description && (
                                <div className="flow-state-description">{state.description}</div>
                              )}
                              
                              {Array.isArray(state.required_roles) && state.required_roles.length > 0 && (
                                <div className="flow-state-roles">
                                  {state.required_roles.map(roleSlug => (
                                    <span
                                      key={roleSlug}
                                      className="role-label"
                                      onClick={() => {
                                        const role = documentation?.roles?.[roleSlug];
                                        if (role) handleEntityClick('role', roleSlug, role);
                                      }}
                                    >
                                      {documentation?.roles?.[roleSlug]?.name || roleSlug}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {Array.isArray(state.allowed_transitions) && state.allowed_transitions.length > 0 && (
                                <div className="flow-transitions">
                                  <div className="flow-transitions-label">Pode transicionar para:</div>
                                  <div className="transition-labels">
                                    {state.allowed_transitions.map(transitionSlug => {
                                      const targetState = flowStates.find(s => s.slug === transitionSlug);
                                      return (
                                        <span key={transitionSlug} className="transition-label">
                                          {targetState?.name || transitionSlug}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {index < flowStates.length - 1 && (
                              <div className="flow-state-arrow">
                                <ArrowRight size={20} />
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })()}

              <div className="entity-section">
                <h4>Atividades deste Fluxo</h4>
                <div className="entity-links">
                  {Object.entries(documentation?.activities || {})
                    .filter(([, activity]) => activity.flow === slug)
                    .map(([activitySlug, activity]) => (
                      <button
                        key={activitySlug}
                        className="entity-link"
                        onClick={() => handleEntityClick('activity', activitySlug, activity)}
                      >
                        {activity.title}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  {Object.values(documentation?.activities || {}).filter(a => a.flow === slug).length === 0 && (
                    <p>Nenhuma atividade vinculada a este fluxo.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {type === 'role' && (
            <>
              <div className="entity-section">
                <h4>Tipo</h4>
                <p>{entity.type === 'human' ? 'Humano' : 'Sistema'}</p>
              </div>
              
              {entity.vendor && (
                <div className="entity-section">
                  <h4>Vendor</h4>
                  <button 
                    className="entity-link"
                    onClick={() => {
                      const vendor = documentation?.vendors?.[entity.vendor];
                      if (vendor) handleEntityClick('vendor', entity.vendor, vendor);
                    }}
                  >
                    {documentation?.vendors?.[entity.vendor]?.name || entity.vendor}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              <div className="entity-section">
                <h4>Atividades</h4>
                <div className="entity-links">
                  {Object.entries(documentation?.activities || {})
                    .filter(([, activity]) => activity.roles?.includes(slug))
                    .map(([activitySlug, activity]) => (
                      <button
                        key={activitySlug}
                        className="entity-link"
                        onClick={() => handleEntityClick('activity', activitySlug, activity)}
                      >
                        {activity.title}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {type === 'activity' && (
            <>
              <div className="entity-section">
                <h4>Tipo</h4>
                <p>{entity.type === 'manual' ? 'Manual' : entity.type === 'automated' ? 'Automatizada' : 'Híbrida'}</p>
              </div>

              {entity.flow && (
                <div className="entity-section">
                  <h4>Fluxo</h4>
                  <button 
                    className="entity-link"
                    onClick={() => {
                      const flow = documentation?.flows?.[entity.flow];
                      if (flow) handleEntityClick('flow', entity.flow, flow);
                    }}
                  >
                    {documentation?.flows?.[entity.flow]?.title || entity.flow}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {entity.roles && entity.roles.length > 0 && (
                <div className="entity-section">
                  <h4>Roles</h4>
                  <div className="entity-links">
                    {entity.roles.map(roleSlug => (
                      <button
                        key={roleSlug}
                        className="entity-link"
                        onClick={() => {
                          const role = documentation?.roles?.[roleSlug];
                          if (role) handleEntityClick('role', roleSlug, role);
                        }}
                      >
                        {documentation?.roles?.[roleSlug]?.name || roleSlug}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="entity-section">
                <h4>Stories</h4>
                <div className="entity-links">
                  {Object.entries(documentation?.stories || {})
                    .filter(([, story]) => story.activity === slug)
                    .map(([storySlug, story]) => (
                      <button
                        key={storySlug}
                        className="entity-link"
                        onClick={() => handleEntityClick('story', storySlug, story)}
                      >
                        {story.title}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {type === 'story' && (
            <>
              <div className="entity-section">
                <h4>Atividade</h4>
                <button 
                  className="entity-link"
                  onClick={() => {
                    const activity = documentation?.activities?.[entity.activity];
                    if (activity) handleEntityClick('activity', entity.activity, activity);
                  }}
                >
                  {documentation?.activities?.[entity.activity]?.title || entity.activity}
                  <ArrowRight size={14} />
                </button>
              </div>

              {entity.roles && entity.roles.length > 0 && (
                <div className="entity-section">
                  <h4>Roles</h4>
                  <div className="entity-links">
                    {entity.roles.map(roleSlug => (
                      <button
                        key={roleSlug}
                        className="entity-link"
                        onClick={() => {
                          const role = documentation?.roles?.[roleSlug];
                          if (role) handleEntityClick('role', roleSlug, role);
                        }}
                      >
                        {documentation?.roles?.[roleSlug]?.name || roleSlug}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="entity-section">
                <h4>Casos de Teste</h4>
                <div className="entity-links">
                  {Object.entries(documentation?.test_cases || {})
                    .filter(([, testCase]) => testCase.story === slug)
                    .map(([testSlug, testCase]) => (
                      <button
                        key={testSlug}
                        className="entity-link"
                        onClick={() => handleEntityClick('testCase', testSlug, testCase)}
                      >
                        {testCase.title}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {type === 'testCase' && (
            <>
              <div className="entity-section">
                <h4>Story</h4>
                <button 
                  className="entity-link"
                  onClick={() => {
                    const story = documentation?.stories?.[entity.story];
                    if (story) handleEntityClick('story', entity.story, story);
                  }}
                >
                  {documentation?.stories?.[entity.story]?.title || entity.story}
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="entity-section">
                <h4>Role</h4>
                <button 
                  className="entity-link"
                  onClick={() => {
                    const role = documentation?.roles?.[entity.role];
                    if (role) handleEntityClick('role', entity.role, role);
                  }}
                >
                  {documentation?.roles?.[entity.role]?.name || entity.role}
                  <ArrowRight size={14} />
                </button>
              </div>

              {entity.interface && (
                <div className="entity-section">
                  <h4>Interface</h4>
                  <p>{entity.interface.type}: {entity.interface.target}</p>
                </div>
              )}

              {entity.steps && entity.steps.length > 0 && (
                <div className="entity-section">
                  <h4>Passos</h4>
                  <ol>
                    {entity.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };



  if (loading) {
    return (
      <div className="documentation-explorer loading">
        <div className="loading-text">Carregando documentação...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="documentation-explorer error">
        <div className="error-message">
          Erro ao carregar documentação: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="documentation-explorer-simple">
      <div className="explorer-main">
        {selectedEntity ? renderEntityDetail() : renderMainContent()}
      </div>
    </div>
  );
}
