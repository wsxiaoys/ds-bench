import { component$, Slot } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <header>
        <div class="container">
          <h1>
            <Link href="/">My SQLite Blog</Link>
          </h1>
          <nav class="nav-links">
            <Link href="/">Home</Link>
            <Link href="/admin/">Admin</Link>
          </nav>
        </div>
      </header>
      <main class="container">
        <Slot />
      </main>
    </>
  );
});
