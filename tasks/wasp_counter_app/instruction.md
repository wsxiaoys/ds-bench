# Wasp Counter Application

## Background
Wasp is a declarative DSL for building full-stack web applications. In this task, you will build a simple Counter application that demonstrates the core features of Wasp: Entities, Operations (Queries & Actions), and React integration.

## Requirements
- **Data Model**:
    - `Counter` entity with an `id` (Int, primary key) and `count` (Int, default: 0) field.
- **Operations**:
    - `getCounter` Query: Fetch the first counter record from the database. If it doesn't exist, create one with count 0.
    - `increment` Action: Increment the `count` of the counter by 1.
    - `decrement` Action: Decrement the `count` of the counter by 1.
- **Frontend**:
    - A main page that displays the current count.
    - Two buttons: "Increment" and "Decrement" to call the respective actions.
    - Use Wasp's `useQuery` and `useAction` hooks for reactivity.

## Implementation Guide
1. **Initialize Project**:
   - Create a new Wasp project in `/home/user/counter-app` using the minimal template: `wasp new counter-app -t minimal`.
2. **Define Schema**:
   - In `schema.prisma`, define the `Counter` model.
3. **Configure App**:
   - In `main.wasp`, define the `route` and `page` for `MainPage`.
4. **Implement Operations**:
   - Declare `query getCounter`, `action increment`, and `action decrement` in `main.wasp`.
   - Implement the logic in `src/queries.ts` and `src/actions.ts`.
5. **Build UI**:
   - Use `useQuery` and `useAction` hooks in `src/MainPage.tsx` to interact with the backend.
6. **Database Migration**:
   - Run `wasp db migrate-dev` to apply your schema changes.

## Constraints
- **Project Path**: `/home/user/counter-app`
- **Start Command**: `wasp start`
- **Port**: 3000
- **Database**: SQLite (default)
