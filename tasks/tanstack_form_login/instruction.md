# Basic Login Form with TanStack Form and Zod

## Background
Create a basic login form in React using TanStack Form for state management and Zod for validation.

## Requirements
- Create a login form with `email` and `password` fields, and a submit button.
- Use TanStack Form to manage the form state.
- Use Zod to validate the fields: `email` must be a valid, non-empty email address, and `password` must be at least 8 characters long.
- Display validation errors below the respective fields.
- On successful submission, display the success message "Login successful".
- The application must run on port 8432.

## Implementation Hints
- Set up a React project (e.g., using Vite) in `/home/user/project`.
- Install `@tanstack/react-form` and `zod`.
- Use the `useForm` hook and pass Zod schemas to the `validators.onChange` property for each field to trigger validation as the user types.
- Use the `Field` component to render inputs and display `field.state.meta.errors` if they exist.
- Configure your development server to run on port 8432 and start the application using `npm run dev`.

