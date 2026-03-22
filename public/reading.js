// Read question and spread type from URL params
const urlParams = new URLSearchParams(window.location.search);
const question = urlParams.get('question') || '';
const spreadType = urlParams.get('spread') || 'threeCard';

const cardsEl = document.getElementById('cards');
const spreadArea = document.getElementById('spread-area');
const readingEl = document.getElementById('reading');
const statusEl = document.getElementById('reading-status');
const shuffleScene = document.getElementById('shuffle-scene');

let shuffledDeck = [];
let selectedCards = [];
let pickedWrappers = [];
let currentView = null; // 'shuffle' | 'fan' | 'spread' | 'reading'

// Background AI fetch state
let readingPromise = null;
let readingData = null;
let readingError = false;
let savedReadingId = null; // id of the saved reading (server or IndexedDB)

const spreadCardCounts = {
  single: 1,
  threeCard: 3,
  celticCross: 10
};

const positionLabels = {
  single: ['The Card'],
  threeCard: ['Past', 'Present', 'Future'],
  celticCross: [
    'Present', 'Challenge', 'Foundation', 'Recent Past', 'Crown',
    'Near Future', 'Self', 'Environment', 'Hopes and Fears', 'Outcome'
  ]
};

const cardCount = spreadCardCounts[spreadType] || 3;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// --- Responsive card sizing ---
function getResponsiveCardSize() {
  const vw = window.innerWidth;

  if (spreadType === 'celticCross') {
    // Need 4 columns + gaps. On small screens, switch to 2-column mobile layout.
    const padding = 32;
    const gap = Math.max(8, Math.floor(vw * 0.02));
    // Traditional layout: 4 cols of cards + 4 gaps
    const maxCardW = Math.floor((vw - padding - gap * 4) / 4);
    const cardW = Math.min(100, Math.max(50, maxCardW));
    return { cardW, cardH: cardW * 1.5, gap, useMobileLayout: cardW < 65 };
  }

  if (spreadType === 'threeCard') {
    const padding = 32;
    const gap = 16;
    const maxCardW = Math.floor((vw - padding - gap * 2) / 3);
    const cardW = Math.min(100, Math.max(50, maxCardW));
    return { cardW, cardH: cardW * 1.5, gap, useMobileLayout: false };
  }

  // Single card
  const cardW = Math.min(100, vw - 40);
  return { cardW, cardH: cardW * 1.5, gap: 16, useMobileLayout: false };
}

// --- Spread position calculators ---
function getSpreadPositions(type, cardW, cardH, gap, useMobileLayout) {
  if (type === 'single') {
    return [{ left: 0, top: 0 }];
  }

  if (type === 'threeCard') {
    return [
      { left: 0, top: 0 },
      { left: cardW + gap, top: 0 },
      { left: (cardW + gap) * 2, top: 0 }
    ];
  }

  if (type === 'celticCross') {
    // Stacked 2-column layout for small screens
    if (useMobileLayout) {
      const col1 = 0;
      const col2 = cardW + gap * 2;
      const offset = Math.round(cardW * 0.1);
      return [
        { left: col1, top: 0 },
        { left: col1 + offset, top: offset },
        { left: col1, top: (cardH + gap) },
        { left: col1, top: (cardH + gap) * 2 },
        { left: col1, top: (cardH + gap) * 3 },
        { left: col1, top: (cardH + gap) * 4 },
        { left: col2, top: 0 },
        { left: col2, top: (cardH + gap) },
        { left: col2, top: (cardH + gap) * 2 },
        { left: col2, top: (cardH + gap) * 3 }
      ];
    }

    // Traditional cross + staff layout
    const col1 = 0;
    const col2 = cardW + gap;
    const col3 = (cardW + gap) * 2;
    const colRight = (cardW + gap) * 3 + gap * 2;

    const crossTop = cardH + gap;
    const crossMid = (cardH + gap) * 2;
    const crossBot = (cardH + gap) * 3;

    const rightRow4 = crossBot;
    const rightRow3 = crossBot - (cardH + gap);
    const rightRow2 = crossBot - (cardH + gap) * 2;
    const rightRow1 = crossBot - (cardH + gap) * 3;

    const offset = Math.round(cardW * 0.1);
    return [
      { left: col2, top: crossMid },
      { left: col2 + offset, top: crossMid + offset },
      { left: col1, top: crossMid },
      { left: col2, top: crossBot },
      { left: col2, top: crossTop },
      { left: col3, top: crossMid },
      { left: colRight, top: rightRow4 },
      { left: colRight, top: rightRow3 },
      { left: colRight, top: rightRow2 },
      { left: colRight, top: rightRow1 }
    ];
  }

  return [];
}

function getSpreadAreaSize(type, cardW, cardH, gap, useMobileLayout) {
  if (type === 'single') {
    return { width: cardW, height: cardH };
  }

  if (type === 'threeCard') {
    return { width: cardW * 3 + gap * 2, height: cardH };
  }

  if (type === 'celticCross') {
    if (useMobileLayout) {
      const col2 = cardW + gap * 2;
      return {
        width: col2 + cardW,
        height: (cardH + gap) * 5
      };
    }
    const colRight = (cardW + gap) * 3 + gap * 2;
    return {
      width: colRight + cardW,
      height: (cardH + gap) * 4
    };
  }

  return { width: 0, height: 0 };
}

// --- Shuffle animation (deck-of-cards scatter/collect style) ---
function showShuffleAnimation() {
  currentView = 'shuffle';
  return new Promise(resolve => {
    cardsEl.innerHTML = '';
    cardsEl.className = 'shuffle-stage';

    // Show hands
    shuffleScene.classList.add('is-shuffling');

    const numCards = 26;
    const cards = [];
    let aborted = false;

    // Create stacked deck — each card offset slightly for depth
    for (let i = 0; i < numCards; i++) {
      const card = document.createElement('div');
      card.className = 'card-back shuffle-card';
      const z = i / 4;
      card.style.transform = `translate(${-z}px, ${-z}px)`;
      card.style.zIndex = i;
      cardsEl.appendChild(card);
      cards.push(card);
    }

    // Show skip button after a short delay
    const skipShuffleBtn = document.createElement('button');
    skipShuffleBtn.className = 'skip-shuffle-btn';
    skipShuffleBtn.textContent = 'skip shuffle →';
    shuffleScene.insertAdjacentElement('afterend', skipShuffleBtn);
    setTimeout(() => skipShuffleBtn.classList.add('visible'), 1200);

    function finish() {
      aborted = true;
      skipShuffleBtn.remove();
      shuffleScene.classList.remove('is-shuffling');
      cardsEl.innerHTML = '';
      cardsEl.className = '';
      resolve();
    }

    skipShuffleBtn.addEventListener('click', finish);

    // One shuffle pass: scatter outward, then collect back into stack
    function shufflePass() {
      return new Promise(done => {
        if (aborted) { done(); return; }
        const stagger = 5;
        const scatterDur = 300;

        cards.forEach((card, i) => {
          const z = i / 4;
          const delay = i * stagger;
          const direction = Math.round(Math.random()) ? 1 : -1;
          const vw = window.innerWidth;
          const maxScatter = Math.min(120, vw * 0.25);
          const minScatter = maxScatter * 0.5;
          const distance = Math.random() * (maxScatter - minScatter) + minScatter;

          setTimeout(() => {
            if (!aborted) card.style.transform = `translate(${direction * distance}px, ${-z}px)`;
          }, delay);

          setTimeout(() => {
            if (!aborted) {
              card.style.zIndex = i;
              card.style.transform = `translate(${-z}px, ${-z}px)`;
            }
          }, scatterDur + delay);
        });

        const totalTime = scatterDur + numCards * stagger + 300;
        setTimeout(done, totalTime);
      });
    }

    // Run multiple shuffle passes for a satisfying shuffle
    async function runShuffles() {
      for (let i = 0; i < 4; i++) {
        if (aborted) return;
        await shufflePass();
      }
      if (!aborted) finish();
    }

    // Brief delay so stacked deck is visible first
    setTimeout(runShuffles, 300);
  });
}

function fanOutCards() {
  currentView = 'fan';
  cardsEl.className = 'fan-stage';
  cardsEl.innerHTML = '';

  const displayCount = shuffledDeck.length;
  const vw = window.innerWidth;
  const totalWidth = Math.min(vw - 40, 900);
  const cardSpacing = totalWidth / displayCount;
  const startX = -totalWidth / 2;

  // Scale arc and angle for viewport
  const arcIntensity = Math.min(15, vw * 0.025);
  const maxAngle = Math.min(3, vw * 0.005);

  for (let i = 0; i < displayCount; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fan-card-wrapper';

    const xPos = startX + (i * cardSpacing);
    const normalizedPos = (i / (displayCount - 1)) * 2 - 1;
    const yOffset = normalizedPos * normalizedPos * arcIntensity;
    const angle = normalizedPos * maxAngle;
    wrapper.style.transform = `translateX(${xPos}px) translateY(${yOffset}px) rotate(${angle}deg)`;
    wrapper.style.zIndex = i;

    const card = document.createElement('div');
    card.className = 'card-back fan-card';
    card.dataset.deckIndex = i;

    card.addEventListener('click', () => handleCardTap(i, wrapper));
    wrapper.appendChild(card);
    cardsEl.appendChild(wrapper);
  }

  // Stagger appearance
  const wrappers = cardsEl.querySelectorAll('.fan-card-wrapper');
  wrappers.forEach((w, i) => {
    w.style.opacity = '0';
    setTimeout(() => {
      w.style.opacity = '1';
    }, i * 25);
  });

  // Auto-draw button — appears after the fan finishes fading in
  const autoDrawBtn = document.createElement('button');
  autoDrawBtn.className = 'auto-draw-btn';
  autoDrawBtn.textContent = 'draw for me →';
  shuffleScene.insertAdjacentElement('afterend', autoDrawBtn);
  const fanFadeTime = displayCount * 25 + 400;
  setTimeout(() => autoDrawBtn.classList.add('visible'), fanFadeTime);
  autoDrawBtn.addEventListener('click', () => {
    if (selectionLocked) return;
    autoDrawBtn.remove();
    autoDrawCards();
  });
}

let selectionLocked = false;

function autoDrawCards() {
  if (selectionLocked) return;
  // Randomly pick the required number of cards from the fan
  const allWrappers = Array.from(cardsEl.querySelectorAll('.fan-card-wrapper'));
  // Fisher-Yates shuffle to pick without duplicates
  for (let i = allWrappers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allWrappers[i], allWrappers[j]] = [allWrappers[j], allWrappers[i]];
  }
  const chosen = allWrappers.slice(0, cardCount);
  chosen.forEach(wrapper => {
    const deckIndex = parseInt(wrapper.querySelector('.fan-card').dataset.deckIndex);
    wrapper.classList.add('picked');
    selectedCards.push(shuffledDeck[deckIndex]);
    pickedWrappers.push(wrapper);
  });
  selectionLocked = true;
  setStatus('');
  startBackgroundFetch();
  cardsEl.style.transition = 'opacity 0.5s ease';
  cardsEl.style.opacity = '0';
  setTimeout(() => startRevealSequence(), 600);
}

function handleCardTap(deckIndex, wrapper) {
  if (selectionLocked) return;

  if (wrapper.classList.contains('picked')) {
    unpickCard(deckIndex, wrapper);
    return;
  }

  if (selectedCards.length >= cardCount) return;
  pickCard(deckIndex, wrapper);
}

function pickCard(deckIndex, wrapper) {
  if (selectedCards.length >= cardCount) return;
  if (wrapper.classList.contains('picked')) return;

  wrapper.classList.add('picked');
  const card = shuffledDeck[deckIndex];
  selectedCards.push(card);
  pickedWrappers.push(wrapper);

  const remaining = cardCount - selectedCards.length;

  if (remaining > 0) {
    setStatus(`Pick ${remaining} more card${remaining > 1 ? 's' : ''}`);
  } else {
    setStatus('');
    selectionLocked = true;
    // Start AI fetch immediately while fan is fading — maximises loading time
    startBackgroundFetch();
    // Fade out the entire fan (picked + unpicked)
    cardsEl.style.transition = 'opacity 0.5s ease';
    cardsEl.style.opacity = '0';
    setTimeout(() => startRevealSequence(), 600);
  }
}

function unpickCard(deckIndex, wrapper) {
  const card = shuffledDeck[deckIndex];
  const idx = selectedCards.indexOf(card);
  if (idx === -1) return;

  wrapper.classList.remove('picked');
  selectedCards.splice(idx, 1);
  pickedWrappers.splice(pickedWrappers.indexOf(wrapper), 1);

  const remaining = cardCount - selectedCards.length;
  setStatus(`Pick ${remaining} more card${remaining > 1 ? 's' : ''}`);
}

async function startRevealSequence() {
  shuffleScene.classList.add('collapsed');

  const isCentered = spreadType === 'single' || spreadType === 'threeCard';

  if (!isCentered) {
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
  }

  currentView = 'spread';
  const { cardW, cardH, gap: spreadGap, useMobileLayout } = getResponsiveCardSize();

  const positions = getSpreadPositions(spreadType, cardW, cardH, spreadGap, useMobileLayout);
  const areaSize = getSpreadAreaSize(spreadType, cardW, cardH, spreadGap, useMobileLayout);

  spreadArea.style.width = areaSize.width + 'px';
  spreadArea.style.height = areaSize.height + 'px';
  spreadArea.innerHTML = '';
  spreadArea.classList.add('active');

  // Center the spread area in the viewport
  if (isCentered) {
    spreadArea.style.position = 'fixed';
    spreadArea.style.top = '50%';
    spreadArea.style.left = '50%';
    spreadArea.style.transform = 'translate(-50%, -50%)';
    spreadArea.style.margin = '0';
    spreadArea.style.zIndex = '10';
  }

  const spreadCards = [];
  for (let i = 0; i < selectedCards.length; i++) {
    const card = selectedCards[i];
    const pos = positions[i];

    const el = document.createElement('div');
    el.className = 'spread-card' + (card.isReversed ? ' reversed' : '');
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.width = cardW + 'px';
    el.style.height = cardH + 'px';
    el.style.opacity = '0';

    el.innerHTML = `
      <div class="spread-card-inner">
        <div class="spread-card-back card-back"></div>
        <div class="spread-card-front">
          <img src="/${card.image}" alt="${card.name}" class="spread-card-img" />
        </div>
      </div>
    `;

    spreadArea.appendChild(el);
    spreadCards.push(el);
  }

  sweepAwayFan();

  await delay(300);

  // All cards fade in simultaneously
  spreadCards.forEach(el => {
    el.style.transition = 'opacity 0.7s ease';
    el.style.opacity = '1';
  });

  await delay(1800);

  // All cards flip at once — one dramatic reveal
  spreadCards.forEach(el => el.classList.add('flipped'));

  await delay(2500);

  if (!isCentered) {
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
  }

  // Fade spread out and proceed directly to reading
  if (isCentered) {
    spreadArea.style.transition = 'transform 0.8s ease, opacity 0.8s ease';
    spreadArea.style.transform = 'translate(-50%, -50%) scale(0.92)';
    spreadArea.style.opacity = '0';
    await delay(800);
    spreadArea.style.display = 'none';
    spreadArea.style.position = '';
    spreadArea.style.top = '';
    spreadArea.style.left = '';
    spreadArea.style.transform = '';
    spreadArea.style.zIndex = '';
    spreadArea.style.margin = '';
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
  } else {
    spreadArea.style.transition = 'opacity 0.5s ease';
    spreadArea.style.opacity = '0';
    await delay(500);
    spreadArea.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Go straight to reading — no card list, no reveal button
  await handleReveal();
}

function sweepAwayFan() {
  const allWrappers = cardsEl.querySelectorAll('.fan-card-wrapper');
  const centerIndex = Math.floor(allWrappers.length / 2);

  allWrappers.forEach((w, i) => {
    if (i < centerIndex) {
      w.classList.add('sweep-left');
    } else {
      w.classList.add('sweep-right');
    }
  });

  setTimeout(() => {
    cardsEl.innerHTML = '';
    cardsEl.className = '';
  }, 800);
}

function startBackgroundFetch() {
  readingPromise = fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cards: selectedCards,
      spreadType,
      question: question || undefined
    })
  })
    .then(res => res.json())
    .then(async data => {
      readingData = data;
      // If server didn't save (Vercel), persist to IndexedDB
      if (data.savedId === null && window.historyDB) {
        try {
          const entry = {
            spreadType,
            question: question || null,
            cards: selectedCards,
            spread: data.spread,
            reading: data.reading
          };
          const saved = await window.historyDB.save(entry);
          savedReadingId = saved.id;
        } catch (_) {}
      } else {
        savedReadingId = data.savedId;
      }
    })
    .catch(() => {
      readingError = true;
    });
}


async function handleReveal() {
  document.querySelector('.reading-stage')?.classList.add('results-visible');

  if (readingData) {
    showReading(readingData.reading);
  } else if (readingError) {
    showReading('Something went wrong generating the reading.');
  } else {
    // Still loading — show a gentle loader
    readingEl.innerHTML = `
      <div class="reading-loader">
        <span class="loader-symbol">&#9790;</span>
        <span class="loader-symbol">&#10022;</span>
        <span class="loader-symbol">&#9790;</span>
      </div>
    `;
    await readingPromise;
    readingEl.innerHTML = '';
    if (readingData) {
      showReading(readingData.reading);
    } else {
      showReading('Something went wrong generating the reading.');
    }
  }
}

function showReading(data) {
  currentView = 'reading';

  // Normalise: data may be a structured object or a plain fallback string
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
    leftCol.appendChild(section);
  });

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
    // Show a pulsing inline loader — never leave this blank
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

  // Fade envelope in after card sections have had time to render
  setTimeout(() => envelope.classList.add('visible'), 1400);

  envelope.addEventListener('click', () => {
    envelope.classList.remove('visible');
    setTimeout(() => envelope.remove(), 900);
    grid.classList.add('letter-open');
    // Scroll right column into view on mobile
    if (window.innerWidth <= 820) {
      setTimeout(() => rightCol.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
    }
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Resize handler (re-layout fan on orientation change) ---
let resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    if (currentView === 'fan' && !selectionLocked) {
      fanOutCards();
    }
  }, 200);
});

// --- Auto-start on load ---
window.addEventListener('DOMContentLoaded', async () => {
  // Redirect if no valid spread param
  if (!spreadCardCounts[spreadType]) {
    window.location.href = '/';
    return;
  }

  // Fade in status text first, then shuffle scene after a delay
  [statusEl, shuffleScene].filter(Boolean).forEach(el => {
    el.style.opacity = '0';
  });

  setStatus('The veil between worlds grows thin...');

  // Status text fades in
  requestAnimationFrame(() => {
    if (statusEl) {
      statusEl.style.transition = 'opacity 0.8s ease-out';
      statusEl.style.opacity = '1';
    }
  });

  // Hands + deck fade in after status text is settled
  await delay(1000);
  if (shuffleScene) {
    shuffleScene.style.transition = 'opacity 1s ease-out';
    shuffleScene.style.opacity = '1';
  }

  try {
    const res = await fetch('/api/shuffle', { method: 'POST' });
    shuffledDeck = await res.json();

    await showShuffleAnimation();
    fanOutCards();
    setStatus(`Pick ${cardCount} card${cardCount > 1 ? 's' : ''}`);
  } catch (err) {
    setStatus('Something went wrong. Please try again.');
  }
});
