# Wasp Automatic CRUD with Overrides

## Background
Wasp's Automatic CRUD feature allows you to generate standard operations for an entity with minimal code. You can also override specific operations with custom logic. In this task, you will implement a CRUD interface for Tasks with a custom create operation.

## Requirements
- **Data Model**:
    - `Task` entity with `description` (String) and `isDone` (Boolean, default: `false`).
- **Automatic CRUD**:
    - Declare a `crud Tasks` in `main.wasp` for the `Task` entity.
    - Enable `getAll` (public) and `create` operations.
    - Override the `create` operation with a custom function.
- **Custom Logic**:
    - The custom `create` implementation should append " [NEW]" to the task's `description` before saving it to the database.
- **Frontend**:
    - A main page that uses `Tasks.getAll.useQuery()` and `Tasks.create.useAction()`.
    - A form to create tasks and a list to display them.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/crud-override` using the minimal template.
2. **Define Schema**:
   - Define the `Task` model in `schema.prisma`.
3. **Configure App**:
   - Add the `crud` declaration to `main.wasp` with `overrideFn` for `create`.
4. **Implement Override**:
   - In `src/tasks.ts`, implement the custom `create` function using the `Tasks.CreateAction` type.
5. **Build UI**:
   - Use the generated `Tasks` object in `MainPage.tsx`.
6. **Database Migration**:
   - Run `wasp db migrate-dev`.

## Constraints
- **Project Path**: `/home/user/crud-override`
- **Start Command**: `wasp start`
- **Port**: 3000
