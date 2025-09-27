import { useState } from 'react';
import { FileText, Database, Shield, Layout, Zap, Globe, Bot, Paintbrush, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

export function NavigationSidebar({ activeSection, onSectionChange, namespace, app }) {
  const [collapsed, setCollapsed] = useState(false);
  const menuItems = [
    {
      id: 'branding',
      label: 'Branding',
      description: 'Brand guideline & theme',
      icon: Paintbrush,
      path: 'branding'
    },
    {
      id: 'documentation',
      label: 'Documentation',
      description: 'App specs and test coverage',
      icon: FileText,
      path: 'docs.md'
    },
    {
      id: 'data',
      label: 'Data',
      description: 'Entity schemas & data',
      icon: Database,
      path: 'data'
    },
    {
      id: 'scopes',
      label: 'Scopes',
      description: 'Data views & permissions',
      icon: Shield,
      path: 'controllers'
    },
    {
      id: 'pages',
      label: 'Pages',
      description: 'Frontend UI components',
      icon: Layout,
      path: 'pages'
    },
    {
      id: 'automations',
      label: 'Automations',
      description: 'Backend triggers & workflows',
      icon: Zap,
      path: 'automations'
    },
    {
      id: 'public-pages',
      label: 'Public Pages',
      description: 'Public frontend pages',
      icon: Globe,
      disabled: true
    },
    {
      id: 'agents',
      label: 'Agents',
      description: 'Multi-channel AI bots',
      icon: Bot,
      disabled: true
    }
  ];

  return (
    <div className={`nav-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="nav-menu">
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={`nav-item h-12 justify-start flex items-center ${activeSection === item.id ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => !item.disabled && onSectionChange(item.id, item.path)}
              disabled={item.disabled}
              type="button"
            >
              <Icon className="icon" size={16} />
              {!collapsed && (
                <div className="flex flex-col items-start text-left">
                  <div className="label">{item.label}</div>
                  <div className="description">{item.description}</div>
                </div>
              )}
            </Button>
          );
        })}
      </div>
      <div className="nav-footer">
        <Button
          variant="outline"
          size="icon"
          className="collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menu' : 'Diminuir menu'}
          type="button"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </div>
    </div>
  );
}
