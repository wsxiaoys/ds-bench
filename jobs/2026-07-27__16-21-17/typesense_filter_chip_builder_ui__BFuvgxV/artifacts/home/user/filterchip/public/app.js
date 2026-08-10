(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Field metadata
  // ---------------------------------------------------------------------
  const FIELD_TYPES = {
    id: "string",
    name: "string",
    category: "string",
    brand: "string",
    price: "number",
    rating: "number",
    tags: "string[]",
  };
  const FIELD_NAMES = Object.keys(FIELD_TYPES);

  const CMPS_FOR_TYPE = {
    string: [
      { value: "eq", label: "= (equals)" },
      { value: "ne", label: "!= (not equals)" },
      { value: "in", label: "in (one of set)" },
    ],
    number: [
      { value: "eq", label: "= (equals)" },
      { value: "ne", label: "!= (not equals)" },
      { value: "gt", label: "> (greater than)" },
      { value: "gte", label: ">= (greater or equal)" },
      { value: "lt", label: "< (less than)" },
      { value: "lte", label: "<= (less or equal)" },
      { value: "between", label: "between (inclusive range)" },
      { value: "in", label: "in (one of set)" },
    ],
    "string[]": [{ value: "in", label: "in (array contains one of)" }],
  };

  // ---------------------------------------------------------------------
  // Tree state
  // ---------------------------------------------------------------------
  let nextId = 1;
  function genId() {
    return "n" + nextId++;
  }

  function makeGroup(op) {
    return { id: genId(), kind: "group", op: op || "and", children: [] };
  }

  let tree = makeGroup("and");

  function findNode(node, id) {
    if (node.id === id) return node;
    if (node.kind === "group") {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  }

  function removeChild(root, id) {
    if (root.kind !== "group") return false;
    const idx = root.children.findIndex((c) => c.id === id);
    if (idx !== -1) {
      root.children.splice(idx, 1);
      return true;
    }
    for (const child of root.children) {
      if (removeChild(child, id)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  const treeRootEl = document.getElementById("treeRoot");
  const exprPreviewEl = document.getElementById("exprPreview");

  function renderAll() {
    treeRootEl.innerHTML = "";
    treeRootEl.appendChild(renderGroup(tree, true));
    updatePreview();
  }

  function renderGroup(group, isRoot) {
    const wrap = document.createElement("div");
    wrap.className = "group " + group.op;

    const header = document.createElement("div");
    header.className = "group-header";

    const toggle = document.createElement("div");
    toggle.className = "op-toggle";
    const andBtn = document.createElement("button");
    andBtn.textContent = "AND";
    andBtn.className = "and" + (group.op === "and" ? " active and" : "");
    andBtn.onclick = () => {
      group.op = "and";
      renderAll();
    };
    const orBtn = document.createElement("button");
    orBtn.textContent = "OR";
    orBtn.className = "or" + (group.op === "or" ? " active or" : "");
    orBtn.onclick = () => {
      group.op = "or";
      renderAll();
    };
    toggle.appendChild(andBtn);
    toggle.appendChild(orBtn);
    header.appendChild(toggle);

    const label = document.createElement("span");
    label.className = "hint";
    label.textContent = isRoot ? "Root group" : "Group";
    header.appendChild(label);

    const addCondBtn = document.createElement("button");
    addCondBtn.className = "btn small";
    addCondBtn.textContent = "+ Condition";
    header.appendChild(addCondBtn);

    const addGroupBtn = document.createElement("button");
    addGroupBtn.className = "btn small";
    addGroupBtn.textContent = "+ Nested Group";
    addGroupBtn.onclick = () => {
      group.children.push(makeGroup("and"));
      renderAll();
    };
    header.appendChild(addGroupBtn);

    if (!isRoot) {
      const delBtn = document.createElement("button");
      delBtn.className = "btn small danger";
      delBtn.textContent = "Delete group";
      delBtn.onclick = () => {
        removeChild(tree, group.id);
        renderAll();
      };
      header.appendChild(delBtn);
    }

    wrap.appendChild(header);

    const form = buildConditionForm((cond) => {
      group.children.push(cond);
      renderAll();
    });
    addCondBtn.onclick = () => {
      form.classList.toggle("open");
    };
    wrap.appendChild(form);

    const childrenEl = document.createElement("div");
    childrenEl.className = "children";
    if (group.children.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "No conditions yet — this group matches every document.";
      childrenEl.appendChild(empty);
    }
    for (const child of group.children) {
      if (child.kind === "group") {
        childrenEl.appendChild(renderGroup(child, false));
      } else {
        childrenEl.appendChild(renderChip(child));
      }
    }
    wrap.appendChild(childrenEl);

    return wrap;
  }

  function renderChip(cond) {
    const chip = document.createElement("div");
    chip.className = "chip";

    const fieldEl = document.createElement("span");
    fieldEl.className = "field";
    fieldEl.textContent = cond.field;
    chip.appendChild(fieldEl);

    const cmpEl = document.createElement("span");
    cmpEl.className = "cmp";
    cmpEl.textContent = cond.cmp;
    chip.appendChild(cmpEl);

    const valEl = document.createElement("span");
    valEl.className = "val";
    valEl.textContent = formatValueForDisplay(cond.value);
    chip.appendChild(valEl);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove condition";
    removeBtn.onclick = () => {
      removeChild(tree, cond.id);
      renderAll();
    };
    chip.appendChild(removeBtn);

    return chip;
  }

  function formatValueForDisplay(value) {
    if (Array.isArray(value)) return "[" + value.join(", ") + "]";
    return String(value);
  }

  function buildConditionForm(onAdd) {
    const form = document.createElement("div");
    form.className = "add-form";

    const fieldSelect = document.createElement("select");
    for (const f of FIELD_NAMES) {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      fieldSelect.appendChild(opt);
    }

    const cmpSelect = document.createElement("select");

    const valueContainer = document.createElement("span");
    valueContainer.style.display = "inline-flex";
    valueContainer.style.gap = "6px";

    function fieldType() {
      return FIELD_TYPES[fieldSelect.value];
    }

    function renderCmpOptions() {
      const type = fieldType();
      cmpSelect.innerHTML = "";
      for (const c of CMPS_FOR_TYPE[type]) {
        const opt = document.createElement("option");
        opt.value = c.value;
        opt.textContent = c.label;
        cmpSelect.appendChild(opt);
      }
      renderValueInputs();
    }

    function renderValueInputs() {
      valueContainer.innerHTML = "";
      const type = fieldType();
      const cmp = cmpSelect.value;
      const isNumeric = type === "number";

      if (cmp === "between") {
        const lo = document.createElement("input");
        lo.type = "number";
        lo.step = "any";
        lo.placeholder = "low";
        lo.style.width = "80px";
        const hi = document.createElement("input");
        hi.type = "number";
        hi.step = "any";
        hi.placeholder = "high";
        hi.style.width = "80px";
        valueContainer.appendChild(lo);
        valueContainer.appendChild(hi);
      } else if (cmp === "in") {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = isNumeric
          ? "comma-separated numbers e.g. 10, 20, 30"
          : "comma-separated values e.g. Electronics, Kitchen";
        valueContainer.appendChild(input);
      } else {
        const input = document.createElement("input");
        input.type = isNumeric ? "number" : "text";
        if (isNumeric) input.step = "any";
        input.placeholder = isNumeric ? "numeric value" : "exact text value";
        valueContainer.appendChild(input);
      }
    }

    fieldSelect.onchange = renderCmpOptions;
    cmpSelect.onchange = renderValueInputs;

    // Split a comma-separated string into trimmed tokens, respecting the
    // convention that empty tokens are dropped.
    function splitList(raw) {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    const addBtn = document.createElement("button");
    addBtn.className = "btn small";
    addBtn.textContent = "Add";
    addBtn.onclick = () => {
      const field = fieldSelect.value;
      const cmp = cmpSelect.value;
      const type = fieldType();
      const isNumeric = type === "number";
      let value;

      try {
        if (cmp === "between") {
          const inputs = valueContainer.querySelectorAll("input");
          const lo = Number(inputs[0].value);
          const hi = Number(inputs[1].value);
          if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
            throw new Error("Please enter both a low and high numeric value.");
          }
          value = [lo, hi];
        } else if (cmp === "in") {
          const raw = valueContainer.querySelector("input").value;
          const tokens = splitList(raw);
          if (tokens.length === 0) {
            throw new Error("Please enter at least one value.");
          }
          value = isNumeric
            ? tokens.map((t) => {
                const n = Number(t);
                if (!Number.isFinite(n)) throw new Error(`"${t}" is not a valid number.`);
                return n;
              })
            : tokens;
        } else {
          const raw = valueContainer.querySelector("input").value;
          if (raw === "" || raw === null) {
            throw new Error("Please enter a value.");
          }
          if (isNumeric) {
            const n = Number(raw);
            if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a valid number.`);
            value = n;
          } else {
            value = raw;
          }
        }
      } catch (e) {
        showError(e.message);
        return;
      }

      onAdd({ id: genId(), kind: "condition", field, cmp, value });
      form.classList.remove("open");
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn small";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => form.classList.remove("open");

    form.appendChild(fieldSelect);
    form.appendChild(cmpSelect);
    form.appendChild(valueContainer);
    form.appendChild(addBtn);
    form.appendChild(cancelBtn);

    renderCmpOptions();

    return form;
  }

  // ---------------------------------------------------------------------
  // Serialize tree (UI shape) -> API shape ({op, children} / {field, cmp, value})
  // ---------------------------------------------------------------------
  function serialize(node) {
    if (node.kind === "group") {
      return { op: node.op, children: node.children.map(serialize) };
    }
    return { field: node.field, cmp: node.cmp, value: node.value };
  }

  // ---------------------------------------------------------------------
  // Expression preview (mirrors server-side compilation logic, for display
  // purposes only — the server is the source of truth for actual filtering).
  // ---------------------------------------------------------------------
  function quoteStringPreview(v) {
    const s = String(v);
    return "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
  }

  function previewCondition(cond) {
    const type = FIELD_TYPES[cond.field];
    const isNumeric = type === "number";
    const fmt = (v) => (isNumeric ? String(v) : quoteStringPreview(v));
    switch (cond.cmp) {
      case "eq":
        return `${cond.field}:=${fmt(cond.value)}`;
      case "ne":
        return `${cond.field}:!=${fmt(cond.value)}`;
      case "gt":
        return `${cond.field}:>${cond.value}`;
      case "gte":
        return `${cond.field}:>=${cond.value}`;
      case "lt":
        return `${cond.field}:<${cond.value}`;
      case "lte":
        return `${cond.field}:<=${cond.value}`;
      case "between":
        return `${cond.field}:[${cond.value[0]}..${cond.value[1]}]`;
      case "in":
        return `${cond.field}:=[${cond.value.map(fmt).join(",")}]`;
      default:
        return "?";
    }
  }

  function previewNode(node) {
    if (node.kind === "group") {
      if (node.children.length === 0) return { alwaysTrue: true };
      const compiled = node.children.map(previewNode);
      if (node.op === "and") {
        const parts = compiled.filter((c) => !c.alwaysTrue).map((c) => c.expr);
        if (parts.length === 0) return { alwaysTrue: true };
        if (parts.length === 1) return { alwaysTrue: false, expr: parts[0] };
        return { alwaysTrue: false, expr: `(${parts.join(" && ")})` };
      } else {
        if (compiled.some((c) => c.alwaysTrue)) return { alwaysTrue: true };
        const parts = compiled.map((c) => c.expr);
        if (parts.length === 1) return { alwaysTrue: false, expr: parts[0] };
        return { alwaysTrue: false, expr: `(${parts.join(" || ")})` };
      }
    }
    return { alwaysTrue: false, expr: previewCondition(node) };
  }

  function updatePreview() {
    const compiled = previewNode(tree);
    exprPreviewEl.textContent = compiled.alwaysTrue
      ? "(matches every document — no constraints)"
      : compiled.expr;
  }

  // ---------------------------------------------------------------------
  // Apply / results
  // ---------------------------------------------------------------------
  const errorBox = document.getElementById("errorBox");
  const countBadge = document.getElementById("countBadge");
  const resultsBody = document.getElementById("resultsBody");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  async function applyFilter() {
    clearError();
    countBadge.textContent = "…";
    resultsBody.innerHTML = '<tr><td colspan="2" class="hint">Loading…</td></tr>';
    try {
      const res = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: serialize(tree) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }
      countBadge.textContent = String(data.count);
      const products = data.products || data.ids.map((id) => ({ id, name: "" }));
      products.sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
      if (products.length === 0) {
        resultsBody.innerHTML = '<tr><td colspan="2" class="hint">No matches.</td></tr>';
      } else {
        resultsBody.innerHTML = "";
        for (const p of products) {
          const tr = document.createElement("tr");
          const tdId = document.createElement("td");
          tdId.textContent = p.id;
          const tdName = document.createElement("td");
          tdName.textContent = p.name;
          tr.appendChild(tdId);
          tr.appendChild(tdName);
          resultsBody.appendChild(tr);
        }
      }
    } catch (e) {
      countBadge.textContent = "-";
      resultsBody.innerHTML = '<tr><td colspan="2" class="hint">-</td></tr>';
      showError(e.message);
    }
  }

  document.getElementById("applyBtn").onclick = applyFilter;
  document.getElementById("resetTreeBtn").onclick = () => {
    tree = makeGroup("and");
    renderAll();
  };

  renderAll();
})();
