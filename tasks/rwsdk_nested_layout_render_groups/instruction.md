# Nested Layouts and Multiple Render Groups in RedwoodSDK

## Background
RedwoodSDK (rwsdk) is a server-first React framework for Cloudflare, built as a Vite plugin. Its router lets you compose an application from multiple `render()` groups, where each group binds a distinct HTML *Document* shell to a set of routes. Within a group you can further compose shared UI using `layout()` and group related routes with `prefix()`.

You will build a single RedwoodSDK app that serves two clearly separated sections — a **public** section and an **admin** section — each rendered inside its own Document shell and wrapped by its own layout. The nested routes inside the admin section must all share one common admin layout wrapper (header/nav), while the public routes share the public layout.

A RedwoodSDK starter project is already scaffolded with dependencies installed at `/home/user/project`. Your job is to implement the routing, Document, and layout composition so the app satisfies the interface below.

## Requirements
- Serve a **public** section and an **admin** section from the same `defineApp`, using **two separate `render()` groups** so that each section uses a *different* Document (HTML shell).
- Wrap the public routes in a **public layout** and the admin routes in an **admin layout** using the router's `layout()` composition.
- Group all admin routes under the `/admin` path and make every nested admin route share the same admin layout header/nav.
- Public routes must not include any admin layout chrome, and admin routes must not include any public layout chrome.

## Implementation Hints
- The entry point is `src/worker.tsx`; compose the app with `defineApp` from `rwsdk/worker` and `render`, `route`, `prefix`, and `layout` from `rwsdk/router`.
- Use two `render(Document, [...])` calls to attach different Document shells to the public routes and the admin routes respectively.
- Use `layout()` to inject the shared header/nav wrapper; remember that outer layouts wrap inner ones, and `prefix()` can be combined with `layout()` to scope a shared layout to a route group.
- Layout components can type their props with `LayoutProps` from `rwsdk/router` and render `{children}` where the page content should appear.
- Distinguish the two sections through the required marker elements described below (Document `<title>`, nav `data-testid`s, and per-page `data-testid`s).

## Application Interface (contract the solution must satisfy)
- Project path: `/home/user/project`
- Start command: `npm run dev` (Vite dev server)
- Port: `5173` (routes are served from `http://localhost:5173`)

### Documents (render groups)
- Public routes are rendered inside a Document whose HTML `<title>` is exactly `Public Site`.
- Admin routes are rendered inside a *different* Document whose HTML `<title>` is exactly `Admin Console`.

### Layouts
- The public layout must render a navigation element `<nav data-testid="public-nav">` containing anchor links to `/` (link text `Home`) and `/about` (link text `About`), and must wrap the page content in an element with `data-testid="public-layout"`.
- The admin layout must render a navigation element `<nav data-testid="admin-nav">` containing anchor links to `/admin` (link text `Dashboard`), `/admin/users` (link text `Users`), and `/admin/settings` (link text `Settings`), and must wrap the page content in an element with `data-testid="admin-layout"`.

### Routes and page markers
Each route responds to `GET` with an HTML page. The page's own content must be inside an element carrying the given `data-testid` and include the given text:
- `/` → `data-testid="page-home"`, text includes `Welcome Home`
- `/about` → `data-testid="page-about"`, text includes `About Us`
- `/admin` → `data-testid="page-admin-dashboard"`, text includes `Admin Dashboard`
- `/admin/users` → `data-testid="page-admin-users"`, text includes `Manage Users`
- `/admin/settings` → `data-testid="page-admin-settings"`, text includes `Admin Settings`

