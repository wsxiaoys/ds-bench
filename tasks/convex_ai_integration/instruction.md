# Convex AI Integration

## Background
Convex is a reactive backend-as-a-service. You need to build a Convex backend that integrates with an external LLM API. In Convex, mutations cannot have side effects (like calling external APIs), so you must use an Action to fetch the data and then call a Mutation to save it.

## Requirements
- Initialize a React app with Vite and Convex in `/home/user/myproject`.
- Define a Convex schema with a `generations` table containing `prompt` (string) and `result` (string).
- Create a Convex query `api.ai.list` that returns all records from the `generations` table.
- Create a Convex mutation `api.ai.save` that takes `prompt` and `result` as arguments and inserts them into the `generations` table.
- Create a Convex action `api.ai.generate` that takes a `prompt` string.
  - The action must call the OpenAI API (`https://api.openai.com/v1/chat/completions`) using the `OPENAI_API_KEY` environment variable.
  - Use the `gpt-4o-mini` model.
  - After receiving the response, the action must call the `api.ai.save` mutation to store the `prompt` and the generated `result`.
- Update the React app UI to include an input field to submit a prompt (which calls the `api.ai.generate` action) and a list that displays all generated results using the `api.ai.list` query.
- The app must connect to the Convex cloud instance using the `CONVEX_URL` provided in the environment.

## Implementation Hints
- Use `npm create vite@latest myproject -- --template react-ts` and `npm install convex` to set up the project.
- Use `npx convex deploy` to deploy the Convex functions to the cloud. The `CONVEX_DEPLOY_KEY` is provided in the environment.
- In Convex actions, you can access environment variables using `process.env`. Make sure `OPENAI_API_KEY` is configured in your Convex deployment environment variables.
- Use the `ctx.runMutation` method inside your action to call the mutation.

## Acceptance Criteria
- Project path: /home/user/myproject
- Start command: npm run dev
- Port: 5173
- Convex API:
  - Query `api.ai.list`: Returns a JSON array of generation objects.
  - Action `api.ai.generate`: Accepts a JSON object with a `prompt` string, calls OpenAI, and saves the result via the mutation.
- The React app should successfully render and connect to the Convex backend.

