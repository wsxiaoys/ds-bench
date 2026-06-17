// Mock feed data — simulates a paginated API returning items with a nextCursor.

const ALL_ITEMS = [
  { id: 1, title: "Understanding React Server Components", author: "Alice Chen", excerpt: "A deep dive into RSC architecture and how it changes the way we build React applications." },
  { id: 2, title: "TanStack Query Best Practices", author: "Bob Martinez", excerpt: "Learn how to manage server state effectively with TanStack Query in large-scale applications." },
  { id: 3, title: "Building Accessible UI Components", author: "Carol Nguyen", excerpt: "Practical tips for creating components that work for everyone, including screen reader users." },
  { id: 4, title: "The Future of CSS: 2026 Edition", author: "Dave Patel", excerpt: "New CSS features landing in browsers this year and how to use them today." },
  { id: 5, title: "TypeScript 5.x Advanced Patterns", author: "Eve Johansson", excerpt: "Template literal types, const type parameters, and other advanced TypeScript techniques." },

  { id: 6, title: "Rust for JavaScript Developers", author: "Frank Okafor", excerpt: "A gentle introduction to Rust concepts through the lens of familiar JavaScript patterns." },
  { id: 7, title: "Edge Computing with Cloudflare Workers", author: "Grace Kim", excerpt: "Deploy globally distributed applications with minimal latency using edge functions." },
  { id: 8, title: "State Machines in Frontend Development", author: "Henry Liu", excerpt: "How XState and state machines eliminate entire categories of UI bugs." },
  { id: 9, title: "WebAssembly Beyond the Browser", author: "Iris Thompson", excerpt: "Running Wasm on the server, in IoT devices, and other non-browser environments." },
  { id: 10, title: "Designing REST APIs That Scale", author: "Jack Williams", excerpt: "Principles for building APIs that remain maintainable as your user base grows." },

  { id: 11, title: "GraphQL Federation in Practice", author: "Karen Davis", excerpt: "Lessons learned from migrating a monolith GraphQL server to a federated architecture." },
  { id: 12, title: "Testing React Applications with Vitest", author: "Leo Hernandez", excerpt: "A comprehensive guide to unit, integration, and component testing with Vitest." },
  { id: 13, title: "Docker Multi-Stage Builds for Frontend", author: "Maria Rossi", excerpt: "Optimize your Docker images with multi-stage builds for production React apps." },
  { id: 14, title: "The Art of Code Review", author: "Nathan Park", excerpt: "How to give and receive constructive code reviews that improve team productivity." },
  { id: 15, title: "Web Performance Budgets", author: "Olivia Brown", excerpt: "Setting and enforcing performance budgets to keep your web app fast." },
];

const PAGE_SIZE = 5;

/**
 * Simulates fetching a page of feed items.
 * @param {number} cursor - The cursor (page number, 0-indexed) to fetch.
 * @returns {Promise<{ items: Array, nextCursor: number | null }>}
 */
export async function fetchFeedPage(cursor = 0) {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 500));

  const start = cursor * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const items = ALL_ITEMS.slice(start, end);

  const nextCursor = end < ALL_ITEMS.length ? cursor + 1 : null;

  return { items, nextCursor };
}
