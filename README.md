# Zaz OS Studio

Interface para edição de documentação e código usando Vibe-Coding.

## 🎨 Interface

### Top Bar
- **Seletor de App**: Seleciona namespace/app (ex: quero/flow, core/agents)
- **Botão de Save/Diffs**: Mostra status do app atual, relacionado às modificações feitas no workspace
- **AI Chat Panel Toggle**: Botão para ativar e desativar o painel de conversa com AI

### Sidebar de Navegação (área)
- **📄 Documentation**: Edição e navegação da documentação do App
- **📄 Worlkbench**: (Em desenvolvimento) Área para descrição, discussão e acompanhamento de tasks
- **🗄️ Data**: Explora e edita entidades, schemas e migrações (`/data`)
- **🎯 Scopes**: Navega pelos `/controllers` (APIs e permissões)
- **📱 Pages**: Visualiza `/pages` e `/components` (UI frontend)
- **⚡ Automations**: Responsável por Triggers e functions (`/automations`)
- **🌐 Public Pages**: (Em desenvolvimento) Páginas públicas
- **🤖 Agent**: (Em desenvolvimento) Bots multi-canal

### Main Content
- Varia de acordo com a área selecionada

### AI Chat Panel
- Assistente para ajuda com código

## 🚀 Como usar

### Manual
```bash
# Terminal 1 - API
cd studio/api
npm run start:nest

# Terminal 2 - Web
cd studio/web
npm run dev

# Terminal 3 (opcional) - Playground e Tracing das estruturas de Agent (Mastra AI)
cd studio/api
npm run start:mastra

# Alternativa
# É possível rodar a API e o Playground de Mastra em um só terminal, com o comando:
npm run start:dev
```

Acesse: http://localhost:5177 para o estúdio
Acesse: http://localhost:4111 para o playground/tracing de Mastra-AI

## 🔧 Funcionalidades

### ✅ Implementado
- **Seletores de contexto** - Namespace, App
- **Navegação por seções** - Documentation, Data, Scopes, Pages, Automations
- **Monaco Editor** - Com syntax highlighting e salvamento, e file tree virtual por área ativa
- **Chat AI** - Interface para assistente AI com stream de mensagens e badges para Tool Calling
- **Layout** - Toggle para painéis e draggable para file_tree e ChatPanel
- **Documentação** - Renderização de markdown

### 🔄 Next Steps
- **Deploy Engine**:
  [ ] Botão para salvar alterações no App, com visualização de diff
  [ ] Botão para publicar alterações no workspace de produção
  [ ] Definir melhor qual a fonte de verdade das entidades de dados, e onde fica
  [ ] Supabase para gerenciar acesso ao Studio e secrets dos clientes
  [ ] Separar um git para cada cliente, isolando os módulos do OS
  [ ] Script de montagem inicial e de atualização do OS a cada atualização
- **Workbench**: Gestão de tarefas
- **Discussion**: Estrutura de chat multi-canal, com um canal para cada task/projeto
  - RAG para busca de contexto nas conversa, tanto nos canais, como nas threads específicas


### 🔄 Backlog
- **Preview** - iFrame com browser
- **Public Pages** - Páginas públicas

## 📁 Estrutura de Arquivos

O sistema trabalha com:
```
/preview_customers/{customer}/apps/{namespace}/{app}/
├── docs.md              # Documentation
├── data/                # Data (schemas, migrations)
├── controllers/         # Scopes (APIs, permissions)
├── pages/              # Pages (UI components)
├── components/         # Components (UI components)
└── ...
```

## 🎯 Seções

### Documentation
- Renderiza `docs.md` do app
- Markdown simples com syntax highlighting
- Visão geral do app e especificações

### Data
- Explora diretório `/data`
- Schemas de entidades
- Migrações de banco de dados
- Seeds e dados iniciais

### Scopes
- Navega pelos `/controllers`
- APIs e endpoints
- Permissões e controle de acesso
- Lógica de negócio

### Pages
- Visualiza `/pages` e `/components`
- Componentes de UI React/JSX
- Páginas da aplicação
- Layout e navegação

## 🔌 API Endpoints

### Arquivos
- `POST /files/save` - Salvar arquivo
- `GET /files/tree/:customer/:namespace/:app` - Árvore de arquivos
- `GET /files/content/:customer/:namespace/:app` - Conteúdo de arquivo

### Parâmetros
- `subPath` - Filtrar por subdiretório (data, controllers, pages)
- `path` - Caminho relativo do arquivo

## 🎨 Design System

### Cores
- **Background**: `#1e1e1e` (VS Code Dark)
- **Sidebar**: `#252526`
- **Borders**: `#3e3e42`
- **Active**: `#007acc` (VS Code Blue)
- **Text**: `#d4d4d4` / `#cccccc`

### Componentes
- **Top Bar**: 48px altura, seletores
- **Navigation**: Sidebar 240px, ícones + descrições
- **File Tree**: 280px, árvore expansível
- **Chat**: 320px, mensagens + input
- **Tabs**: Editor/Preview com controles

## 🛠️ Tecnologias

### Backend (studio-api)
- **NestJS** - Framework Node.js
- **TypeScript** - Tipagem estática
- **File System** - Manipulação de arquivos

### Frontend (studio-web)
- **React** - Interface de usuário
- **Vite** - Build tool e dev server
- **Monaco Editor** - Editor de código
- **Lucide React** - Ícones
- **CSS** - Estilização customizada

## 📝 Próximos Passos

1. **Integração Chat AI** - Conectar com LLM real
2. **Preview Components** - Renderização de React components
3. **Automations** - Interface para triggers/workflows
4. **Public Pages** - Gerenciamento de páginas públicas
5. **Agent Builder** - Construtor de bots
6. **Temas** - Suporte a temas claro/escuro
7. **Colaboração** - Edição em tempo real
