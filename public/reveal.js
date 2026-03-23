// Reading results page — loads saved reading data from sessionStorage

const readingEl = document.getElementById('reading');

const positionLabels = {
  single: ['The Card'],
  threeCard: ['Past', 'Present', 'Future'],
  celticCross: [
    'Present', 'Challenge', 'Foundation', 'Recent Past', 'Crown',
    'Near Future', 'Self', 'Environment', 'Hopes and Fears', 'Outcome'
  ]
};

function showReading(data, selectedCards, spreadType, savedReadingId) {
  const structured = data && typeof data === 'object' && Array.isArray(data.sections);
  const sections = structured ? data.sections : [];
  const summary = structured ? (data.summary || '') : (typeof data === 'string' ? data : '');
  const labels = positionLabels[spreadType] || [];

  readingEl.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'reading-results-grid';

  // ── Left column: heading + per-card sections ──
  const leftCol = document.createElement('div');
  leftCol.className = spreadType === 'celticCross'
    ? 'reading-col-left rcs-grid'
    : 'reading-col-left';

  const heading = document.createElement('h1');
  heading.className = 'reading-title';
  heading.textContent = 'What the Cards Reveal';
  leftCol.appendChild(heading);

  // Scrollable container for card sections
  const cardScroll = document.createElement('div');
  cardScroll.className = 'reading-card-scroll';

  selectedCards.forEach((card, i) => {
    const section = document.createElement('div');
    section.className = 'reading-card-section';

    const orient = card.isReversed ? 'Reversed' : 'Upright';
    const orientGlyph = card.isReversed ? '↓' : '↑';
    const sectionText = sections[i] ? sections[i].text : '';

    section.innerHTML = `
      <div class="rcs-img-wrap${card.isReversed ? ' reversed' : ''}">
        <img src="/${card.image}" alt="${card.name}" />
      </div>
      <div class="rcs-content">
        <span class="rcs-position">${labels[i] || ''}</span>
        <span class="rcs-name">${card.name} <span class="rcs-orient">${orientGlyph} ${orient}</span></span>
        <p class="rcs-text">${sectionText}</p>
      </div>
    `;
    cardScroll.appendChild(section);
  });

  leftCol.appendChild(cardScroll);

  // ── Right column: summary + notes (hidden until envelope is opened) ──
  const rightCol = document.createElement('div');
  rightCol.className = 'reading-col-right';

  const summaryHeading = document.createElement('h2');
  summaryHeading.className = 'reading-summary-heading';
  summaryHeading.textContent = 'The Complete Reading';
  rightCol.appendChild(summaryHeading);

  const summaryText = document.createElement('div');
  summaryText.className = 'reading-summary-text';
  if (summary) {
    summaryText.textContent = summary;
  } else {
    summaryText.innerHTML = '<span class="inline-loader">· · ·</span>';
    setTimeout(() => {
      if (summaryText.querySelector('.inline-loader')) {
        summaryText.innerHTML = '';
        summaryText.textContent = 'The cards hold their counsel. Sit with each position above and let their meaning unfold in stillness.';
      }
    }, 6000);
  }
  rightCol.appendChild(summaryText);

  const notesWrap = document.createElement('div');
  notesWrap.className = 'reading-notes-wrap';
  notesWrap.innerHTML = `
    <label class="reading-notes-label">Your Notes <span class="notes-save-status"></span></label>
    <textarea class="reading-notes" placeholder="Write your reflections here…" rows="5"></textarea>
    <p class="notes-hint">Notes are saved locally — revisit them in <a href="/history.html">Past Readings</a>.</p>
  `;
  rightCol.appendChild(notesWrap);

  const againLink = document.createElement('a');
  againLink.href = '/?new';
  againLink.className = 'reading-begin-again';
  againLink.textContent = 'begin again →';
  rightCol.appendChild(againLink);

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  readingEl.appendChild(grid);

  // Notes auto-save
  const notesArea = notesWrap.querySelector('.reading-notes');
  const saveStatus = notesWrap.querySelector('.notes-save-status');

  function showSaveStatus(msg) {
    saveStatus.textContent = msg;
    saveStatus.classList.add('visible');
  }
  function hideSaveStatus() {
    saveStatus.classList.remove('visible');
  }

  notesArea.addEventListener('blur', async () => {
    const notes = notesArea.value.trim() || null;
    if (!savedReadingId) return;
    showSaveStatus('Saving…');
    try {
      const cfg = await fetch('/api/config').then(r => r.json()).catch(() => ({ serverStorage: false }));
      if (!cfg.serverStorage && window.historyDB) {
        await window.historyDB.updateNotes(savedReadingId, notes);
      } else {
        await fetch(`/api/history/${savedReadingId}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        });
      }
      showSaveStatus('Saved');
      setTimeout(hideSaveStatus, 1800);
    } catch (_) {
      showSaveStatus('Not saved');
      setTimeout(hideSaveStatus, 2500);
    }
  });

  // ── Pink envelope — floats fixed on right, reveals reading on click ──
  const envelope = document.createElement('div');
  envelope.className = 'reading-envelope';
  envelope.setAttribute('role', 'button');
  envelope.setAttribute('aria-label', 'Open your reading');
  envelope.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <polyline points="2,4 12,13 22,4"/>
    </svg>
    <span class="reading-envelope-label">your<br>reading</span>
  `;
  document.body.appendChild(envelope);

  setTimeout(() => envelope.classList.add('visible'), 1400);

  envelope.addEventListener('click', () => {
    envelope.classList.remove('visible');
    setTimeout(() => envelope.remove(), 900);
    grid.classList.add('letter-open');
    if (window.innerWidth <= 820) {
      setTimeout(() => rightCol.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
    }
  });
}

// --- Load and display on page load ---
window.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('velvet_reading');
  if (!raw) {
    // No reading data — go back to the start
    window.location.href = '/ask.html';
    return;
  }

  try {
    const state = JSON.parse(raw);
    showReading(
      state.reading,
      state.selectedCards,
      state.spreadType,
      state.savedReadingId
    );
  } catch (_) {
    window.location.href = '/ask.html';
  }
});
