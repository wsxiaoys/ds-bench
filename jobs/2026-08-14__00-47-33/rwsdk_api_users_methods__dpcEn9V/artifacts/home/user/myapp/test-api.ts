// @ts-ignore
import.meta.env = { BASE_URL: "/", VITE_IS_DEV_SERVER: false };

import app from "./src/worker";

async function fetchApp(req: Request) {
  return app.fetch(req, undefined as any, undefined as any);
}

async function assertResponse(
  res: Response,
  expectedStatus: number,
  expectedBody?: any
) {
  if (res.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, but got ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (expectedStatus !== 204) {
    if (!contentType.includes("application/json")) {
      throw new Error(`Expected JSON response, but got content-type: ${contentType}`);
    }
    const body = await res.json();
    if (expectedBody !== undefined) {
      if (typeof expectedBody === "function") {
        expectedBody(body);
      } else {
        const actualStr = JSON.stringify(body);
        const expectedStr = JSON.stringify(expectedBody);
        if (actualStr !== expectedStr) {
          throw new Error(`Expected body ${expectedStr}, but got ${actualStr}`);
        }
      }
    }
    return body;
  } else {
    const text = await res.text();
    if (text !== "") {
      throw new Error(`Expected empty body for 204, but got: ${text}`);
    }
    return null;
  }
}

async function runTests() {
  console.log("Starting API tests...");

  // 1. GET /api/users initially empty
  console.log("Testing GET /api/users (initially empty)...");
  let res = await fetchApp(new Request("http://localhost/api/users", { method: "GET" }));
  await assertResponse(res, 200, { users: [] });

  // 2. POST /api/users with missing/invalid payload
  console.log("Testing POST /api/users (invalid payload - empty body)...");
  res = await fetchApp(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  );
  await assertResponse(res, 400, { error: "invalid payload" });

  console.log("Testing POST /api/users (invalid payload - missing email)...");
  res = await fetchApp(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe" }),
    })
  );
  await assertResponse(res, 400, { error: "invalid payload" });

  console.log("Testing POST /api/users (invalid payload - non-string name)...");
  res = await fetchApp(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 123, email: "john@example.com" }),
    })
  );
  await assertResponse(res, 400, { error: "invalid payload" });

  // 3. POST /api/users valid payload (User 1)
  console.log("Testing POST /api/users (valid payload - User 1)...");
  res = await fetchApp(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John Doe", email: "john@example.com" }),
    })
  );
  let user1: any;
  await assertResponse(res, 201, (body: any) => {
    if (typeof body.id !== "string" || body.id === "") {
      throw new Error("Expected user ID to be a non-empty string");
    }
    if (body.name !== "John Doe" || body.email !== "john@example.com") {
      throw new Error(`Unexpected body fields: ${JSON.stringify(body)}`);
    }
    user1 = body;
  });

  // 4. POST /api/users valid payload (User 2)
  console.log("Testing POST /api/users (valid payload - User 2)...");
  res = await fetchApp(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Jane Smith", email: "jane@example.com" }),
    })
  );
  let user2: any;
  await assertResponse(res, 201, (body: any) => {
    if (typeof body.id !== "string" || body.id === "") {
      throw new Error("Expected user ID to be a non-empty string");
    }
    if (body.name !== "Jane Smith" || body.email !== "jane@example.com") {
      throw new Error(`Unexpected body fields: ${JSON.stringify(body)}`);
    }
    user2 = body;
  });

  // 5. GET /api/users lists both users in insertion order
  console.log("Testing GET /api/users (should have 2 users in order)...");
  res = await fetchApp(new Request("http://localhost/api/users", { method: "GET" }));
  await assertResponse(res, 200, { users: [user1, user2] });

  // 6. GET /api/users/:id for existing user
  console.log("Testing GET /api/users/:id (existing user)...");
  res = await fetchApp(new Request(`http://localhost/api/users/${user1.id}`, { method: "GET" }));
  await assertResponse(res, 200, user1);

  // 7. GET /api/users/:id for non-existing user
  console.log("Testing GET /api/users/:id (non-existing user)...");
  res = await fetchApp(new Request(`http://localhost/api/users/non-existent-id`, { method: "GET" }));
  await assertResponse(res, 404, { error: "not found" });

  // 8. PUT /api/users/:id for non-existing user
  console.log("Testing PUT /api/users/:id (non-existing user)...");
  res = await fetchApp(
    new Request(`http://localhost/api/users/non-existent-id`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No One" }),
    })
  );
  await assertResponse(res, 404, { error: "not found" });

  // 9. PUT /api/users/:id with invalid payload
  console.log("Testing PUT /api/users/:id (invalid payload - non-string name)...");
  res = await fetchApp(
    new Request(`http://localhost/api/users/${user1.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 123 }),
    })
  );
  await assertResponse(res, 400, { error: "invalid payload" });

  // 10. PUT /api/users/:id valid update (name only)
  console.log("Testing PUT /api/users/:id (valid update - name only)...");
  res = await fetchApp(
    new Request(`http://localhost/api/users/${user1.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Johnny Doe" }),
    })
  );
  const updatedUser1 = { ...user1, name: "Johnny Doe" };
  await assertResponse(res, 200, updatedUser1);

  // Verify GET lists updated user
  res = await fetchApp(new Request(`http://localhost/api/users/${user1.id}`, { method: "GET" }));
  await assertResponse(res, 200, updatedUser1);

  // 11. DELETE /api/users/:id for existing user
  console.log("Testing DELETE /api/users/:id (existing user)...");
  res = await fetchApp(new Request(`http://localhost/api/users/${user1.id}`, { method: "DELETE" }));
  await assertResponse(res, 204);

  // Verify GET /api/users/:id returns 404
  res = await fetchApp(new Request(`http://localhost/api/users/${user1.id}`, { method: "GET" }));
  await assertResponse(res, 404, { error: "not found" });

  // Verify GET /api/users lists only user2
  res = await fetchApp(new Request("http://localhost/api/users", { method: "GET" }));
  await assertResponse(res, 200, { users: [user2] });

  // 12. DELETE /api/users/:id for non-existing user
  console.log("Testing DELETE /api/users/:id (non-existing user)...");
  res = await fetchApp(new Request(`http://localhost/api/users/${user1.id}`, { method: "DELETE" }));
  await assertResponse(res, 404, { error: "not found" });

  console.log("All tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
