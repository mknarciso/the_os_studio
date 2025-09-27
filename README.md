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
  [x] Botão para salvar alterações no App, com visualização de diff
  [x] Adicionar o commit ao git do app
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

### Top Bar
- Botão de Salvar App:
  [x] Verifica diferenças entre os arquivos do osPath e do appPath, se houver diferenças, habilita o botão de salvar
  [x] Ao clicar em salvar, abre um modal com os diffs dos arquivos (comparando osPath e appPath)
  [x] Ao clicar em salvar, chama o endpoint /apply-diffs com os arquivos a serem salvos
  [-] O endpoint /apply-diffs no back, faz segue as seguintes etapas
    [x] Copia os arquivos de osPath para appPath
    [x] Garante que o git está na raiz do git do app (apps/{namespace}/{app}), o git deve ter o nome: apps-{namespace}-{app}.git e estar na branch 'main'
    [x] Faz o `git add .`,  adicionando todos os arquivos da pasta (apps/{namespace}/{app}) em staged changes
    [x] Faz o `git commit -m {message}` com a mensagem recebida na request. Se não houver 'message' na request, usa uma iso timestamp
    [x] Faz o `git push`


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

Base: http://localhost:3001

### Files
- `POST /files/save` — Salvar arquivo
- `GET /files/tree/:namespace/:app?subPath=` — Árvore de arquivos (filtra por subdiretório)
- `GET /files/content/:namespace/:app?path=` — Conteúdo de arquivo (caminho relativo)
- `GET /files/content-by-os?path=` — Conteúdo via caminho absoluto do OS
- `GET /files/content-by-app?path=` — Conteúdo via caminho relativo ao app

### Git
- `GET /git/unsaved-diffs?namespace=&app=&verbose=` — Lista diffs não salvos
- `POST /git/apply-diffs` — Aplica diffs
  - body: `{ namespace, app, files?: [{ osPath?, appPath? }] }`

### Documentation
- `GET /documentation?namespace=&app=` — Lista documentos
- `GET /documentation/app?namespace=&app=` — Documento do app
- `PUT /documentation/app?namespace=&app=` — Atualiza documento do app
- `GET /documentation/:entityType?namespace=&app=` — Lista entidades
- `POST /documentation/:entityType?namespace=&app=` — Cria entidade
- `PUT /documentation/:entityType/:slug?namespace=&app=` — Atualiza entidade
- `DELETE /documentation/:entityType/:slug?namespace=&app=` — Remove entidade

### AI
- `POST /ai/threads` — Cria thread
- `POST /ai/threads/:threadId/messages/stream` — Envia mensagem (SSE)
- `GET /ai/threads` — Lista threads
- `GET /ai/threads/:threadId` — Detalhe da thread
- `DELETE /ai/threads/:threadId` — Remove thread
- `POST /ai/threads/:threadId/messages` — Envia mensagem
- `GET /ai/threads/:threadId/messages` — Lista mensagens
- `POST /ai/test/validate-message` — Valida payload de mensagem
- `GET /ai/graph` — Grafo JSON
- `GET /ai/graph.mermaid` — Grafo Mermaid (text/plain)
- `GET /ai/graph.html` — Grafo em HTML
- `POST /ai/ui/run` — Executa pipeline de UI
  - body: `{ action: 'init_db'|'update_from_file'|'list_all'|'update_all', namespace, app, filePath? }`

### Branding
- `GET /branding/content?path=` — Conteúdo de arquivo de branding
- `POST /branding/run` — Executa workflow de branding
- `POST /branding/test` — Executa teste do workflow
      
### Parâmetros
- `subPath` - Filtrar por subdiretório (data, controllers, pages)
- `path` - Caminho relativo do arquivo
- `osPath` - Caminho relativo à raiz do OS para um arquivo ou pasta. Exemplo: "web/src/pages/quero/flow/FluxoCompras.jsx"
- `appPath` - Caminho relativo à raiz do git do app específico para um arquivo ou pasta. Exemplo: "quero/flow/pages/FluxoCompras.jsx"
