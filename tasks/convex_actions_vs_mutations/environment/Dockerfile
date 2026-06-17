FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project/convex && \
    cd /home/user/project && \
    cat >package.json <<'EOF'
{
  "name": "convex-project",
  "version": "1.0.0",
  "dependencies": {
    "convex": "^1.11.0"
  }
}
EOF

RUN cd /home/user/project/convex && \
    cat >schema.ts <<'EOF'
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    isCompleted: v.boolean(),
  }),
});
EOF

RUN cd /home/user/project/convex && \
    cat >tasks.ts <<'EOF'
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addTaskWithApi = mutation({
  args: {},
  handler: async (ctx) => {
    // This fetch call will fail in a mutation!
    const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const data = await response.json();
    
    const taskId = await ctx.db.insert("tasks", {
      title: data.title,
      isCompleted: false,
    });
    return taskId;
  },
});
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Convex project with a buggy mutation that attempts to call an external API."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for running Convex CLI and SDK
#   - /home/user/project: Convex project directory
#   - /home/user/project/package.json: dependencies including convex
#   - /home/user/project/convex/schema.ts: initial schema
#   - /home/user/project/convex/tasks.ts: initial buggy mutation code
