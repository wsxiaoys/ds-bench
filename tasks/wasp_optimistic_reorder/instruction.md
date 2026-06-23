# Wasp Optimistic Updates for Task Reordering

## Background
Optimistic updates allow for a more responsive UI by updating the client-side state before the server responds. In this task, you will implement task reordering with optimistic updates using Wasp's `useAction` hook.

## Requirements
- **Data Model**:
    - `Task` entity with `description` (String) and `position` (Int).
- **Operations**:
    - `getTasks` Query: Fetch all tasks, sorted by `position` ascending.
    - `createTask` Action: Create a new task and assign it the next available position.
    - `moveTaskUp` Action: Swap the `position` of the current task with the task immediately above it.
- **Frontend**:
    - A main page that displays the task list sorted by position.
    - For each task, show a "Move Up" button (except for the first task).
    - Use `useAction` with `optimisticUpdates` for the `moveTaskUp` action to swap the tasks in the local cache immediately.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/optimistic-reorder` using the minimal template.
2. **Define Schema**:
   - Add `position` (Int) to `Task` model in `schema.prisma`.
3. **Configure App**:
   - Define `route`, `page`, `query`, and `action` in `main.wasp`.
4. **Implement Operations**:
   - In `src/actions.ts`, implement `moveTaskUp` to find the task with `position - 1` and swap positions.
5. **Build UI with Optimistic Updates**:
   - In `MainPage.tsx`, use `useAction(moveTaskUp, { optimisticUpdates: [...] })`.
   - The `updateQuery` function should swap the tasks in the `oldData` array.
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/optimistic-reorder`
- **Start Command**: `wasp start`
- **Port**: 3000
