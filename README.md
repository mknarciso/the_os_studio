# Studio - File Editor Interface

Interface moderna para edição de arquivos do projeto Zazos Maestro, inspirada no design do Vibe Build.

## 🎨 Interface

### Top Bar
- **Seletor de Customer**: Escolha entre customers disponíveis (quero, brendi, start)
- **Seletor de App**: Seleciona namespace/app (ex: quero/flow, core/agents)

### Sidebar de Navegação
- **📄 Documentation**: Acessa `docs.md` do app
- **🗄️ Data**: Explora diretório `/data` (schemas e migrações)
- **🎯 Scopes**: Navega pelos `/controllers` (APIs e permissões)
- **📱 Pages**: Visualiza `/pages` e `/components` (UI frontend)
- **⚡ Automations**: (Em desenvolvimento) Triggers e workflows
- **🌐 Public Pages**: (Em desenvolvimento) Páginas públicas
- **🤖 Agent**: (Em desenvolvimento) Bots multi-canal

### Área Principal
- **File Tree**: Painel lateral com árvore de arquivos (toggle)
- **Abas Editor/Preview**: 
  - **Editor**: Monaco Editor com syntax highlighting
  - **Preview**: Visualização (em desenvolvimento)
- **Chat AI**: Assistente para ajuda com código (toggle)

## 🚀 Como usar

### Desenvolvimento
```bash
# Instalar dependências (primeira vez)
./setup-studio.sh

# Iniciar ambiente de desenvolvimento
./start-dev.sh
```

### Manual
```bash
# Terminal 1 - API
cd studio/api
npm run start:dev

# Terminal 2 - Web
cd studio/web
npm run dev
```

Acesse: http://localhost:5177

## 🔧 Funcionalidades

### ✅ Implementado
- **Seletores de contexto** - Customer, Namespace, App
- **Navegação por seções** - Documentation, Data, Scopes, Pages
- **File tree dinâmico** - Baseado na seção ativa
- **Monaco Editor** - Com syntax highlighting e salvamento
- **Chat AI** - Interface básica para assistente
- **Layout responsivo** - Painéis toggle (file tree, chat)
- **Documentação** - Renderização de markdown

### 🔄 Em desenvolvimento
- **Preview** - Visualização de componentes
- **Automations** - Triggers e workflows
- **Public Pages** - Páginas públicas
- **Agent** - Bots multi-canal
- **Chat AI** - Integração com LLM real

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
