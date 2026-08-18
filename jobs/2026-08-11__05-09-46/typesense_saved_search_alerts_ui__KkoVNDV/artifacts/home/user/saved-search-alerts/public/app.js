document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const saveSearchForm = document.getElementById('save-search-form');
  const searchNameInput = document.getElementById('search-name');
  const searchQInput = document.getElementById('search-q');
  const searchCategoryInput = document.getElementById('search-category');
  const searchMaxPriceInput = document.getElementById('search-max-price');
  
  const catalogList = document.getElementById('catalog-list');
  const ingestAllBtn = document.getElementById('ingest-all-btn');
  
  const searchesList = document.getElementById('searches-list');
  const checkAllBtn = document.getElementById('check-all-btn');
  
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  // State
  let savedSearches = [];
  let catalogItems = [];
  const ingestedIds = new Set(); // Track ingested IDs in current session

  // Show Toast Notification
  function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    if (type === 'error') {
      toast.className = 'fixed bottom-5 right-5 transform translate-y-0 opacity-100 transition-all duration-300 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50';
    } else {
      toast.className = 'fixed bottom-5 right-5 transform translate-y-0 opacity-100 transition-all duration-300 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50';
    }
    
    setTimeout(() => {
      toast.className = 'fixed bottom-5 right-5 transform translate-y-20 opacity-0 transition-all duration-300 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50';
    }, 3000);
  }

  // Fetch Saved Searches
  async function fetchSavedSearches() {
    try {
      const res = await fetch('/api/saved-searches');
      if (!res.ok) throw new Error('Failed to fetch saved searches');
      savedSearches = await res.json();
      renderSavedSearches();
    } catch (err) {
      console.error(err);
      showToast('Error loading saved searches', 'error');
    }
  }

  // Fetch Ingest Catalog
  async function fetchCatalog() {
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) throw new Error('Failed to fetch catalog');
      catalogItems = await res.json();
      renderCatalog();
    } catch (err) {
      console.error(err);
      showToast('Error loading catalog', 'error');
    }
  }

  // Render Saved Searches
  function renderSavedSearches() {
    if (savedSearches.length === 0) {
      searchesList.innerHTML = `
        <div class="text-center py-12 text-slate-400">
          <svg class="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <p class="text-sm font-medium">No saved searches yet</p>
          <p class="text-xs text-slate-400 mt-1">Create one using the form on the left.</p>
        </div>
      `;
      return;
    }

    searchesList.innerHTML = savedSearches.map(search => {
      const isChecked = search.match_count !== null;
      
      // Build filters display
      const criteria = [];
      criteria.push(`Query: <strong class="text-slate-900">"${search.q || '*'}"</strong>`);
      if (search.category) {
        criteria.push(`Category: <strong class="text-slate-900">"${search.category}"</strong>`);
      }
      if (search.max_price !== null) {
        criteria.push(`Max Price: <strong class="text-slate-900">$${search.max_price}</strong>`);
      }

      // Badge for new matches
      let badgeHtml = '';
      if (isChecked) {
        if (search.new_count > 0) {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm animate-pulse">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              +${search.new_count} new
            </span>
          `;
        } else {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              0 new
            </span>
          `;
        }
      } else {
        badgeHtml = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Unchecked
          </span>
        `;
      }

      return `
        <div class="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="space-y-1.5">
            <div class="flex items-center gap-3 flex-wrap">
              <h3 class="font-bold text-slate-900 text-base">${search.name}</h3>
              ${badgeHtml}
            </div>
            <div class="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              ${criteria.join(' <span class="text-slate-300">|</span> ')}
            </div>
          </div>

          <div class="flex items-center gap-3 shrink-0 self-end sm:self-center">
            <div class="text-right sm:text-right flex flex-col justify-center">
              <span class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Matches</span>
              <span class="text-lg font-extrabold text-slate-900">
                ${isChecked ? search.match_count : '—'}
              </span>
            </div>
            <button data-id="${search.id}" class="check-single-btn inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors shadow-sm" title="Check matches">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to single check buttons
    document.querySelectorAll('.check-single-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        await checkSingleSearch(id);
      });
    });
  }

  // Render Catalog Items
  function renderCatalog() {
    if (catalogItems.length === 0) {
      catalogList.innerHTML = '<div class="text-center py-4 text-slate-400 text-sm">No items in catalog</div>';
      return;
    }

    catalogList.innerHTML = catalogItems.map(item => {
      const isIngested = ingestedIds.has(item.id);
      return `
        <div class="p-3 rounded-lg border ${isIngested ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'} transition-colors flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h4 class="font-semibold text-slate-900 text-sm truncate" title="${item.name}">${item.name}</h4>
            <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span class="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">${item.category}</span>
              <span class="font-semibold text-slate-700">$${item.price}</span>
            </div>
          </div>
          
          <button data-id="${item.id}" ${isIngested ? 'disabled' : ''} 
            class="ingest-single-btn shrink-0 text-xs font-semibold py-1.5 px-3 rounded-md border transition-colors shadow-sm
              ${isIngested 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default' 
                : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-300'}">
            ${isIngested ? '✓ Ingested' : 'Ingest'}
          </button>
        </div>
      `;
    }).join('');

    // Attach event listeners to ingest buttons
    document.querySelectorAll('.ingest-single-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.getAttribute('data-id');
        const item = catalogItems.find(i => i.id === id);
        if (item) {
          await ingestDocuments([item]);
        }
      });
    });
  }

  // Create Saved Search
  saveSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = searchNameInput.value.trim();
    const q = searchQInput.value.trim();
    const category = searchCategoryInput.value.trim();
    const maxPriceVal = searchMaxPriceInput.value.trim();
    const max_price = maxPriceVal === '' ? null : parseFloat(maxPriceVal);

    if (!name) return;

    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, q, category, max_price })
      });

      if (!res.ok) throw new Error('Failed to create saved search');
      
      const newSearch = await res.json();
      savedSearches.push(newSearch);
      
      // Clear form
      saveSearchForm.reset();
      
      renderSavedSearches();
      showToast(`Saved search "${name}" created!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to save search', 'error');
    }
  });

  // Check Single Saved Search
  async function checkSingleSearch(id) {
    try {
      const res = await fetch(`/api/saved-searches/${id}/check`, {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to check saved search');
      
      const updatedSearch = await res.json();
      const index = savedSearches.findIndex(s => s.id === id);
      if (index !== -1) {
        savedSearches[index] = updatedSearch;
        renderSavedSearches();
        showToast(`Checked "${updatedSearch.name}": ${updatedSearch.match_count} matches (${updatedSearch.new_count} new)`);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to check search', 'error');
    }
  }

  // Check All Saved Searches
  checkAllBtn.addEventListener('click', async () => {
    if (savedSearches.length === 0) {
      showToast('No saved searches to check', 'error');
      return;
    }
    
    checkAllBtn.disabled = true;
    checkAllBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Checking...
    `;

    try {
      const res = await fetch('/api/check-all', {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to check all searches');
      
      savedSearches = await res.json();
      renderSavedSearches();
      showToast('All saved searches checked successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to check all searches', 'error');
    } finally {
      checkAllBtn.disabled = false;
      checkAllBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H16"></path>
        </svg>
        Check All Searches
      `;
    }
  });

  // Ingest Documents
  async function ingestDocuments(documents) {
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents })
      });

      if (!res.ok) throw new Error('Failed to ingest documents');
      
      const data = await res.json();
      
      // Update local state of ingested IDs
      documents.forEach(doc => ingestedIds.add(doc.id));
      renderCatalog();
      
      showToast(`Successfully ingested ${data.ingested} product(s)!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to ingest documents', 'error');
    }
  }

  // Ingest All Catalog Items
  ingestAllBtn.addEventListener('click', async () => {
    const uningested = catalogItems.filter(item => !ingestedIds.has(item.id));
    if (uningested.length === 0) {
      showToast('All catalog items are already ingested', 'error');
      return;
    }
    await ingestDocuments(uningested);
  });

  // Initialize
  fetchSavedSearches();
  fetchCatalog();
});
