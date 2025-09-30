# Itens Reutilizáveis do OS

Guia rápido das estruturas de uso compartilhado do OS. Respeite as boas práticas já definidas:
- Frontend: priorize componentes `shadcn/ui`, utilize combobox com filtro em seletores e normalize datas/horários via `utils/timezone.js`.
- Backend: sempre abra clientes através do `UserDataAccessLayer` (ou `SystemDAL`/`AdminDAL` quando explicitamente necessário) e prefira múltiplas queries simples a RPCs.
- Supabase Edge Functions: importe os tipos do runtime (`jsr:@supabase/functions-js/edge-runtime.d.ts`) e crie clientes com `createClient` de `jsr:@supabase/supabase-js@2`.

## Web (`/web`)

### Estilos globais (`web/src/index.css`)
- Define as variáveis de tema (cores, radius, tokens de sidebar, etc.) usadas por toda a plataforma. Sempre reutilize essas variáveis em novos estilos ou sobreposições para garantir consistência visual.
- Estruturas novas devem importar classes utilitárias do Tailwind combinadas com os tokens desse arquivo; evite hardcode de cores/valores fora desses tokens.

### Componentes shadcn (`web/src/components/ui`)
Todos seguem a API oficial do shadcn/ui. Use-os como base antes de criar componentes próprios.
- **accordion.jsx** — acordeão para exibir painéis colapsáveis. Use em FAQs ou blocos de configuração.
- **alert-dialog.jsx** — diálogos destrutivos/confirmatórios. Use para ações irreversíveis.
- **alert.jsx** — banners de aviso inline. Use para feedback estático ou status persistentes.
- **aspect-ratio.jsx** — preserva proporção de conteúdo. Útil para mídia responsiva.
- **avatar.jsx** — avatar com imagem/fallback. Use para identificar usuários.
- **badge.jsx** — rótulos compactos. Use para status rápidos.
- **breadcrumb.jsx** — navegação hierárquica. Use em fluxos profundos.
- **button.jsx** — botão principal. Utilize variantes padrão (default, outline, ghost...).
- **calendar.jsx** — calendário completo (Radix + date-fns). Use em seletores de data.
- **card.jsx** — cartão com cabeçalho/corpo/rodapé. Use para agrupar conteúdo.
- **carousel.jsx** — carrossel controlado. Use para galeria ou destaques.
- **chart.jsx** — wrapper para gráficos (aproveita Recharts). Use para dados visuais simples.
- **checkbox.jsx** — caixa de seleção acessível. Use para múltipla escolha.</n+- **collapsible.jsx** — container colapsável controlado. Use para filtros avançados.
- **combobox.jsx** — combobox com busca (Command). É o padrão recomendado para seletores.
- **command.jsx** — paleta de comandos. Base para menus ricos ou combobox customizada.
- **context-menu.jsx** — menu contextual (clique direito). Use em listas/tabelas com ações.
- **dialog.jsx** — modal genérico. Use para formulários ou detalhes.
- **drawer.jsx** — painel lateral deslizante. Use em mobile ou configurações.
- **dropdown-menu.jsx** — menu dropdown acessível. Use para ações de item.
- **form.jsx** — helpers para React Hook Form (FormField, FormItem...). Use sempre que integrar RHF + shadcn.
- **hover-card.jsx** — card ao passar o mouse. Use para tooltips ricos.
- **input-otp.jsx** — input multi-caixa para códigos OTP. Use em fluxos de segurança.
- **input.jsx** — input padrão. Use como base para campos de texto.
- **label.jsx** — label acessível. Use junto dos inputs.
- **menubar.jsx** — barra de menu estilo desktop. Use em ferramentas avançadas.
- **navigation-menu.jsx** — menu suspenso com links hierárquicos. Use em nav principal quando preciso.
- **pagination.jsx** — paginação controlada. Use em listas longas.
- **popover.jsx** — popover posicionado. Use para formulários compactos ou tooltips complexos.
- **progress.jsx** — barra de progresso. Use para etapas antecedentes.
- **radio-group.jsx** — seleção exclusiva. Use para poucas escolhas mutuamente exclusivas.
- **resizable.jsx** — container redimensionável. Use em split panes.
- **scroll-area.jsx** — área com scrollbar estilizado. Use para listas altas dentro de modais/cards.
- **select.jsx** — select clássico (sem busca). Use só quando combobox for exagero.
- **separator.jsx** — divisor horizontal/vertical. Use para separar seções.
- **sheet.jsx** — modal estilo folha (mobile-friendly). Use para ações secundárias.
- **sidebar.jsx** — layout de sidebar com colapsar. Utilize em apps com navegação lateral.
- **skeleton.jsx** — placeholder de carregamento. Use enquanto dados carregam.
- **slider.jsx** — slider de intervalo. Use para filtros numéricos.
- **sonner.jsx** — integra o sistema de toast sonner. Base para `notify`.
- **switch.jsx** — toggle on/off. Use para configurações binárias.
- **table.jsx** — tabela com cabeçalho/corpo/rodapé e helpers. Use em listagens.
- **tabs.jsx** — abas controladas. Use para alternar visões.
- **textarea.jsx** — textarea estilizada. Use para textos longos.
- **toast.jsx / toaster.jsx / use-toast.jsx** — DEPRECADO, não usar.
- **toggle-group.jsx / toggle.jsx** — toggles single/multi. Use para filtros ou modos.
- **tooltip.jsx** — tooltip básico. Use para definições curtas.

### Componentes Zazos (`web/src/components/zazos`)
- **notify.js** — API unificada de notificações baseada em `sonner`. Use `notify.success|error|info|warning|show` para feedback rápido sem lidar com `use-toast` manualmente.
- **user-combobox.jsx** — combobox completa para usuários (avatar + busca multi-campo). Use sempre que houver seleção de usuários.

### Componentes compartilhados (`web/src/components/shared`)
- **input-money.jsx** — input controlado para valores monetários (BRL). Exporta `InputMoney` com métodos internos como `onValueChange` e suporte a paste; use em qualquer campo monetário para garantir máscara/normalização.
- **select-buttons.jsx** — segmented control baseado em `@radix-ui/react-toggle-group`. Exporta `ButtomGroup` e `ButtomItem`; use para alternativas mutuamente exclusivas quando a leitura em botões for melhor que radio.

### Utilitários (`web/src/utils`)
- **index.ts** — helpers de string e URLs.
  - `toKebabCase(str)` — transforma em kebab-case. Use ao gerar slugs/rotas.
  - `toCamelCase(str)` — normaliza para camelCase. Use ao mapear nomes de módulos.
  - `createPageUrl(namespace, moduleName, pageName)` — monta rota `/u/{namespace}/{module}/{page}` preservando query. Use para navegar entre páginas OS.
  - `omit(obj, keys)` — remove chaves. Use em composição de DTOs no front.
- **masks.js** — máscaras BR (CPF, CNPJ, CEP, dinheiro).
  - `formatCpf|formatCnpj|formatZipcode` — formatação.
  - `extractCpf|extractCnpj|extractZipcode|extractMoney` — normalização sem máscara.
  - `formatMoney` — formata valores numéricos como BRL. Use sempre antes de exibir moeda.
- **statusColors.js** — utilitário de cores para status de fluxo.
  - `getStatusBadge(etapa)` — devolve `label` + `className`. Use ao renderizar badges de etapas.
- **timezone.js** — manipulação consistente de datas.
  - `getTimezone|getLocale` — lê configs.
  - `formatDate|formatDateTime|formatYMD|formatAnyDate` — formatações padronizadas (sempre use estes helpers em vez de `toLocaleString`).
  - `todayYMD` — data atual em `YYYY-MM-DD` ajustada ao fuso.

### Contextos (`web/src/contexts`)
- **AuthContext.jsx** — contexto principal de autenticação.
  - Exports: `AuthProvider`, `useAuth`, `useProfiles`, `useSessionContext`, `useUser`.
  - Métodos: `signIn`, `signUp`, `signOut`, `refreshUser`, `refreshUserForApp`, `hasAccess`, `loadProfiles`.
  - **Como usar nas páginas:**  
    - Envolva seu app com `AuthProvider` para garantir contexto de autenticação.
    - Use o hook `useUser()` para obter o usuário atual logado (`user`), incluindo propriedades como `id`, `email`, `role` (papel global) e `appProfile` (perfil específico do app, com permissões e dados locais).
    - Use `useProfiles()` para acessar a lista de perfis disponíveis, útil para exibir ou selecionar usuários.
    - Para verificar permissões, utilize `hasAccess(roleOuGrupo)` antes de renderizar páginas ou componentes restritos.
    - Exemplo de uso em página:
      ```jsx
      import { useUser, useProfiles } from '@/contexts/AuthContext'
      const user = useUser()
      const profiles = useProfiles()
      // user.role para checar papel global, user.appProfile para dados do app atual
      ```

### Layout base (`web/src/pages/Layout.jsx`)
- Shell compartilhado que envolve cada app ao renderizar páginas dentro da plataforma. Define navegação, sidebar, header e o visual geral do OS.
- Editável por cliente (camada de personalização global), não por app individual. Evite ajustes específicos de apps aqui; qualquer mudança impacta todo o ambiente.
- Use este arquivo para configurar temas, fontes globais e composição de navegação, mantendo a coesão entre módulos.

### Hooks (`web/src/hooks`)
- **use-mobile.jsx** — hook `useIsMobile()` (retorna boolean). Use para responsividade condicional.
- **usePermissions.js** — helpers de permissão (`hasGroupAccess`, `hasPageAccess`, `isAdmin`, etc.). Útil enquanto o controle de grupos não estiver 100% integrado ao contexto.

### API (`web/src/api`)
- **apiClient.ts** — wrapper REST com autenticação automática.
  - Métodos: `request`, `get`, `post`, `put`, `delete`, `patch`, `createUserThread`.
  - Use para chamadas ao backend `/api` ou `/web-api` evitando lidar com tokens manualmente.
- **authClient.ts** — cliente de autenticação (login/signup/logout/me/profiles ...).
  - Use em fluxos de auth; fornece `auth` (compatibilidade) e `authClient` (singleton) com tokens persistidos em `localStorage`.
- **storageClient.ts** — operações de storage via backend.
  - Métodos principais: `createSignedUrl(s)`, `upload`, `remove`, `list`, `getInfo`, `getPublicUrl`, helpers `downloadFromStorage`, `downloadBoletoPdf`.
  - Use para qualquer interação com buckets; nunca chame Supabase Storage direto.
- **functionsClient.ts** — invocação de edge functions via backend.
  - Métodos: `invoke(functionName, options)`, `triggerUserEvent(eventName, data)`.
  - Use para acionar automações (`router-on-user-events`).
  - Todas as funções do front devem ser chamadas com `router-on-user-events` e um nome de evento específico. Essa combinação será usada como trigger nas /functions.
- **integrations.ts** — SDK de integrações.
  - `InvokeLLM`, `SendEmail`, `UploadFile`, `GenerateImage`, `ExtractDataFromUploadedFile`.
  - Use quando precisar conversar com serviços de IA, email ou processamento de arquivos. Evitar o uso. Estruturas legadas do Base44.
- **entities/** — exports gerados de entidades (agents, configs, flow, avd) e `authClient` como `User`. Use para consumir dados tipados dos apps. Estrutura legada do Base44, evite o uso.
- **index.ts** — barrel export para `auth`, `storage`, `functions`, `apiClient`, `entities`, `integrations`, além do `AuthProvider`. Importe daqui sempre que possível para manter consistência.

### Tipos (`web/types`)
- **database.types.ts** — tipos gerados do Supabase (schema completo). Use para tipar respostas da API no front (ex.: `Database['public']['Tables']['profiles']['Row']`).

## Backend (`/backend`)

### Data Access Layer (`backend/src/data-access-layer`)
- **data-access-layer.module.ts** — módulo global Nest que expõe o serviço DAL. Importe no `AppModule` para disponibilizar os clientes.
- **data-access-layer.service.ts** — façade para obter clientes.
  - `getUserClient(options: AccessControlOptions)` — cria proxy com validações de role/grupos/app e auditoria; padrão para rotas web.
  - `getAdminClient(options: AdminAccessOptions)` — exige role `admin|owner`, dá acesso a auth/rpc com contexto do usuário.
  - `getSystemClient()` — acesso de sistema (jobs, seeds); sem user token, mas com auditoria.
  - `getLegacyClient()` — legado; evite.
- **services/user-data-access-layer.service.ts** — implementação do UserDAL.
  - Métodos internos: `withAccess`, validação de token (`validateAndGetUser`), enforcement de ownership (`enforceOwnershipColumn`), auditoria automática em `select|update|delete|upsert|rpc`.
  - Use sempre `getUserClient` para obter instâncias; esse arquivo só deve ser extendido em cenários avançados.
- **services/admin-data-access-layer.service.ts** — AdminDAL com auditoria e forwarding para RPCs que demandam `auth.uid()`. Use apenas para rotas administrativas críticas.
- **services/system-data-access-layer.service.ts** — SystemDAL auditado para jobs internos.
- **interfaces/access-control.interface.ts** — definições de `AccessControlOptions`, `CurrentUserProfile`, `Role`, `UserDALClient`, `AdminDALClient`, etc. Utilize para tipar parâmetros e reforçar roles mínimos.
- **index.ts** — barrel export (`DataAccessLayerModule`, `DataAccessLayerService`, `UserDataAccessLayer`, `SystemDataAccessLayer`, interfaces). Sempre importe daqui.
- IMPORTANTE: O DAL é um wrappper para o client do Supabase (@supabase/supabase-js: ^2.58.0). Use a sintaxe do supabase na construção de queries. Cada app possui um schema dedicado no db ({namespace}_{app}, ex: quero_flow, zazos_avd, ec). Sempre declare o schema explicitamente, os controllers devem usar a DAL com `.schema().from()` (sintaxe Supabase-Client).

### Tipos (`backend/types`)
- **database.types.ts** — espelho do schema Supabase para o backend. Use com o Supabase Client e ao tipar DTOs.
- **app.types.ts** — tipos explícitos usados em serviços (`Action`, `Attachment`, `ChatThread`, `Group`, etc.). Use para responses do BFF quando quiser evitar `any`.

## Supabase (`/supabase`)

- **web/types/database.types.ts** & **backend/types/database.types.ts** — artefatos gerados a partir das migrations. Não edite manualmente; reimporte após mudanças no schema.
- **Imports padrão para Edge Functions**
  - `import "jsr:@supabase/functions-js/edge-runtime.d.ts";` — garante tipagem do runtime Deno ao desenvolver funções.
  - `import { createClient } from 'jsr:@supabase/supabase-js@2';` — use sempre esta versão (pacote JSR) para clients dentro de funções edge (ex.: `functions/on-database-events/index.ts`).

### Quando usar Supabase diretamente
- Dentro de edge functions (`supabase/functions/**`) use `createClient` com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` lidos de `Deno.env`.
- Fora disso (frontend/backend) **não** instancie clientes do Supabase diretamente; use os wrappers (`apiClient`, DAL).

