const historyEl = document.getElementById('history');
const detailEl = document.getElementById('history-detail');

let historyData = [];
const selectedIds = new Set();
let selectMode = false;

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    historyData = await res.json();
    sortHistory();
    renderList();
  } catch (err) {
    historyEl.textContent = 'Could not load history.';
  }
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function sortHistory() {
  historyData.sort((a, b) => {
    const aFav = a.favorite ? 1 : 0;
    const bFav = b.favorite ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
}

async function toggleFavorite(id) {
  try {
    const res = await fetch(`/api/history/${id}/favorite`, { method: 'PATCH' });
    const data = await res.json();
    const entry = historyData.find(e => e.id === id);
    if (entry) entry.favorite = data.favorite;
    sortHistory();
    renderList();
  } catch (err) {
    // silently fail
  }
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function enterSelectMode(initialId) {
  selectMode = true;
  if (initialId !== undefined) {
    selectedIds.add(initialId);
  }
  renderList();
}

function exitSelectMode() {
  selectMode = false;
  selectedIds.clear();
  renderList();
}

function updateToolbar() {
  const deleteBtn = document.getElementById('history-delete-btn');
  const selectAllCb = document.getElementById('history-select-all');
  if (!deleteBtn || !selectAllCb) return;

  const count = selectedIds.size;
  deleteBtn.disabled = count === 0;
  deleteBtn.textContent = count > 0 ? `Delete (${count})` : 'Delete';

  const visibleIds = historyData.map(e => e.id);
  selectAllCb.checked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
}

function renderToolbar() {
  let toolbar = document.getElementById('history-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'history-toolbar';
    toolbar.className = 'history-toolbar';
    historyEl.parentNode.insertBefore(toolbar, historyEl);
  }

  // Hidden unless in select mode with entries
  if (!selectMode || historyData.length === 0) {
    toolbar.style.display = 'none';
    return;
  }

  toolbar.style.display = '';

  toolbar.innerHTML = `
    <label class="history-select-all-label">
      <input type="checkbox" id="history-select-all" />
      Select All
    </label>
    <button class="history-toolbar-cancel">Cancel</button>
    <button id="history-delete-btn" class="history-delete-btn" disabled>Delete</button>
  `;

  toolbar.querySelector('#history-select-all').addEventListener('change', (e) => {
    const checked = e.target.checked;
    historyData.forEach(entry => {
      if (checked) {
        selectedIds.add(entry.id);
      } else {
        selectedIds.delete(entry.id);
      }
    });
    document.querySelectorAll('.history-row-checkbox').forEach(cb => {
      cb.checked = checked;
    });
    document.querySelectorAll('.history-row').forEach(row => {
      row.classList.toggle('selected', checked);
    });
    updateToolbar();
  });

  toolbar.querySelector('.history-toolbar-cancel').addEventListener('click', () => {
    exitSelectMode();
  });

  toolbar.querySelector('#history-delete-btn').addEventListener('click', () => {
    showDeleteModal();
  });
}

function renderList() {
  historyEl.innerHTML = '';
  detailEl.style.display = 'none';
  historyEl.style.display = '';

  renderToolbar();

  if (historyData.length === 0) {
    selectedIds.clear();
    selectMode = false;
    updateToolbar();
    return;
  }

  historyData.forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    if (selectMode && selectedIds.has(entry.id)) row.classList.add('selected');
    row.addEventListener('click', () => {
      if (selectMode) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      } else {
        showDetail(idx);
      }
    });

    // Checkbox — only visible in select mode (CSS handles display)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'history-row-checkbox';
    checkbox.checked = selectedIds.has(entry.id);
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedIds.add(entry.id);
        row.classList.add('selected');
      } else {
        selectedIds.delete(entry.id);
        row.classList.remove('selected');
      }
      updateToolbar();
    });

    // Heart button
    const heartBtn = document.createElement('button');
    heartBtn.className = 'history-row-heart';
    if (entry.favorite) heartBtn.classList.add('favorited');
    heartBtn.innerHTML = entry.favorite ? '&#9829;' : '&#9825;';
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(entry.id);
    });

    // X button — only visible on hover when NOT in select mode (CSS handles display)
    const xBtn = document.createElement('button');
    xBtn.className = 'history-row-x';
    xBtn.textContent = '\u00d7';
    xBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterSelectMode(entry.id);
    });

    const questionText = entry.question ? `"${truncate(entry.question, 90)}"` : 'No entry';

    const miniCards = entry.cards.map(c => {
      const rev = c.isReversed ? ' history-mini-card-reversed' : '';
      return `<img src="/${c.image}" alt="${c.name}" class="history-mini-card${rev}" />`;
    }).join('');

    const content = document.createElement('div');
    content.className = 'history-row-content';
    content.innerHTML = `
      <h3 class="history-row-question${entry.question ? '' : ' no-entry'}">${questionText}</h3>
      <div class="history-row-meta">
        <span class="history-row-date">${formatDate(entry.timestamp)}</span>
      </div>
      <div class="history-row-cards">${miniCards}</div>
    `;

    row.appendChild(checkbox);
    row.appendChild(content);
    row.appendChild(heartBtn);
    row.appendChild(xBtn);
    historyEl.appendChild(row);
  });

  // Toggle class on #history so CSS can switch between modes
  historyEl.classList.toggle('select-mode', selectMode);

  updateToolbar();
}

function showDeleteModal() {
  const count = selectedIds.size;
  if (count === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'history-modal-overlay';

  overlay.innerHTML = `
    <div class="history-modal">
      <p class="history-modal-message">Delete ${count} reading${count > 1 ? 's' : ''} forever?</p>
      <div class="history-modal-actions">
        <button class="history-modal-cancel">Cancel</button>
        <button class="history-modal-confirm">Delete</button>
      </div>
    </div>
  `;

  overlay.querySelector('.history-modal-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('.history-modal-confirm').addEventListener('click', async () => {
    const ids = Array.from(selectedIds);
    try {
      await fetch('/api/history/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      historyData = historyData.filter(e => !selectedIds.has(e.id));
      selectedIds.clear();
      selectMode = false;
      renderList();
    } catch (err) {
      // silently fail — list stays as-is
    }
    overlay.remove();
  });

  document.body.appendChild(overlay);
}

function showDetail(idx) {
  const entry = historyData[idx];
  historyEl.style.display = 'none';
  detailEl.style.display = '';

  // Hide toolbar when viewing detail
  const toolbar = document.getElementById('history-toolbar');
  if (toolbar) toolbar.style.display = 'none';

  const cardsHtml = entry.cards.map(c => {
    const orient = c.isReversed ? 'Reversed' : 'Upright';
    const reversedClass = c.isReversed ? ' detail-card-reversed' : '';
    const imgWrapOpen = c.pinterest
      ? `<a href="${c.pinterest}" target="_blank" rel="noopener noreferrer" class="detail-card-img-wrap${reversedClass}">`
      : `<div class="detail-card-img-wrap${reversedClass}">`;
    const imgWrapClose = c.pinterest ? `</a>` : `</div>`;
    return `
      <div class="detail-card">
        ${imgWrapOpen}
          <img src="/${c.image}" alt="${c.name}" />
        ${imgWrapClose}
        <span class="detail-card-name">${c.name}</span>
        <span class="detail-card-orient">${orient}</span>
      </div>
    `;
  }).join('');

  detailEl.innerHTML = `
    <a class="detail-back" href="#">&larr;</a>
    <h2 class="detail-spread">${entry.spread}</h2>
    <div class="detail-date">${formatDate(entry.timestamp)}</div>
    ${entry.question ? `<div class="detail-question">"${entry.question}"</div>` : ''}
    <div class="detail-cards">${cardsHtml}</div>
    <div class="detail-reading">${entry.reading}</div>
  `;

  detailEl.querySelector('.detail-back').addEventListener('click', (e) => {
    e.preventDefault();
    renderList();
  });
}

loadHistory();
