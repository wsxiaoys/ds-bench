(function () {
  "use strict";

  const input = document.getElementById("q");
  const suggestionsEl = document.getElementById("suggestions");

  const DEBOUNCE_MS = 200;

  let debounceTimer = null;
  let requestSeq = 0;
  let currentSuggestions = [];
  let activeIndex = -1;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Wraps the portion of `name` that matches `query` in a <mark> element.
  // Prefers matching the start of a token (word) since search is prefix based;
  // falls back to a plain substring match if no token-start match is found.
  function highlightName(name, query) {
    const trimmedQuery = (query || "").trim();
    if (!trimmedQuery) return escapeHtml(name);

    const lowerName = name.toLowerCase();
    const lowerQuery = trimmedQuery.toLowerCase();

    let start = -1;
    let end = -1;

    const tokenRegex = /[^\s]+/g;
    let match;
    while ((match = tokenRegex.exec(lowerName)) !== null) {
      if (match[0].startsWith(lowerQuery)) {
        start = match.index;
        end = start + lowerQuery.length;
        break;
      }
    }

    if (start === -1) {
      const idx = lowerName.indexOf(lowerQuery);
      if (idx !== -1) {
        start = idx;
        end = idx + lowerQuery.length;
      }
    }

    if (start === -1) return escapeHtml(name);

    const before = name.slice(0, start);
    const matched = name.slice(start, end);
    const after = name.slice(end);

    return `${escapeHtml(before)}<mark>${escapeHtml(matched)}</mark>${escapeHtml(after)}`;
  }

  function closeDropdown() {
    currentSuggestions = [];
    activeIndex = -1;
    suggestionsEl.innerHTML = "";
  }

  function renderSuggestions(items, query) {
    currentSuggestions = items;
    activeIndex = -1;

    if (!items.length) {
      suggestionsEl.innerHTML = "";
      return;
    }

    suggestionsEl.innerHTML = items
      .map((item, index) => {
        return (
          `<div class="suggestion" data-index="${index}" data-id="${escapeHtml(item.id)}" role="option">` +
          `<span class="name">${highlightName(item.name, query)}</span>` +
          `<span class="country">${escapeHtml(item.country)}</span>` +
          `</div>`
        );
      })
      .join("");
  }

  function getSuggestionEls() {
    return Array.prototype.slice.call(
      suggestionsEl.querySelectorAll(".suggestion")
    );
  }

  function setActiveIndex(newIndex, items) {
    activeIndex = newIndex;
    items.forEach(function (el, i) {
      if (i === activeIndex) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  async function fetchSuggestions(query) {
    const seq = ++requestSeq;
    try {
      const response = await fetch("/api/suggest?q=" + encodeURIComponent(query));
      if (!response.ok) throw new Error("Request failed");
      const data = await response.json();
      if (seq !== requestSeq) return; // A newer request has superseded this one.
      renderSuggestions(Array.isArray(data) ? data : [], query);
    } catch (err) {
      if (seq === requestSeq) {
        closeDropdown();
      }
    }
  }

  input.addEventListener("input", function () {
    const value = input.value;
    clearTimeout(debounceTimer);

    if (!value.trim()) {
      requestSeq++; // invalidate any in-flight request
      closeDropdown();
      return;
    }

    debounceTimer = setTimeout(function () {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") {
      const items = getSuggestionEls();
      if (!items.length) return;
      e.preventDefault();
      const next = activeIndex < items.length - 1 ? activeIndex + 1 : items.length - 1;
      setActiveIndex(next, items);
    } else if (e.key === "ArrowUp") {
      const items = getSuggestionEls();
      if (!items.length) return;
      e.preventDefault();
      const prev = activeIndex > 0 ? activeIndex - 1 : 0;
      setActiveIndex(prev, items);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentSuggestions[activeIndex]) {
        e.preventDefault();
        const id = currentSuggestions[activeIndex].id;
        window.location.href = "/item/" + encodeURIComponent(id);
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  });

  // Allow clicking a suggestion with the mouse to navigate as well.
  suggestionsEl.addEventListener("mousedown", function (e) {
    // Prevent the input from losing focus (and the dropdown closing) before click fires.
    e.preventDefault();
  });

  suggestionsEl.addEventListener("click", function (e) {
    const el = e.target.closest(".suggestion");
    if (!el) return;
    const id = el.getAttribute("data-id");
    if (id) {
      window.location.href = "/item/" + encodeURIComponent(id);
    }
  });

  document.addEventListener("click", function (e) {
    if (e.target !== input && !suggestionsEl.contains(e.target)) {
      closeDropdown();
    }
  });
})();
