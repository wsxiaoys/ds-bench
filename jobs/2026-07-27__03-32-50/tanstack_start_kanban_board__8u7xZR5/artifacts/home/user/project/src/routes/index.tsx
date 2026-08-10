import { createFileRoute } from "@tanstack/react-router";
import { Board } from "~/components/board";
import { getBoardFn } from "~/server/board.functions";

export const Route = createFileRoute("/")({
  loader: async () => await getBoardFn(),
  component: HomePage,
});

function HomePage() {
  const initialData = Route.useLoaderData();

  return (
    <div className="page">
      <h1>Kanban Board</h1>
      <Board initialData={initialData} />
    </div>
  );
}
