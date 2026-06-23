# Wasp Many-to-Many Relationships (Labels)

## Background
Wasp supports complex database relationships using Prisma. In this task, you will implement a many-to-many relationship between Tasks and Labels.

## Requirements
- **Data Model**:
    - `Task` entity with `description` (String).
    - `Label` entity with `name` (String, unique).
    - A many-to-many relationship between `Task` and `Label`.
- **Operations**:
    - `getTasks` Query: Fetch all tasks with their associated labels.
    - `createTask` Action: Create a new task.
    - `createLabel` Action: Create a new label.
    - `addLabelToTask` Action: Associate an existing label with an existing task.
- **Frontend**:
    - A main page that displays the task list and their labels.
    - Forms to create tasks and labels.
    - A way to select a label and add it to a task (e.g., a dropdown and button for each task).

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/many-to-many` using the minimal template.
2. **Define Schema**:
   - In `schema.prisma`, define the `Task` and `Label` models with a many-to-many relation.
3. **Configure App**:
   - Define `route`, `page`, `query`, and `action` in `main.wasp`.
4. **Implement Operations**:
   - In `src/queries.ts`, use Prisma's `include` to fetch labels for each task.
   - In `src/actions.ts`, use Prisma's `connect` to establish the relationship in `addLabelToTask`.
5. **Build UI**:
   - Use `useQuery` and `useAction` in `MainPage.tsx`.
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/many-to-many`
- **Start Command**: `wasp start`
- **Port**: 3000
