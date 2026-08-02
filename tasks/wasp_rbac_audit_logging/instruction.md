# Wasp RBAC and Audit Logging Enterprise App

## Background
You are building an enterprise user and document management system using Wasp (v0.24.0). The system requires strict Role-Based Access Control (RBAC) with hierarchical roles (`ANALYST`, `MANAGER`, `ADMIN`) and automated audit logging of all database write operations to an `AuditLog` entity.

## Requirements
1. **Database Schema (`schema.prisma`)**:
   Define the following models in your Prisma schema file:
   - `User`: Must represent the application user. It should have an `id` (Int, primary key, autoincrement) and a `role` field (String, default `"ANALYST"`). It has a one-to-many relationship with `Document` and `AuditLog` models.
   - `Document`: Represents enterprise documents. It should have an `id` (Int, primary key, autoincrement), `title` (String), `content` (String), `ownerId` (Int), and `owner` (relation to `User`).
   - `AuditLog`: Represents the system's tamper-proof audit trail. It must have an `id` (Int, primary key, autoincrement), `action` (String, e.g., `"CREATE"`, `"UPDATE"`, `"DELETE"`), `entityName` (String, e.g., `"Document"`), `entityId` (Int), `userId` (Int), `user` (relation to `User`), `timestamp` (DateTime, default `now()`), and `payload` (String, storing a JSON string representation of the document state or operation data).

2. **Authentication & Custom Hooks**:
   - Configure Wasp's `usernameAndPassword` auth in `main.wasp.ts`.
   - The signup process must accept an extra field `role` (valid values: `"ANALYST"`, `"MANAGER"`, `"ADMIN"`). Configure `userSignupFields` to validate and save this field to the `User` entity, defaulting to `"ANALYST"` if not provided or invalid.
   - Implement a custom auth hook `onBeforeSignup` in `main.wasp.ts` that enforces a strict registration rule: users signing up with the `"ADMIN"` role must have a username ending with `_admin` (e.g., `super_admin`). If a user attempts to sign up with the `"ADMIN"` role and a username that does not end with `_admin`, the hook must throw an error, preventing the signup.

3. **Hierarchical RBAC & Operations**:
   - Implement the following operations (Queries & Actions) and declare them in your `main.wasp.ts` spec:
     - `getDocuments` (Query): Returns all documents. Access is allowed for any authenticated user (`ANALYST`, `MANAGER`, `ADMIN`).
     - `getAuditLogs` (Query): Returns all audit logs. Access is restricted ONLY to `ADMIN` users. Non-ADMIN users must be rejected with an `HttpError(403)`.
     - `createDocument` (Action): Creates a new document. Access is allowed for `MANAGER` and `ADMIN` users. `ANALYST` users must be rejected with an `HttpError(403)`. This operation must automatically create a corresponding `AuditLog` entry with `action: "CREATE"`, `entityName: "Document"`, and `payload: JSON.stringify({ title, content })`.
     - `updateDocument` (Action): Updates an existing document's title and content. Access is allowed for `MANAGER` and `ADMIN` users. `ANALYST` users must be rejected with an `HttpError(403)`. This operation must automatically create a corresponding `AuditLog` entry with `action: "UPDATE"`, `entityName: "Document"`, and `payload: JSON.stringify({ title, content })`.
     - `deleteDocument` (Action): Deletes a document. Access is restricted ONLY to `ADMIN` users. `ANALYST` and `MANAGER` users must be rejected with an `HttpError(403)`. This operation must automatically create a corresponding `AuditLog` entry with `action: "DELETE"`, `entityName: "Document"`, and `payload: JSON.stringify({ id })`.

4. **Frontend & Routes**:
   - Create a single-page application dashboard on `/` (MainPage), `/login`, and `/signup` routes.
   - Use specific element attributes and IDs to allow deterministic end-to-end browser verification:
     - **Signup Page (`/signup`)**:
       - Username input: `id="username"`
       - Password input: `id="password"`
       - Role select or input: `id="role"`
       - Submit button: `type="submit"` or `id="signup-btn"`
     - **Login Page (`/login`)**:
       - Username input: `id="username"`
       - Password input: `id="password"`
       - Submit button: `type="submit"` or `id="login-btn"`
     - **Dashboard Page (`/`)**:
       - Display the logged-in user's role in a text element containing `Role: <ROLE_NAME>` (e.g., `Role: ANALYST`, `Role: MANAGER`, `Role: ADMIN`).
       - Display a Logout button: `id="logout-btn"`.
       - **Document Creation Form** (only visible/enabled for `MANAGER` and `ADMIN` roles):
         - Title input: `id="doc-title"`
         - Content input: `id="doc-content"`
         - Create button: `id="create-doc-btn"`
       - **Document List**:
         - For each document with ID `X`:
           - Display its title and content.
           - Display an Update button: `data-testid="update-doc-btn-X"`. Clicking it must update the document's title to `<original_title> (updated)` and content to `<original_content> (updated)`.
           - Display a Delete button: `data-testid="delete-doc-btn-X"` (only visible/enabled for `ADMIN` role). Clicking it must delete the document.
       - **Audit Logs Section** (only visible/accessible for `ADMIN` role):
         - Display a list of all audit logs.
         - Each audit log item must have the attribute `data-testid="audit-log-item"` and show the action, entity name, entity ID, user ID, and payload.

## Implementation Hints
- Project path: `/home/user/app`
- Start command: `wasp start`
- Port: `3000`
- Ensure you run database migrations using `wasp db migrate-dev` after modifying `schema.prisma`.
- All reference imports in `main.wasp.ts` must use the `with { type: "ref" }` syntax.
- Make sure all server-side operations import from `wasp/server/operations` and check `context.user` for authentication and authorization.

