# Data Table with Inline Editing

## Background
Create a web application that displays a data table with inline editing capabilities using TanStack Table and TanStack Form.

## Requirements
- Initialize a React project (e.g., using Vite or Next.js) at `/home/user/project`.
- Use TanStack Table to render a data grid of users (columns: ID, Name, Email, Role) with at least 3 initial user records.
- Implement inline editing: clicking an "Edit" button on a row should switch the row into edit mode.
- Use TanStack Form to manage the state and validation of the inline edit form (e.g., Name is required, Email must be a valid format). Submitting invalid data should display validation errors and prevent saving.
- Provide "Save" and "Cancel" buttons when a row is in edit mode.
- Saving should update the table data and exit edit mode. Canceling should revert changes and exit edit mode.
- Run the application on port 5732 using `npm run dev` as the start command.

## Implementation Hints
- Use `useReactTable` to manage the table state and columns.
- You can store the editing row ID in the component state to toggle between display and edit modes.
- For the edit mode row, wrap the inputs in a TanStack Form instance (`useForm`) to handle validation and submission.

