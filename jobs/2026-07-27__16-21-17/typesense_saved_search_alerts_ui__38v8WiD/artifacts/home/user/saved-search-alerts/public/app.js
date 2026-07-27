const savedSearchListEl = document.getElementById("saved-search-list");
const catalogListEl = document.getElementById("catalog-list");
const createForm = document.getElementById("create-form");
const checkAllBtn = document.getElementById("check-all-btn");
const ingestBtn = document.getElementById("ingest-selected-btn");
const ingestStatus = document.getElementById("ingest-status");

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch (e) {
      body = { error: res.statusText };
    }
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function renderSavedSearches(searches) {
  savedSearchListEl.innerHTML = "";
  if (searches.length === 0) {
    savedSearchListEl.innerHTML =
      '<li class="hint" style="border:none;background:none;">No saved searches yet.</li>';
    return;
  }

  for (const s of searches) {
    const li = document.createElement("li");
    li.dataset.id = s.id;

    const metaParts = [];
    metaParts.push(`q: ${s.q ? s.q : "*"}`);
    metaParts.push(`category: ${s.category ? s.category : "any"}`);
    metaParts.push(`max price: ${s.max_price === null ? "any" : s.max_price}`);

    const matchLabel = s.match_count === null ? "—" : s.match_count;
    const newLabel = s.new_count === null ? "—" : s.new_count;
    const newIsZero = s.new_count === 0 || s.new_count === null;

    li.innerHTML = `
      <div class="ss-info">
        <span class="ss-name">${escapeHtml(s.name)}</span>
        <span class="ss-meta">${escapeHtml(metaParts.join(" · "))}</span>
      </div>
      <div class="ss-stats">
        <span class="badge match-count" title="Current match count">matches: ${matchLabel}</span>
        <span class="badge new-count ${newIsZero ? "zero" : ""}" title="New matches since last check">new: ${newLabel}</span>
        <button class="secondary check-btn" data-id="${s.id}">Check</button>
      </div>
    `;
    savedSearchListEl.appendChild(li);
  }

  savedSearchListEl.querySelectorAll(".check-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api(`/api/saved-searches/${btn.dataset.id}/check`, { method: "POST" });
        await loadSavedSearches();
      } catch (e) {
        alert(e.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

async function loadSavedSearches() {
  const searches = await api("/api/saved-searches");
  renderSavedSearches(searches);
}

async function loadCatalog() {
  const catalog = await api("/api/catalog");
  catalogListEl.innerHTML = "";
  for (const doc of catalog) {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="checkbox" class="catalog-checkbox" value="${escapeHtml(doc.id)}" />
      <span class="catalog-name">${escapeHtml(doc.name)}</span>
      <span class="catalog-meta">${escapeHtml(doc.category)} · $${doc.price}</span>
    `;
    li.dataset.doc = JSON.stringify(doc);
    catalogListEl.appendChild(li);
  }
}

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("f-name").value.trim();
  const q = document.getElementById("f-q").value;
  const category = document.getElementById("f-category").value.trim();
  const maxPriceRaw = document.getElementById("f-max-price").value;
  const max_price = maxPriceRaw === "" ? null : Number(maxPriceRaw);

  try {
    await api("/api/saved-searches", {
      method: "POST",
      body: JSON.stringify({ name, q, category, max_price }),
    });
    createForm.reset();
    await loadSavedSearches();
  } catch (err) {
    alert(err.message);
  }
});

checkAllBtn.addEventListener("click", async () => {
  checkAllBtn.disabled = true;
  try {
    await api("/api/check-all", { method: "POST" });
    await loadSavedSearches();
  } catch (err) {
    alert(err.message);
  } finally {
    checkAllBtn.disabled = false;
  }
});

ingestBtn.addEventListener("click", async () => {
  const checked = Array.from(
    catalogListEl.querySelectorAll(".catalog-checkbox:checked")
  );
  if (checked.length === 0) {
    ingestStatus.textContent = "Select at least one document.";
    return;
  }

  const documents = checked.map((cb) => JSON.parse(cb.closest("li").dataset.doc));

  ingestBtn.disabled = true;
  ingestStatus.textContent = "Ingesting…";
  try {
    const result = await api("/api/ingest", {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
    ingestStatus.textContent = `Ingested ${result.ingested} document(s).`;
    checked.forEach((cb) => (cb.checked = false));
  } catch (err) {
    ingestStatus.textContent = err.message;
  } finally {
    ingestBtn.disabled = false;
  }
});

loadSavedSearches().catch((err) => console.error(err));
loadCatalog().catch((err) => console.error(err));
