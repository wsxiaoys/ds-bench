# Reactive List with Convex and Expo (React Native)

## Background
Convex is a reactive backend-as-a-service. Expo is a framework for React Native. In this task, you will build a simple reactive task list app using Expo and Convex.

## Requirements
- Create an Expo project in `/home/user/my-app`.
- Integrate Convex into the Expo project.
- Define a `tasks` table in the Convex schema with fields: `text` (string), `isCompleted` (boolean), and `runId` (string).
- Implement a Convex query to fetch tasks filtered by `runId`.
- Implement a Convex mutation to add a new task with a given `text` and `runId` (defaulting `isCompleted` to `false`).
- Build the React Native UI to display the tasks, and provide an input and button to add new tasks.
- Deploy the Convex backend functions.
- The Expo app must be runnable on the web.

## Implementation Hints
- Use `npx create-expo-app@latest my-app --template blank-typescript` to initialize the project.
- Install `convex` and `@expo/metro-runtime` (if needed for web).
- Use `npx expo install react-native-web react-dom` to ensure web support is fully installed.
- The Convex backend requires `CONVEX_DEPLOY_KEY` to deploy. Run `npx convex deploy` to push your schema and functions to the cloud.
- To connect the Expo app to Convex, you need to pass the Convex URL to `ConvexReactClient`. You can expose the `CONVEX_URL` environment variable to the Expo app by prefixing it, e.g., setting `EXPO_PUBLIC_CONVEX_URL=$CONVEX_URL` and using `process.env.EXPO_PUBLIC_CONVEX_URL` in your code.
- To isolate test runs, the app must filter tasks by `runId`. Expose the `ZEALT_RUN_ID` environment variable to the Expo app (e.g., `EXPO_PUBLIC_RUN_ID=$ZEALT_RUN_ID`) and use it when querying and mutating data.
- In your UI, add `testID="task-input"` to the `TextInput` and `testID="add-button"` to the add `Button` or `Pressable` so they can be easily found by the verifier.
- Add `testID="task-item"` to the component wrapping each task text.

## Acceptance Criteria
- Project path: /home/user/my-app
- Start command: npx expo start --web --port 8081
- Port: 8081
- The Convex backend must be deployed and active.
- The web app must load successfully.
- The web app must contain an input field with `data-testid="task-input"` (React Native web translates `testID` to `data-testid`).
- The web app must contain a submit button with `data-testid="add-button"`.
- Typing a task into the input and clicking the button must call the Convex mutation and display the new task with `data-testid="task-item"`.
- The tasks must be isolated per `runId`.

