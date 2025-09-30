# Reusable OS Items

Quick guide to the shared structures of the OS. Follow the established best practices:

* **Frontend:** prioritize `shadcn/ui` components, use combobox with filter for selectors, and normalize dates/times via `utils/timezone.js`.
* **Backend:** always open clients through the `UserDataAccessLayer` (or `SystemDAL`/`AdminDAL` when explicitly required) and prefer multiple simple queries over RPCs.
* **Supabase Edge Functions:** import runtime types (`jsr:@supabase/functions-js/edge-runtime.d.ts`) and create clients with `createClient` from `jsr:@supabase/supabase-js@2`.

## Web (`/web`)

### Global styles (`web/src/index.css`)

* Defines theme variables (colors, radius, sidebar tokens, etc.) used across the platform. Always reuse these variables in new styles or overrides to ensure visual consistency.
* New structures should import Tailwind utility classes combined with these tokens; avoid hardcoding colors/values outside of these tokens.

### shadcn components (`web/src/components/ui`)

All follow the official shadcn/ui API. Use them as a base before creating custom components.

* **accordion.jsx** — collapsible panels. Use for FAQs or config blocks.
* **alert-dialog.jsx** — destructive/confirm dialogs. Use for irreversible actions.
* **alert.jsx** — inline warning banners. Use for static feedback or persistent status.
* **aspect-ratio.jsx** — preserves content ratio. Useful for responsive media.
* **avatar.jsx** — avatar with image/fallback. Use to identify users.
* **badge.jsx** — compact labels. Use for quick statuses.
* **breadcrumb.jsx** — hierarchical navigation. Use in deep flows.
* **button.jsx** — main button. Use default variants (default, outline, ghost...).
* **calendar.jsx** — full calendar (Radix + date-fns). Use for date selection.
* **card.jsx** — card with header/body/footer. Use to group content.
* **carousel.jsx** — controlled carousel. Use for galleries or highlights.
* **chart.jsx** — wrapper for charts (Recharts). Use for simple visual data.
* **checkbox.jsx** — accessible checkbox. Use for multiple choice.
* **collapsible.jsx** — collapsible container. Use for advanced filters.
* **combobox.jsx** — combobox with search (Command). The recommended standard for selectors.
* **command.jsx** — command palette. Base for rich menus or custom comboboxes.
* **context-menu.jsx** — contextual menu (right click). Use in lists/tables with actions.
* **dialog.jsx** — generic modal. Use for forms or details.
* **drawer.jsx** — sliding side panel. Use in mobile or settings.
* **dropdown-menu.jsx** — accessible dropdown menu. Use for item actions.
* **form.jsx** — helpers for React Hook Form. Always use when integrating RHF + shadcn.
* **hover-card.jsx** — card on hover. Use for rich tooltips.
* **input-otp.jsx** — multi-box input for OTP codes. Use in security flows.
* **input.jsx** — standard input. Use as base for text fields.
* **label.jsx** — accessible label. Use with inputs.
* **menubar.jsx** — desktop-style menu bar. Use in advanced tools.
* **navigation-menu.jsx** — dropdown menu with hierarchical links. Use for main nav if needed.
* **pagination.jsx** — controlled pagination. Use in long lists.
* **popover.jsx** — positioned popover. Use for compact forms or complex tooltips.
* **progress.jsx** — progress bar. Use for step indicators.
* **radio-group.jsx** — exclusive selection. Use for few mutually exclusive choices.
* **resizable.jsx** — resizable container. Use for split panes.
* **scroll-area.jsx** — styled scrollbar area. Use for tall lists inside modals/cards.
* **select.jsx** — classic select (no search). Use only if combobox is overkill.
* **separator.jsx** — horizontal/vertical divider. Use to separate sections.
* **sheet.jsx** — sheet-style modal (mobile-friendly). Use for secondary actions.
* **sidebar.jsx** — sidebar layout with collapse. Use in apps with side navigation.
* **skeleton.jsx** — loading placeholder. Use while data loads.
* **slider.jsx** — range slider. Use for numeric filters.
* **sonner.jsx** — integrates Sonner toast system. Base for `notify`.
* **switch.jsx** — on/off toggle. Use for binary settings.
* **table.jsx** — table with header/body/footer and helpers. Use for listings.
* **tabs.jsx** — controlled tabs. Use to switch views.
* **textarea.jsx** — styled textarea. Use for long text.
* **toast.jsx / toaster.jsx / use-toast.jsx** — **DEPRECATED, don’t use.**
* **toggle-group.jsx / toggle.jsx** — single/multi toggles. Use for filters or modes.
* **tooltip.jsx** — basic tooltip. Use for short definitions.

### Zazos components (`web/src/components/zazos`)

* **notify.js** — unified notification API based on `sonner`. Use `notify.success|error|info|warning|show` for quick feedback without handling `use-toast` manually.
* **user-combobox.jsx** — complete user combobox (avatar + multi-field search). Always use for user selection.

### Shared components (`web/src/components/shared`)

* **input-money.jsx** — controlled input for monetary values (BRL). Exports `InputMoney` with internal methods like `onValueChange` and paste support. Use in any money field for mask/normalization.
* **select-buttons.jsx** — segmented control based on `@radix-ui/react-toggle-group`. Exports `ButtomGroup` and `ButtomItem`. Use for mutually exclusive alternatives when button-style reading is better than radio.

### Utilities (`web/src/utils`)

* **index.ts** — string and URL helpers.

  * `toKebabCase(str)` — kebab-case. Use for slugs/routes.
  * `toCamelCase(str)` — camelCase. Use when mapping module names.
  * `createPageUrl(namespace, moduleName, pageName)` — builds route `/u/{namespace}/{module}/{page}` preserving query. Use for OS page navigation.
  * `omit(obj, keys)` — removes keys. Use in DTO composition on front.
* **masks.js** — BR masks (CPF, CNPJ, ZIP, money).

  * `formatCpf|formatCnpj|formatZipcode` — formatting.
  * `extractCpf|extractCnpj|extractZipcode|extractMoney` — normalization without mask.
  * `formatMoney` — formats numbers as BRL. Always use before displaying currency.
* **statusColors.js** — color utility for flow status.

  * `getStatusBadge(step)` — returns `label` + `className`. Use when rendering step badges.
* **timezone.js** — consistent date handling.

  * `getTimezone|getLocale` — reads configs.
  * `formatDate|formatDateTime|formatYMD|formatAnyDate` — standardized formats (always use instead of `toLocaleString`).
  * `todayYMD` — current date in `YYYY-MM-DD` adjusted to timezone.

### Contexts (`web/src/contexts`)

* **AuthContext.jsx** — main auth context.

  * Exports: `AuthProvider`, `useAuth`, `useProfiles`, `useSessionContext`, `useUser`.
  * Methods: `signIn`, `signUp`, `signOut`, `refreshUser`, `refreshUserForApp`, `hasAccess`, `loadProfiles`.
  * **How to use in pages:**

    * Wrap your app with `AuthProvider` to ensure auth context.
    * Use `useUser()` to get the logged-in user (`user`), including `id`, `email`, `role` (global role), and `appProfile` (app-specific profile with permissions/local data).
    * Use `useProfiles()` to access the list of available profiles, useful to display or select users.
    * Use `hasAccess(roleOrGroup)` before rendering restricted pages/components.
    * Example:

      ```jsx
      import { useUser, useProfiles } from '@/contexts/AuthContext'
      const user = useUser()
      const profiles = useProfiles()
      // user.role for global role, user.appProfile for current app data
      ```

### Base layout (`web/src/pages/Layout.jsx`)

* Shared shell wrapping each app when rendering pages inside the platform. Defines navigation, sidebar, header, and general OS look.
* Editable by client (global customization layer), not per app. Avoid app-specific tweaks here; any change impacts the entire environment.
* Use to configure themes, global fonts, and navigation composition, ensuring module cohesion.

### Hooks (`web/src/hooks`)

* **use-mobile.jsx** — `useIsMobile()` hook (returns boolean). Use for conditional responsiveness.
* **usePermissions.js** — permission helpers (`hasGroupAccess`, `hasPageAccess`, `isAdmin`, etc.). Useful while group control is not fully integrated with context.

### API (`web/src/api`)

* **apiClient.ts** — REST wrapper with automatic auth.

  * Methods: `request`, `get`, `post`, `put`, `delete`, `patch`, `createUserThread`.
  * Use for calls to `/api` or `/web-api`, avoiding manual token handling.
* **authClient.ts** — auth client (login/signup/logout/me/profiles ...).

  * Use in auth flows; provides `auth` (compatibility) and `authClient` (singleton) with tokens persisted in `localStorage`.
* **storageClient.ts** — storage operations via backend.

  * Methods: `createSignedUrl(s)`, `upload`, `remove`, `list`, `getInfo`, `getPublicUrl`, helpers `downloadFromStorage`, `downloadBoletoPdf`.
  * Use for all bucket interactions; never call Supabase Storage directly.
* **functionsClient.ts** — edge functions invocation via backend.

  * Methods: `invoke(functionName, options)`, `triggerUserEvent(eventName, data)`.
  * Use to trigger automations (`router-on-user-events`).
  * All front functions must be called with `router-on-user-events` + specific event name. This combination triggers `/functions`.
* **integrations.ts** — integrations SDK.

  * `InvokeLLM`, `SendEmail`, `UploadFile`, `GenerateImage`, `ExtractDataFromUploadedFile`.
  * Use when interacting with AI, email, or file processing services. Avoid use. Legacy Base44 structures.
* **entities/** — generated entity exports (agents, configs, flow, avd) and `authClient` as `User`. Use to consume typed app data. Legacy Base44, avoid use.
* **index.ts** — barrel export for `auth`, `storage`, `functions`, `apiClient`, `entities`, `integrations`, plus `AuthProvider`. Always import from here to keep consistency.

### Types (`web/types`)

* **database.types.ts** — Supabase-generated types (full schema). Use to type API responses on front (e.g., `Database['public']['Tables']['profiles']['Row']`).

## Backend (`/backend`)

### Data Access Layer (`backend/src/data-access-layer`)

* **data-access-layer.module.ts** — global Nest module exposing the DAL service. Import into `AppModule` to provide clients.
* **data-access-layer.service.ts** — façade to get clients.

  * `getUserClient(options: AccessControlOptions)` — proxy with role/group/app validations and auditing; default for web routes.
  * `getAdminClient(options: AdminAccessOptions)` — requires `admin|owner` role, gives access to auth/rpc with user context.
  * `getSystemClient()` — system access (jobs, seeds); no user token, but audited.
  * `getLegacyClient()` — legacy; avoid.
* **services/user-data-access-layer.service.ts** — UserDAL implementation.

  * Internal methods: `withAccess`, token validation (`validateAndGetUser`), ownership enforcement (`enforceOwnershipColumn`), automatic auditing in `select|update|delete|upsert|rpc`.
  * Always use `getUserClient` to get instances; extend only in advanced scenarios.
* **services/admin-data-access-layer.service.ts** — AdminDAL with auditing and forwarding for RPCs requiring `auth.uid()`. Use only for critical admin routes.
* **services/system-data-access-layer.service.ts** — audited SystemDAL for internal jobs.
* **interfaces/access-control.interface.ts** — defines `AccessControlOptions`, `CurrentUserProfile`, `Role`, `UserDALClient`, `AdminDALClient`, etc. Use to type params and enforce minimum roles.
* **index.ts** — barrel export (`DataAccessLayerModule`, `DataAccessLayerService`, `UserDataAccessLayer`, `SystemDataAccessLayer`, interfaces). Always import from here.
* **IMPORTANT:** DAL is a wrapper for Supabase client (`@supabase/supabase-js: ^2.58.0`). Use Supabase query syntax. Each app has a dedicated schema (`{namespace}_{app}`, e.g., quero_flow, zazos_avd, ec). Always declare schema explicitly, controllers must use DAL with `.schema().from()` (Supabase client syntax).

### Types (`backend/types`)

* **database.types.ts** — Supabase schema mirror for backend. Use with Supabase Client and when typing DTOs.
* **app.types.ts** — explicit types used in services (`Action`, `Attachment`, `ChatThread`, `Group`, etc.). Use for BFF responses when avoiding `any`.

## Supabase (`/supabase`)

* **web/types/database.types.ts** & **backend/types/database.types.ts** — artifacts generated from migrations. Don’t edit manually; reimport after schema changes.
* **Standard imports for Edge Functions**

  * `import "jsr:@supabase/functions-js/edge-runtime.d.ts";` — ensures Deno runtime types when developing functions.
  * `import { createClient } from 'jsr:@supabase/supabase-js@2';` — always use this version (JSR package) for clients inside edge functions (e.g., `functions/on-database-events/index.ts`).

### When to use Supabase directly

* Inside edge functions (`supabase/functions/**`), use `createClient` with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`.
* Outside of this (frontend/backend) **never** instantiate Supabase clients directly; use wrappers (`apiClient`, DAL).