# Wasp Task Deadlines & Filtering

## Background
Wasp allows passing arguments to Queries. In this task, you will implement a Task List that supports filtering tasks by their deadline status.

## Requirements
- **Data Model**:
    - `Task` entity with `description` (String) and `dueDate` (DateTime).
- **Operations**:
    - `getTasks` Query: Fetch tasks from the database. It should accept an optional argument `overdueOnly` (Boolean). If `true`, only return tasks where `dueDate` is in the past.
    - `createTask` Action: Create a new task with a description and a `dueDate`.
- **Frontend**:
    - A main page that displays the task list.
    - A form to add new tasks (with description and date input).
    - A toggle (checkbox or button) to "Show Overdue Only".
    - Use Wasp's `useQuery` with arguments to filter the list reactively.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/task-deadlines` using the minimal template.
2. **Define Schema**:
   - Add `dueDate` (DateTime) to `Task` model in `schema.prisma`.
3. **Configure App**:
   - Define `route` and `page` for `MainPage`.
4. **Implement Operations**:
   - Declare `query getTasks` with `entities: [Task]`.
   - In `src/queries.ts`, implement the filtering logic using Prisma's `where` clause (e.g., `where: overdueOnly ? { dueDate: { lt: new Date() } } : {}`).
5. **Build UI**:
   - Use a state variable for the toggle and pass it to `useQuery(getTasks, { overdueOnly })`.
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/task-deadlines`
- **Start Command**: `wasp start`
- **Port**: 3000
