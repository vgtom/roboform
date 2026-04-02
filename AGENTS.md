# AGENTS.md

Practical build/deploy guide for OpenSaaS + Wasp micro-SaaS projects, based on this repo's workflow.

---

## 1) Product + Repo Baseline

- Stack: `Wasp` (full-stack), React client, Node/Express server, Prisma DB.
- Base template: OpenSaaS-style project structure.
- Deploy target: Fly.io (separate client + server apps).
- Keep all production operations scriptable (`scripts/*.sh`).

Recommended layout:

- `app/main.wasp` -> routes, pages, operations, server/client config
- `app/src/server/*` -> server middleware, integrations, webhooks, custom routes
- `app/src/client/*` -> app shell, shared UI
- `app/src/pages/*` -> route pages
- `app/public/*` -> static assets + markdown pages + static sitemap files
- `app/scripts/*` -> deploy, migrations, secret import automation

---

## 2) Core Development Practices

### Keep server concerns centralized

- Use a single server middleware entrypoint:
  - `server.middlewareConfigFn` in `main.wasp`
  - implemented in `src/server/serverSetup.ts`
- Put global middleware there (e.g. `express.json({ limit: "15mb" })` for large AI payloads).

### Build reusable UI components first

- Extract shared UI logic into components (`PricingContent` vs page-only implementation).
- Use variants (`"page" | "modal"`) to avoid duplicate code.
- Keep route pages thin; move behavior to reusable components.

### Prefer explicit product rules in one place

- Centralize plan limits and access rules in a single file (e.g. `src/payment/plans.ts`).
- Reference the same constants in:
  - server enforcement
  - UI labels/messages
  - quota displays

### AI usage accounting should be deterministic

- Gate each AI flow before expensive calls.
- Track usage immediately when billing should apply.
- Align usage periods with subscription renewals in a dedicated module.
- For voice: if provider billing counts a request, increment local usage count accordingly.

### Keep legal/content pages content-driven

- Use markdown files in `public/` (`terms.md`, `privacy.md`, `refund-policy.md`, `about.md`).
- Use one shared markdown page component and thin route wrappers.

---

## 3) Wasp Patterns to Reuse

### Add/extend routes

1. Create page component in `src/pages/`.
2. Register route + page in `main.wasp`.
3. If needed, include route in marketing shell checks in `src/client/App.tsx`.

### Add custom server endpoint

1. Add handler module in `src/server/routes/` (e.g. `sitemap.ts`).
2. Register in `serverSetup.ts` via middleware `set(...)`.
3. For primary marketing domain static files, prefer `public/*` when possible.

### Operations

- Keep validation with zod in operation files.
- Throw meaningful `HttpError` status + messages.
- Guard auth/plan access before side effects.

---

## 4) Fly.io Deployment Workflow

Canonical production command:

```bash
cd app
./scripts/deploy-production.sh
```

This should:

1. Build Wasp app.
2. Deploy server app.
3. Deploy client app.
4. Run `prisma migrate deploy` on server.

### Useful scripts

- `scripts/deploy-production.sh` -> full deployment
- `scripts/fly-migrate-production.sh` -> run prod migrations only
- `scripts/fly-import-secrets-from-env.sh <env-file>` -> import secrets (excluding `DATABASE_URL`)

### If migration fails due to Fly tunnel timeout

- Retry:

```bash
cd app
./scripts/fly-migrate-production.sh
```

---

## 5) Secrets + Environment Discipline

- Local dev values: `.env.server`
- Production values: Fly secrets (`flyctl secrets ...`)
- Never rely on `.env.server` as production truth after first deploy.

Admin access pattern:

- `ADMIN_EMAILS` controls default admin assignment at signup/auth mapping.
- Deploy/update secret on Fly:

```bash
flyctl secrets set ADMIN_EMAILS="you@example.com" -a <server-app>
```

---

## 6) SEO + Marketing Defaults

### Metadata

- Keep global metadata in `main.wasp` `head` array:
  - description, OG, twitter, JSON-LD.

### Sitemap

- If marketing domain serves client static content, ensure `public/sitemap.xml` exists.
- Dynamic sitemap endpoint on server is optional, but primary domain must expose sitemap URL that crawlers hit.

### Public routes to keep healthy

- `/`
- `/about`
- `/pricing`
- `/login`
- `/signup`
- `/terms`
- `/privacy`
- `/refund-policy`
- `/sitemap.xml`

---

## 7) Quality Gates Before Deploy

Minimum checklist:

1. `wasp build` passes.
2. Lints pass for changed files.
3. Plan limits and UI copy are consistent.
4. New route is linked from intended navigation.
5. Deployment script succeeds end-to-end.
6. Validate live URLs manually.

Quick post-deploy verification:

- Open key pages.
- Test auth flow.
- Test one AI flow + quota updates.
- Check `/sitemap.xml`.
- Confirm secrets are deployed (`flyctl secrets list -a <server-app>`).

---

## 8) Conventions for Future Micro-SaaS Clones

- Use this repo as a template for:
  - auth + billing scaffolding
  - usage limits + plan gating
  - markdown legal pages
  - Fly deployment automation
- Project-specific changes should mostly be:
  - branding/content
  - domain + SEO metadata
  - pricing/limits
  - core domain operations

Keep these files high-signal and maintained:

- `main.wasp`
- `src/server/serverSetup.ts`
- `src/payment/plans.ts`
- `scripts/deploy-production.sh`
- `scripts/fly-import-secrets-from-env.sh`
- `public/sitemap.xml`

---

## 9) Agent Execution Rules (for AI/code agents)

- Prefer minimal, reversible edits.
- Reuse existing patterns before adding dependencies.
- Keep pricing/business constants centralized.
- Run build/lint checks after substantive changes.
- Deploy only when requested.
- Report deployment status with:
  - server URL
  - client URL
  - migration status
  - any warnings (e.g., Fly listen-address warning)

---

## 10) Copy/Paste Bootstrap for New Project

1. Clone starter.
2. Set `main.wasp` branding + routes.
3. Configure auth providers + `ADMIN_EMAILS`.
4. Define plans in `src/payment/plans.ts`.
5. Implement app-specific operations.
6. Add legal markdown files in `public/`.
7. Set SEO metadata + JSON-LD + sitemap.
8. Configure Fly apps + secrets.
9. Run `./scripts/deploy-production.sh`.
10. Verify production checklist.

