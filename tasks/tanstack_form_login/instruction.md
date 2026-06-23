# Basic Login Form with TanStack Form and Zod

## Background
Create a basic login form in React using TanStack Form for state management and Zod for validation.

## Requirements
- Create a login form with `email` and `password` fields.
- Use TanStack Form to manage the form state.
- Use Zod to validate the fields: `email` must be a valid email address, and `password` must be at least 8 characters long.
- Display validation errors below the respective fields.
- On successful submission, display a success message (e.g., "Login successful").
- The application must run on port 8432.

## Implementation Hints
- Set up a React project (e.g., using Vite).
- Install `@tanstack/react-form` and `zod`.
- Use the `useForm` hook and pass Zod schemas to the `validators.onChange` property for each field to trigger validation as the user types.
- Use the `Field` component to render inputs and display `field.state.meta.errors` if they exist.
- Configure your development server to run on port 8432.

## Acceptance Criteria
- Project path: /home/user/project
- Start command: npm run dev
- Port: 8432
- The form must contain an input for email, an input for password, and a submit button.
- Submitting with an empty or invalid email must display a validation error.
- Submitting with a password shorter than 8 characters must display a validation error.
- Submitting with valid data must display a "Login successful" message.

