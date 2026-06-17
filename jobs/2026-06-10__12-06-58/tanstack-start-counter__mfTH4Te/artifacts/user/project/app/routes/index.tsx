import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

// In-memory counter state on the server
let count = 0;

// Server function to get the current count
const getCount = async () => {
  "use server";
  return count;
};

// Server function to increment the counter
const incrementCount = async () => {
  "use server";
  count += 1;
  return count;
};

export const Route = createFileRoute("/")({
  loader: async () => {
    const initialCount = await getCount();
    return { initialCount };
  },
  component: Home,
});

function Home() {
  const { initialCount } = Route.useLoaderData();
  const [currentCount, setCurrentCount] = useState(initialCount);

  const handleIncrement = async () => {
    const newCount = await incrementCount({ method: "POST" });
    setCurrentCount(newCount);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>TanStack Start Counter</h1>
      <p>Count: {currentCount}</p>
      <button onClick={handleIncrement}>Increment</button>
    </div>
  );
}
