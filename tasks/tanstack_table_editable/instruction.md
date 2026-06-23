# Data Table with Inline Editing

## Background
Create a web application that displays a data table with inline editing capabilities using TanStack Table and TanStack Form.

## Requirements
- Initialize a React project (e.g., using Vite or Next.js).
- Use TanStack Table to render a data grid of users (columns: ID, Name, Email, Role).
- Implement inline editing: clicking an "Edit" button on a row should switch the row into edit mode.
- Use TanStack Form to manage the state and validation of the inline edit form (e.g., Name is required, Email must be a valid format).
- Provide "Save" and "Cancel" buttons when a row is in edit mode.
- Saving should update the table data and exit edit mode. Canceling should revert changes and exit edit mode.
- Run the application on port 5732.

## Implementation Hints
- Use `useReactTable` to manage the table state and columns.
- You can store the editing row ID in the component state to toggle between display and edit modes.
- For the edit mode row, wrap the inputs in a TanStack Form instance (`useForm`) to handle validation and submission.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: npm run dev
- Port: 5732
- Test Criteria:
  1. The app must serve a web page on port 5732.
  2. The table must display at least 3 initial user records containing columns for ID, Name, Email, and Role.
  3. Each row must have an "Edit" button.
  4. Clicking "Edit" changes the row's Name, Email, and Role cells into input fields managed by TanStack Form, and shows "Save" and "Cancel" buttons.
  5. Submitting the form with invalid data (e.g., empty Name) should display validation errors and prevent saving.
  6. Submitting the form with valid data should update the row's display and exit edit mode.
  7. Clicking "Cancel" should discard changes and exit edit mode.

