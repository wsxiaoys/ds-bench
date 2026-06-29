# Multi-step Registration Form

## Background
You have a React project at `/home/user/tanstack-form-wizard`. Create a multi-step registration form using React, TanStack Form, and Zod validation.

## Requirements
- Build a 2-step registration form.
- **Step 1 (User Info)**: Fields for `firstName` (min 2 chars) and `lastName` (min 2 chars).
- **Step 2 (Account Info)**: Fields for `email` (valid email) and `password` (min 6 chars).
- Use TanStack Form for state management and `@tanstack/zod-form-adapter` for validation.
- Validation must trigger as the user types (onChange).
- Provide a "Next" button to go to Step 2, a "Back" button to return to Step 1, and a "Submit" button on Step 2.
- On successful submit, render a success message element with `id="success-message"` containing the submitted data.

## Implementation Hints
- Maintain the current step in the component state.
- Use `form.trigger()` or validate the fields before proceeding to the next step.
- Use Vite for the React app, and ensure it is configured to run on port 7345 (or run with `--port 7345`).

