# Wasp Auth Hooks (onBeforeSignup)

## Background
Wasp's auth hooks allow you to execute custom logic during the authentication process. In this task, you will use the `onBeforeSignup` hook to implement a username blacklist.

## Requirements
- **Authentication**: Enable `usernameAndPassword` authentication.
- **Auth Hook**:
    - Declare `onBeforeSignup` in `main.wasp`.
    - Implement the hook in `src/auth/hooks.ts`.
    - The hook should check if the `providerUserId` (the username) contains the word "blocked".
    - If it does, throw an `HttpError(403, "This username is not allowed.")`.
- **Frontend**:
    - Use Wasp's built-in `SignupForm` and `LoginForm`.
    - A protected main page that displays "Welcome [username]".

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/auth-hooks` using the minimal template.
2. **Configure App**:
   - Set up `auth` in `main.wasp` with `onBeforeSignup`.
   - Define `route` and `page` for `MainPage`, `LoginPage`, and `SignupPage`.
3. **Implement Hook**:
   - In `src/auth/hooks.ts`, implement `onBeforeSignup` following the Wasp documentation.
4. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/auth-hooks`
- **Start Command**: `wasp start`
- **Port**: 3000
