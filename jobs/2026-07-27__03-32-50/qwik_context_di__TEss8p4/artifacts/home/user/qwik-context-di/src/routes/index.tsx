import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { StorePage } from "~/components/store-page";

// Route component: 1 level below the context provider in routes/layout.tsx.
export default component$(() => {
  return <StorePage />;
});

export const head: DocumentHead = {
  title: "Qwik Context DI Storefront",
  meta: [
    {
      name: "description",
      content: "Shopping cart storefront demo using Qwik context dependency injection",
    },
  ],
};
