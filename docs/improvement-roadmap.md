## Plan: Webapp Improvement Roadmap

TL;DR: Stabilize the app shell and routing first, then improve type safety and state management, followed by performance, security, and UX polish. This is a phased plan with clear file targets and verification steps.

**Steps**
1. Stabilize routing and lazy loading
   - Replace `MemoryRouter` with `BrowserRouter` in `App.tsx` for real browser URLs and refresh support.
   - Wrap lazy-loaded pages in a `Suspense` fallback so route-level `React.lazy` does not break loading.
   - Confirm `RouteGuard` and redirect logic is correct for buyer/seller/admin roles and doesn’t silently drop users.

2. Harden type safety and developer tooling
   - Add ESLint configuration and lint scripts to the repo.
   - Enable stricter TypeScript compiler options in `tsconfig.json` such as `strict`, `noImplicitAny`, and `forceConsistentCasingInFileNames`.
   - Refactor `AppContext.tsx` and key components to remove broad `any` usage and use the interfaces in `types.ts`.
   - Clean up `services/supabaseClient.ts` and `vite.config.ts` to use `import.meta.env` consistently and avoid hard-coded API keys.

3. Refactor app state and data fetching
   - Break apart the monolithic `AppContext` into smaller feature-focused providers or hooks where practical.
   - Keep `queryCache.ts` but ensure cache invalidation is used consistently after mutations.
   - Improve `fetchPublicData()` and user data hydration paths to reduce duplicate fetches and avoid stale UI.
   - Validate all Supabase queries and RPC responses with typed return values and proper error handling.

4. Improve UX and accessibility
   - Ensure the persistent preloader, scroll-to-top, and footer links are polished and do not interfere with navigation.
   - Add loading fallbacks for lazy page imports and large page transitions.
   - Audit forms and buttons for accessible labels, focus states, and keyboard support.
   - Fix any visible open redirect or unsafe URL handling by using `safeRedirect` from `security.ts`.

5. Strengthen security and environment handling
   - Remove any fallback non-secret keys from source files, replacing them with placeholders and `.env.example` guidance.
   - Ensure auth/session event handling in `AppContext.tsx` is safe and that banned users cannot access protected pages.
   - Integrate `getCsrfToken()` or remove unused client-side security helpers if they are not actually used.
   - Verify the PWA/service worker configuration in `vite.config.ts` does not expose stale or insecure assets.

**Relevant files**
- `App.tsx` — router, route guards, lazy loading, app shell, preloader, scroll handlers.
- `index.tsx` — root render and service worker registration.
- `AppContext.tsx` — global state, data hydration, Supabase auth listeners, caching, and actions.
- `services/supabaseClient.ts` — Supabase client initialization and env handling.
- `vite.config.ts` — build config, PWA setup, runtime env injection.
- `types.ts` — domain interfaces to tighten unsafe `any` usage.
- `queryCache.ts` — stale-while-revalidate cache helper.
- `security.ts` — sanitizers, safe redirects, CSRF, rate limiting.
- `package.json` / `ci.yml` — add lint/build validation and developer tooling.

**Verification**
1. Run `npm ci` then `npm run lint` and `npm run build` with the updated config.
2. Confirm the app starts and routes work in browser mode (refresh, direct URL access).
3. Check that lazy pages show a loading fallback instead of blank or error.
4. Validate that the app compiles with `strict` TypeScript and that the largest `any` hotspots are gone from `AppContext.tsx` and major pages.
5. Review security improvements by locating any hard-coded API keys and verifying environment variables are required.

**Decisions**
- The first priority is app stability: routing, lazy loading, and build reliability.
- Second priority is code quality: stricter TS and removing `any` across the shared state layer.
- This plan does not yet include a full visual redesign; it focuses on structural, performance, and security improvements across the existing app.

**Further Considerations**
1. If you want, I can implement this as a set of discrete changes in the same order, one phase at a time.
2. We should decide whether to add a formal linting/formatting step now or after the first refactor.
