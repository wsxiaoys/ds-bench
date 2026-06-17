# Wasp User Roles & Protected Routes

## Background
Wasp provides built-in authentication and authorization. In this task, you will implement role-based access control (RBAC) to restrict access to an Admin page.

## Requirements
- **Authentication**: Enable `usernameAndPassword` authentication.
- **Data Model**:
    - `User` entity with a `role` field (String, can be "ADMIN" or "USER", default: "USER").
- **Custom Signup**: Implement `userSignupFields` to allow setting the `role` during signup for testing purposes (e.g., if username is "admin", set role to "ADMIN").
- **Pages**:
    - `MainPage` (protected): Accessible to any logged-in user. Displays "Welcome [username]".
    - `AdminPage` (protected, path: `/admin`): Accessible **only** to users with the "ADMIN" role. Displays "Admin Panel".
- **Redirects**: If a non-admin user tries to access `/admin`, they should be redirected to the main page or see an "Access Denied" message.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/user-roles` using the minimal template.
2. **Define Schema**:
   - Add `role` field to `User` model in `schema.prisma`.
3. **Configure App**:
   - Set up `auth` in `main.wasp` with `userSignupFields`.
   - Define `route` and `page` for `MainPage` and `AdminPage`.
4. **Implement Signup Logic**:
   - In `src/auth.ts`, implement `userSignupFields` to set the role based on the username.
5. **Protect Admin Page**:
   - In `AdminPage.tsx`, check `user.role` and redirect or show error if not "ADMIN".
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/user-roles`
- **Start Command**: `wasp start`
- **Port**: 3000
