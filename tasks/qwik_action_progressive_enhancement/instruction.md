# Repair Progressive Enhancement for a Qwik City Ticket Form

## Background
A Qwik City (v1.20.0, `@builder.io/qwik` + `@builder.io/qwik-city`) application at `/home/user/project` renders a support-ticket page at the route `/`. The page lists existing tickets (loaded on the server) and provides a form to create a new ticket. The form is meant to be *progressively enhanced*: it must behave correctly BOTH when JavaScript is disabled (the browser performs a native full-page POST and the server renders the result) AND when JavaScript is enabled (the submission is handled on the client with no full-page reload, an in-flight running state, and live validation errors).

The current implementation is broken. With JavaScript disabled, submitting the form does nothing. With JavaScript enabled, submissions do not display validation errors, and in both cases the values the user typed are lost when a submission is rejected. Repair the application so that both submission paths work correctly, without changing the route, control names, validation rules, or the exact strings described below.

## Requirements
- The route `/` renders, on the same page:
  - A list of existing tickets. Each ticket displays its title and its priority.
  - A create-ticket form with these controls (exact `name` attributes): `title` (text input), `priority` (a selector whose value is one of `low`, `medium`, `high`), and `description` (multiline text input).
- Submitting a valid form creates a new ticket on the server and adds it to the list.
- Validation runs on the server with these rules and EXACT messages (the message text must appear on the page for the offending field):
  - `title`: at least 3 characters — `Title must be at least 3 characters`.
  - `description`: at least 10 characters — `Description must be at least 10 characters`.
  - `priority`: must be exactly one of `low`, `medium`, `high` — `Priority must be low, medium, or high`.
- On a REJECTED submission, the page shows the relevant field message(s) AND preserves the values the user already entered for `title`, `description`, and `priority`. No ticket is created.
- On a SUCCESSFUL submission, the page shows the confirmation text `Ticket created: <title>` (with the created ticket's actual title) and the new ticket appears in the list.
- No-JavaScript path: with scripting disabled, submitting performs a native full-page POST to `/`; the server processes it and returns a full HTML page reflecting the outcome (new ticket + confirmation on success, or field messages + preserved values on failure).
- JavaScript-enabled path: with scripting enabled, submitting does NOT cause a full-page navigation. While the submission is in flight, the submit button is disabled and shows the text `Submitting...`; when idle it shows `Create ticket`. After a successful submission the ticket list updates in place to include the new ticket.
- The create action already contains a deliberate ~1 second server-side processing delay (simulating a database write). Keep this delay so that the JS-enabled in-flight running state is observable.
- The initial ticket list must be rendered on the server (present in the initial HTML response before any client JavaScript runs).

## Implementation Hints
- Project path: `/home/user/project`
- Build command: `npm run build`
- Start command: `npm run serve`
- Port: 3000
- Page URL: `http://localhost:3000/`
- The list and the create form MUST live on the same route `/`, and the form MUST submit to `/`.
- Do NOT change the route path, the control `name` attributes (`title`, `priority`, `description`), the allowed `priority` values (`low`, `medium`, `high`), the validation thresholds, or any of the exact message/label strings given above (`Title must be at least 3 characters`, `Description must be at least 10 characters`, `Priority must be low, medium, or high`, `Ticket created: <title>`, `Submitting...`, `Create ticket`).
- Loading `http://localhost:3000/` with JavaScript enabled must not produce any browser console errors.

