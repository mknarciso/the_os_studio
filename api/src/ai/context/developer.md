# APP_EDITOR_RULES.md

## Regras para Edição de Apps no The OS

Este documento define as regras obrigatórias para qualquer modelo de IA ou desenvolvedor que precise editar a estrutura de apps no The OS.

## 🔄 Fluxo de Desenvolvimento

### Regra Principal: Editar → Compilar → Exportar

**NUNCA edite diretamente em `/apps`**. O fluxo correto é:

1. **Editar** na estrutura principal: `/web`, `/backend`, `/supabase`
2. **Compilar** via `./compiler.sh` para aplicar mudanças
3. **Exportar** via `node save_app.js namespace/appName` para salvar em `/apps`

### Estrutura de Edição por Tipo

| Tipo de Arquivo | Editar em | Destino Final |
|-----------------|-----------|---------------|
| **Páginas React** | `/web/src/pages/{namespace}/{appName}/` | `/apps/{namespace}/{appName}/pages/` |
| **Componentes React** | `/web/src/components/{namespace}/{appName}/` | `/apps/{namespace}/{appName}/components/` |
| **Controllers NestJS** | `/backend/src/api-web/{namespace}/{appName}/` | `/apps/{namespace}/{appName}/controllers/` |
| **Migrations SQL** | `/supabase/migrations/` | `/apps/{namespace}/{appName}/data/migrations/` |
| **Entities/Schema** | `/apps/{namespace}/{appName}/entities.json` | Gera `/web/src/api/entities/{appName}.ts` |


## Contextos de trabalho

### 📄 Criando Páginas → Pages e Components

**Localização**: `/web/src/pages/{namespace}/{appName}/` e `/web/src/components/{namespace}/{appName}/`

**Práticas**:
- **Componentes reutilizáveis** entre páginas: criar em `/web/src/components/{namespace}/{appName}/{feature}/`
- **Componentes específicos** de uma página: manter dentro da própria página
- **Sempre usar** componentes shadcn/ui como base (`/web/src/components/ui/`)
- **Imports**: usar caminhos relativos ou absolutos consistentes
- **Estado**: usar React hooks padrão, Context API para estado global do app
- **Condicional e acessos**: para esconder ou mostrar partes da página de acordo com o perfil, usar o padrão descrito em /docs/ACCESS_CONTROL.md
- **Obrigatório** Use .jsx para páginas e componentes

**Exemplo de estrutura**:
```
/web/src/pages/quero/flow/
├── Solicitacoes.jsx          # Página principal
├── DetalheSolicitacao.jsx    # Página de detalhe
└── components/               # Componentes específicos da página
    └── SolicitacaoCard.jsx

/web/src/components/quero/flow/
├── forms/                    # Componentes reutilizáveis
│   └── SolicitacaoForm.jsx
└── badges/
    └── StatusBadge.jsx
```

### 🔄 Acesso/Alteração de Dados pelo usuário → Controllers

**Localização**: `/backend/src/api-web/{namespace}/{appName}/`

**Práticas**:
- **Sempre** através de controlers que utilizam o DAL
- **Sempre** user /types/database.types.ts entender a estrutura de dados disponível
- **Não** usar o Base-Entity-Controller, ele é para dar acesso completo através de queries a uma entidade, para compatibilidade com apps antigos. Prefira criar acesso a dados específico para a rota no padrão BFF. 
- **Queries identicas ao Supabase Client**: O DAL extende o supabase client, e sua sintaxe é a mesma. Use como padrão para acesso a dados, sempre especificando .schema().from()
- **Métodos customizados**: adicionar apenas quando necessário, além do CRUD padrão
- **Segurança**: Usar sempre o UserDAL com token do usuário e definição de acessos coerentes. 
- **Manipulações de Auth**: Única excessão são manipulações de auth, que precisam ser feitas pelo SystemDAL, sempre verifique que o token do usuário é de role:admin antes de executar. (Ex: criar usuário, mudar role, status, etc)
- **Queries complexas**: preferir múltiplas queries simples. Não criar RPCs
- **Logs**: usar `this.logger` para debug e auditoria

### 🗄️ Mudar Estrutura de Dados → Migration/Entities

**Localização**: `/supabase/migrations/`

**Práticas**:
- **entities.json**: definir schema completo das tabelas com relacionamentos
- **Migrations**: criar apenas quando houver uma clara mudança de schema, evitar migrations desnecessárias
- **Nomenclatura**: `{timestamp}__{schema}__{descricao_clara}.sql` [SEMPRE!]
- **Ordem**: sempre testar migrations em sequência
- **Rollback**: considerar como reverter mudanças críticas
- **Foreign Keys**: definir relacionamentos no entities.json
- **Indexes**: adicionar para campos de busca frequente


### ⚡ Automações Assíncronas → Functions

**Localização**: `/supabase/functions/apps/{namespace}/{app_name}/`

**Práticas**:
- **Triggers**: usar para automações baseadas em eventos do banco
- **Webhooks**: para integrações externas (Slack, email, APIs)
- **Jobs**: para processamento pesado ou em lote
- **Timeout**: configurar limites apropriados
- **Error handling**: sempre capturar e logar erros
- **Retry**: implementar retry logic para operações críticas
- **Environment**: usar variáveis de ambiente para configurações




## 🔐 Controle de Acesso e Segurança

### Regra Fundamental: Sempre usar UserDAL

**PROIBIDO**: Acesso direto ao Supabase pelo frontend
**EVITAR**: Criar migrações de banco de dados desnecessárias, faça apenas para mudar schema. Não usar rpcs. Prefira queries, mesmo que em partes nos controllers.
**OBRIGATÓRIO**: Todo acesso a dados deve passar pelo backend e Data Access Layer

### Sistema de Roles e Grupos

- **Roles**: `'guest' | 'member' | 'admin' | 'owner'` (hierárquicos)
- **Groups**: Arrays de strings para controle granular
- **Mínimo padrão**: `minimumRole: 'member'` para operações básicas

## 📁 Estrutura de Arquivos

### Estrutura Obrigatória por App

```
/apps/{namespace}/{appName}/
├── appConfig.json          # Configuração principal
├── entities.json           # Schema das entidades
├── navigation.json         # Estrutura de navegação  
├── layout.jsx             # Layout (referência)
├── pages/                 # Páginas React
│   └── {PageName}.jsx
├── components/            # Componentes organizados por feature
│   └── {feature}/
│       └── {Component}.jsx
├── controllers/           # Controllers NestJS
│   └── {entity}.controller.ts
└── data/                  # Scripts SQL
    └── migrations/
        └── {timestamp}_{description}.sql
```

### Namespaces Obrigatórios

- **`/apps/core`**: Apps obrigatórios (perfis, grupos, configurações)
- **`/apps/zazos`**: Apps padrão da Zazos
- **`/apps/{empresa}`**: Apps customizados por cliente

## 🗄️ Banco de Dados e Migrations

### Padrão de Nomenclatura

**Migrations**: `{timestamp}__{schema}__{nome_da_migration}.sql`

Exemplos:
- `20250823000001__public__create_users_table.sql`
- `20250823000002__quero_flow__init_schema.sql`

### Schemas por Namespace

- **core**: usa schema `public`
- **outros**: usa schema `{namespace}_{appName}`
- Exemplo: `quero_flow`, `zazos_abandonoPro`

### Perfis de Usuário

- **`public.profile`**: Dados compartilhados entre apps (nome, cargo, role, grupos)
- **`{namespace}.profile`**: Dados específicos do app (permissões, configurações locais, dados específicos do app)
- Ambos usam o mesmo `id` de `auth.users`

## ⚛️ Frontend (React)

### Componentes UI

- **SEMPRE** usar componentes do shadcn/ui disponíveis em `/web/src/components/ui/`
- Se um componente for reutilizado entre várias páginas do app, criar um componente genérico em `web/src/components/{namespace}/{appName}/{feature}`. Caso seja usado apenas em uma página, mantenha nela.

### Notificações ao usuário
- Usar o componente notify para enviar notificações e avisos ao usuário.
```jsx
import { notify } from '@/components/zazos/notify'

notify.success('Salvo com sucesso')
notify.error('Falha ao salvar', { description: 'Tente novamente mais tarde.' })
notify.info('Sincronizando...')
notify.show({ title: 'Atualização disponível', description: 'Clique para atualizar.' })
```

### Padrões de Código
- **Obrigatório** Use .jsx para páginas e componentes
- **Interfaces** para definir tipos
- **Nomes descritivos** para variáveis e funções
- **Comentários** constantes porém conscisos

## 🔧 Comandos Essenciais

### Desenvolvimento
```bash
# Compilar mudanças
./compiler.sh

# Salvar app de volta para /apps
node save_app.js namespace/appName

# Exemplo completo
node save_app.js quero/flow
```

### Validação
```bash
# Verificar estrutura
ls -la apps/namespace/appName/

# Verificar migrations
ls -la supabase/migrations/
```

## ❌ Proibições Absolutas

1. **Edição direta em `/apps`** - sempre editar na estrutura principal
2. **Acesso direto ao Supabase pelo frontend** - usar sempre o backend
3. **Controllers sem BaseEntityController** - sempre estender a classe base
4. **Migrations sem padrão de nomenclatura** - seguir `{timestamp}__{schema}__{nome}.sql`
5. **Schemas incorretos** - core usa `public`, outros usam `{namespace}_{appName}`

## ✅ Checklist de Validação

Antes de finalizar qualquer edição:

- [ ] Editei na estrutura correta (`/web`, `/backend`, `/supabase`)?
- [ ] Controllers estendem `BaseEntityController`?
- [ ] Migrations seguem padrão de nomenclatura?
- [ ] Schema está correto para o namespace?
- [ ] Usei componentes shadcn/ui?
- [ ] Executei `./compiler.sh`?
- [ ] Executei `node save_app.js namespace/appName`?
- [ ] Testei a funcionalidade?

## 🚨 Em Caso de Erro

1. **Sempre ler os logs** do compiler.sh
2. **Verificar permissões** no Data Access Layer
3. **Confirmar estrutura** de arquivos
4. **Validar migrations** no banco
5. **Testar acesso** com usuário real

---

**Lembre-se**: O The OS é um sistema opinativo que prioriza consistência e segurança. Seguir essas regras garante qualidade e evita problemas de produção.



Novas infos
- Em seletores, sempre priorize um componente estilo combobox, que permite digitar para filtrar
- O Data Access Layer (DAL) é um wrapper em torno de um Client do Supabase, use sempre a sintaxe do Supabase-Cli para acessar os dados
- Para fazer paginação, use a sintaxe do supabase cli no controller e prepare o front para usar a mesma estrutura do base-entity-controller sem muitas mudanças
- Para manipular inputar e apresentar date, datetime e timestamp, sempre use utils/timezone.js