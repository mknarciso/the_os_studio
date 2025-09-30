# Zaz OS – The scalable and flexible Operating System for companies in the AI-era

Zaz OS provides a **simple, extensible architecture** to consolidate back-office processes for small and mid-sized companies into a single, integrated system.

At its core, there is a base project (`the_os`) maintained by Zazos. It enforces **opinionated defaults** to simplify the creation of new apps and accelerate iteration with **AI/Vibe-coding**, while guaranteeing **quality, consistency, and security**.

## Architecture

* **Single-tenant:** Each client runs its own isolated infrastructure.
* **Environments:** Two Git-based environments per client:
  * `preview`: development and preview, where you are editing.
  * `main`: production, will be deployed via github CD/CI.
* **Core structures per tenant:**
  * `/web`: Frontend (React/Vite). Use shadcn/tailwind and global.css variables to keep consistency.
  * `/supabase`: Data, Auth, Storage, Functions. Used as a quick start, only acessible via backend or functions itself.
  * `/backend`: BFF Controllers that validates acess to data, Complex functions, integrations, access to Supabase. Soon it will receive support for Mastra-AI, allowing customers to easily deploy agents, fully integrated with their stack.
  
## Apps

Zaz OS creates a structure where it is very easy to build modular and extensible Apps. Each app has files that are spread across the structures. It has:
- Data: A dedicated schema ({namespace}_{app}) on supabase/postgres, that avoid colision with other apps. A detailed schema is provided in `supabase/schemas/{namespace}/{app}/schema.json`. Currently you can't edit data directly. Suggest edits to the user, and once confirmed update the schema. Keep it consistent to database.types (which is generated from supabase, but has few details).
- Controllers(Scopes): The only way to get data in/out. It uses a BFF approach.
- Pages/Componets: React files that allow customers to create ther own interfaces.
- Agents: Using mastra-ai, we allow customers to create ther own


Important: Your scope is limited to edit only one app at each time. You will receive {namespace: core|zazos|{customer}} on runContext. And you have access only to files from this app. You'll have read-only access to some files from the OS to get context if needed.

## Layout/Branding/Navigation
- `web/src/index.css` sets variables and css styles to be reused across all customer apps. Inside apps prioritize reusing this variables and shadcn components to keep consistency.
- `web/src/pages/Layout.jsx` is responsible for managing first level navigation (between apps), and inside the app, using the `web/src/navigation/{namespace}_{app}.js` exported module. Pages and app can be filtered using role, groups ou appProfile.


## Technical Rules

* `{schema}` = `{namespace}_{app}`. All tables from this app are in a separated schema on the database.
* **Direct Supabase access from frontend is forbidden.** Always go through the Backend (DAL).
* **Migrations:** `{timestamp}__{schema}__migration_name.sql`.
* **Profiles:**
  User profiles is a special entity model. It connects auth.user, public.profile and {schema}.profile under the same id. The idea is that we have an extensible entity for each app context. auth.profile and public.profile will always be acessible, alongside the current app profile, on front-end. Do not use it to save sensitive information, assume it will be available to all users. This is available through AuthContext, both for the currentUser and all active profiles.:
  * `public.profile`: global user info (name, image, role, group, etc.).
  * `{schema}.profile`: app-specific user info (e.g., approver roles, addresses).
  * Both reference the same `auth.users.id`.
* **AuthContext:** Loads `auth.users` + `public.profiles` for context, and exposes helpers for listing users.
* **BFF Pattern:** Each app’s backend controller must expose endpoints tailored to its pages.
* **Legacy Entities API:** `BaseEntityController` exists for Base44 imports only. Do **not** use it in new code.

## Tech Stack
1. **DB/Auth/Storage/Functions:** Supabase
2. **Backend:** NestJS for DAL, access control, integrations (Slack, Gmail, WhatsApp, etc.), and Mastra-AI
3. **Frontend:** React/Vite + Shadcn/UI, centralized interfaces
4. **Agents:** LangGraph framework (backend), multi-agent shared tools
5. **Specs:** GitHub Spec Kit as baseline (to be forked later if needed)
6. **Tests:** Playwright for end-to-end coverage auto-generated from specs

---
## General rules
- Generate clean code, add comments inside each file as a SIMPLE documentation, keep an up-to-date overview at the beginning of the file. Do NOT create new md files for documentation.
- Avoid leaving unused code behind.
- Always use colors style properties as variables from tailwind/shadcn, to keep consistency.

⚡ **Core Principle:** Use proven frameworks, wrap them in opinionated defaults, and deliver everything a company needs to build integrated internal products in **one place**.
