import { StartClient } from "@tanstack/start/client";
import { hydrateRoot } from "react-dom/client";
import { StrictMode, startTransition } from "react";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>
  );
});
