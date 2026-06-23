# Wasp Background Jobs

## Background
Wasp supports background jobs for performing asynchronous tasks. In this task, you will implement a job that processes tasks in the background.

## Requirements
- **Data Model**:
    - `Task` entity with `description` (String) and `isProcessed` (Boolean, default: `false`).
- **Background Job**:
    - Define a `job processTasks` in `main.wasp` using the `PgBoss` executor (or simple executor for SQLite).
    - The job should find all `Task` records where `isProcessed` is `false` and set it to `true`.
- **Action**:
    - Implement an action `triggerJob` that submits the `processTasks` job.
- **Frontend**:
    - A main page to create tasks.
    - A button to \"Trigger Background Job\".
    - Display the status (Processed/Unprocessed) for each task.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/background-jobs` using the minimal template.
2. **Define Schema**:
   - Add `isProcessed` to `Task` model in `schema.prisma`.
3. **Configure App**:
   - Add the `job` and `action` declarations to `main.wasp`.
4. **Implement Job & Action**:
   - In `src/jobs.ts`, implement the job logic.
   - In `src/actions.ts`, implement `triggerJob` using `processTasks.submit()`.
5. **Build UI**:
   - Use `useQuery` and `useAction` in `MainPage.tsx`.
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/background-jobs`
- **Start Command**: `wasp start`
- **Port**: 3000
