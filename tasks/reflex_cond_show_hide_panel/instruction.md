# Reflex Conditional Panel with Switch and Cached Visibility Label

## Background
Build a small Reflex application that demonstrates the most common conditional-rendering pattern: a switch (or button) toggles a boolean piece of state, and the UI conditionally renders a panel via `rx.cond`. A cached computed var derives a human-readable label from the same boolean so the visibility status is always in sync with the rendered panel.

## Requirements
- A Reflex project at `/home/user/myproject` initialized with the blank template using `uv` and `reflex`.
- The index page `/` exposes:
  - A control bound to a boolean state var `show_panel` (default `False`) via `on_change`. `rx.switch` is the recommended control, but a button that toggles the same state var is also acceptable.
  - A `rx.cond` block that renders a panel containing the literal text `Secret Panel Content` when `show_panel` is true, and renders nothing (or an empty placeholder) when it is false.
  - A status label that reads exactly `Visibility: shown` when the panel is shown and `Visibility: hidden` when it is hidden. The label text must come from a cached computed var named `visibility_label`.

## Implementation Hints
- Use `uv` to manage the Python environment and initialize the Reflex app non-interactively (`uv init`, `uv add reflex`, `uv run reflex init --template blank`).
- Refer to the Reflex docs for [Conditional Rendering](https://reflex.dev/docs/components/conditional-rendering/), the [Switch component](https://reflex.dev/docs/library/forms/switch/), and [Computed Vars](https://reflex.dev/docs/vars/computed-vars/). Do not assume APIs you have not verified.
- `rx.switch` emits a boolean through its `on_change` trigger; bind it to a setter that updates `show_panel`.
- Declare the boolean state var on your state class with an explicit type annotation and default value: `show_panel: bool = False`.
- Mark the computed var explicitly as cached (`@rx.var(cache=True)`) and have it return a `str`.
- Stop any long-running development servers (e.g. `uv run reflex run`) that you started for manual testing before finishing the task. The verifier compiles the frontend with `uv run reflex export --frontend-only --no-zip` and inspects the source code; it does not require a running server.

