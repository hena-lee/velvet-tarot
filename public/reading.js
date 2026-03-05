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

// Background AI fetch state
let readingPromise = null;
let readingData = null;
let readingError = false;

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

// --- Spread position calculators ---
function getSpreadPositions(type, cardW, cardH) {
  const gap = 16;

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

    return [
      { left: col2, top: crossMid },
      { left: col2 + 10, top: crossMid + 10 },
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

function getSpreadAreaSize(type, cardW, cardH) {
  const gap = 16;

  if (type === 'single') {
    return { width: cardW, height: cardH };
  }

  if (type === 'threeCard') {
    return { width: cardW * 3 + gap * 2, height: cardH };
  }

  if (type === 'celticCross') {
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
  return new Promise(resolve => {
    cardsEl.innerHTML = '';
    cardsEl.className = 'shuffle-stage';

    // Show hands
    shuffleScene.classList.add('is-shuffling');

    const numCards = 26;
    const cards = [];

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

    // One shuffle pass: scatter outward, then collect back into stack
    function shufflePass() {
      return new Promise(done => {
        const stagger = 5;
        const scatterDur = 300;

        cards.forEach((card, i) => {
          const z = i / 4;
          const delay = i * stagger;
          const direction = Math.round(Math.random()) ? 1 : -1;
          const distance = (Math.random() * 60 + 60); // 60-120px spread

          // Phase 1 — Scatter: wide horizontal spread
          setTimeout(() => {
            card.style.transform = `translate(${direction * distance}px, ${-z}px)`;
          }, delay);

          // Phase 2 — Collect: back to neat diagonal stack
          setTimeout(() => {
            card.style.zIndex = i;
            card.style.transform = `translate(${-z}px, ${-z}px)`;
          }, scatterDur + delay);
        });

        const totalTime = scatterDur + numCards * stagger + 300;
        setTimeout(done, totalTime);
      });
    }

    // Run multiple shuffle passes for a satisfying shuffle
    async function runShuffles() {
      for (let i = 0; i < 4; i++) {
        await shufflePass();
      }

      shuffleScene.classList.remove('is-shuffling');
      cardsEl.innerHTML = '';
      cardsEl.className = '';
      resolve();
    }

    // Brief delay so stacked deck is visible first
    setTimeout(runShuffles, 300);
  });
}

function fanOutCards() {
  cardsEl.className = 'fan-stage';
  cardsEl.innerHTML = '';

  const displayCount = shuffledDeck.length;
  const totalWidth = Math.min(window.innerWidth - 80, 900);
  const cardSpacing = totalWidth / displayCount;
  const startX = -totalWidth / 2;

  for (let i = 0; i < displayCount; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fan-card-wrapper';

    const xPos = startX + (i * cardSpacing);
    const normalizedPos = (i / (displayCount - 1)) * 2 - 1;
    const yOffset = normalizedPos * normalizedPos * 15;
    const angle = normalizedPos * 3;
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
}

let selectionLocked = false;

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
    // Fade out the entire fan (picked + unpicked)
    cardsEl.style.transition = 'opacity 0.6s ease';
    cardsEl.style.opacity = '0';
    setTimeout(() => startRevealSequence(), 700);
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

  // Clear the fog
  const cloudFrame = document.querySelector('.cloud-frame');
  if (cloudFrame) cloudFrame.classList.add('clearing');

  const cardW = 100;
  const cardH = 150;

  const positions = getSpreadPositions(spreadType, cardW, cardH);
  const areaSize = getSpreadAreaSize(spreadType, cardW, cardH);

  spreadArea.style.width = areaSize.width + 'px';
  spreadArea.style.height = areaSize.height + 'px';
  spreadArea.innerHTML = '';
  spreadArea.classList.add('active');

  // For single/three-card: center the spread area vertically
  if (isCentered) {
    const topOffset = Math.max(0, (window.innerHeight - cardH) / 2 - 250);
    spreadArea.style.marginTop = topOffset + 'px';
  }

  const spreadCards = [];
  for (let i = 0; i < selectedCards.length; i++) {
    const card = selectedCards[i];
    const pos = positions[i];
    const orientation = card.isReversed ? 'reversed' : 'upright';

    const el = document.createElement('div');
    el.className = 'spread-card' + (card.isReversed ? ' reversed' : '');
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
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

  await delay(500);

  for (let i = 0; i < spreadCards.length; i++) {
    spreadCards[i].style.transition = 'opacity 0.5s ease';
    spreadCards[i].style.opacity = '1';
    await delay(300);
  }

  await delay(500);

  for (let i = 0; i < spreadCards.length; i++) {
    spreadCards[i].classList.add('flipped');
    await delay(600);
  }

  await delay(400);

  if (!isCentered) {
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
  }

  // Phase 1: Fade out spread, show card list for exploration
  startBackgroundFetch();

  // Brief pause to admire the spread
  await delay(1500);

  // Animate spread away and show card list
  if (isCentered) {
    // Scale down and fade out the spread
    spreadArea.style.transition = 'transform 0.7s ease, opacity 0.7s ease';
    spreadArea.style.transform = 'scale(0.8)';
    spreadArea.style.opacity = '0';
    await delay(700);
    spreadArea.style.display = 'none';
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
    buildCardList();
  } else {
    // Celtic cross: simple fade out
    spreadArea.style.transition = 'opacity 0.6s ease';
    spreadArea.style.opacity = '0';
    await delay(600);
    spreadArea.style.display = 'none';
    buildCardList();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Show reveal button after exploration time
  await delay(2500);
  showRevealButton();
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

function buildCardList() {
  const listEl = document.createElement('div');
  listEl.className = 'card-list';
  listEl.id = 'card-list';

  function renderRows(cards, indices) {
    indices.forEach(i => {
      const card = cards[i];
      const orientation = card.isReversed ? 'reversed' : 'upright';
      const keywords = card.keywords[orientation].join(', ');
      const reversedClass = card.isReversed ? ' card-list-img-reversed' : '';

      const row = document.createElement('div');
      row.className = 'card-list-row';
      row.innerHTML = `
        <div class="card-list-img${reversedClass}">
          <img src="/${card.image}" alt="${card.name}" />
        </div>
        <div class="card-list-info">
          <span class="card-list-position">${positionLabels[spreadType][i]}</span>
          <span class="card-list-name">${card.name}</span>
          <span class="card-list-orient">${orientation}</span>
          <span class="card-list-keywords">${keywords}</span>
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  if (spreadType === 'celticCross') {
    const crossHeading = document.createElement('h3');
    crossHeading.className = 'card-list-heading';
    crossHeading.textContent = 'The Cross';
    listEl.appendChild(crossHeading);
    renderRows(selectedCards, [0, 1, 2, 3, 4, 5]);

    const staffHeading = document.createElement('h3');
    staffHeading.className = 'card-list-heading';
    staffHeading.textContent = 'The Staff';
    listEl.appendChild(staffHeading);
    renderRows(selectedCards, [6, 7, 8, 9]);
  } else {
    renderRows(selectedCards, selectedCards.map((_, i) => i));
  }

  // Insert after spread area
  listEl.style.opacity = '0';
  spreadArea.after(listEl);
  requestAnimationFrame(() => {
    listEl.style.transition = 'opacity 0.6s ease';
    listEl.style.opacity = '1';
  });
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
    .then(data => {
      readingData = data;
      // Add pulse to button if it exists and reading is ready
      const btn = document.querySelector('.reveal-reading-btn');
      if (btn) btn.classList.add('ready');
    })
    .catch(() => {
      readingError = true;
    });
}

function showRevealButton() {
  const btn = document.createElement('button');
  btn.className = 'reveal-reading-btn';
  btn.innerHTML = 'Reveal Your Reading';
  btn.style.opacity = '0';

  // If reading already arrived, mark as ready
  if (readingData || readingError) btn.classList.add('ready');

  btn.addEventListener('click', () => handleReveal());

  const cardList = document.getElementById('card-list');
  (cardList || spreadArea).after(btn);

  requestAnimationFrame(() => {
    btn.style.transition = 'opacity 0.8s ease';
    btn.style.opacity = '1';
  });
}

async function handleReveal() {
  const btn = document.querySelector('.reveal-reading-btn');
  if (btn) {
    btn.style.transition = 'opacity 0.4s ease';
    btn.style.opacity = '0';
    await delay(400);
    btn.remove();
  }

  // Collapse the card list
  const cardList = document.getElementById('card-list');
  if (cardList) {
    cardList.classList.add('collapsed');
  }

  document.querySelector('.reading-stage')?.classList.add('results-visible');

  await delay(600);

  if (readingData) {
    showReading(readingData.reading);
  } else if (readingError) {
    showReading('Something went wrong generating the reading.');
  } else {
    // Still loading — show loader and wait
    readingEl.innerHTML = `
      <div class="reading-loader">
        <span class="loader-symbol">&#9790;</span>
        <span class="loader-symbol">&#10022;</span>
        <span class="loader-symbol">&#9790;</span>
      </div>
    `;
    await readingPromise;
    if (readingData) {
      showReading(readingData.reading);
    } else {
      showReading('Something went wrong generating the reading.');
    }
  }
}

function showReading(text) {
  const heading = document.createElement('h1');
  heading.className = 'reading-title';
  heading.textContent = 'What the Cards Reveal';
  readingEl.before(heading);

  readingEl.textContent = text;
  const navLink = document.querySelector('.nav-new-reading');
  if (navLink) navLink.style.display = '';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
