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
let currentView = null; // 'shuffle' | 'fan' | 'spread' | 'reading'

// Background AI fetch state
let readingPromise = null;
let readingData = null;
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

    function finish() {
      aborted = true;
      shuffleAudio.pause();
      shuffleAudio.currentTime = 0;
      shuffleScene.classList.remove('is-shuffling');
      cardsEl.innerHTML = '';
      cardsEl.className = '';
      resolve();
    }

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
          const maxScatter = Math.min(60, vw * 0.12);
          const minScatter = maxScatter * 0.4;
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
      shuffleAudio.play().catch(() => {});
      for (let i = 0; i < 4; i++) {
        if (aborted) return;
        await shufflePass();
      }
      shuffleAudio.pause();
      shuffleAudio.currentTime = 0;
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

  // Scale arc and angle for viewport — organic hand-spread curve
  const arcIntensity = Math.min(35, vw * 0.045);
  const maxAngle = Math.min(8, vw * 0.012);

  // Preload card hover sound as Web Audio buffer (lightweight playback, no lag)
  const cardHoverCtx = new (window.AudioContext || window.webkitAudioContext)();
  let cardHoverBuffer = null;
  fetch('/audio/card.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => cardHoverCtx.decodeAudioData(buf))
    .then(decoded => { cardHoverBuffer = decoded; })
    .catch(() => {});

  // Velocity-based card hover sound — only plays when cursor is moving slowly
  let lastMouseX = 0, lastMouseY = 0, lastMouseTime = 0;
  const maxSpeed = 600; // px/s — above this, sound is suppressed
  cardsEl.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    lastMouseTime = performance.now();
  });

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

    card.addEventListener('mouseenter', (e) => {
      const now = performance.now();
      const dt = (now - lastMouseTime) / 1000;
      if (dt > 0) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        if (speed > maxSpeed) return;
      }
      if (!cardHoverBuffer) return;
      if (cardHoverCtx.state === 'suspended') cardHoverCtx.resume();
      const source = cardHoverCtx.createBufferSource();
      const gain = cardHoverCtx.createGain();
      source.buffer = cardHoverBuffer;
      gain.gain.value = 0.3;
      source.connect(gain).connect(cardHoverCtx.destination);
      source.start(0);
    });
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

  // Auto-draw button — clean up any existing one first
  const existingBtn = document.querySelector('.auto-draw-btn');
  if (existingBtn) existingBtn.remove();

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
  // Pick only the remaining needed cards (skip already-picked ones)
  const remaining = cardCount - selectedCards.length;
  if (remaining <= 0) return;
  const unpicked = Array.from(cardsEl.querySelectorAll('.fan-card-wrapper:not(.picked)'));
  // Fisher-Yates shuffle to pick without duplicates
  for (let i = unpicked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unpicked[i], unpicked[j]] = [unpicked[j], unpicked[i]];
  }
  const chosen = unpicked.slice(0, remaining);
  chosen.forEach(wrapper => {
    const deckIndex = parseInt(wrapper.querySelector('.fan-card').dataset.deckIndex);
    wrapper.classList.add('picked');
    selectedCards.push(shuffledDeck[deckIndex]);
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

  const remaining = cardCount - selectedCards.length;

  if (remaining > 0) {
    setStatus(`Pick ${remaining} more card${remaining > 1 ? 's' : ''}`);
  } else {
    setStatus('');
    selectionLocked = true;
    // Fade out and remove the auto-draw button gracefully
    const btn = document.querySelector('.auto-draw-btn');
    if (btn) {
      btn.style.pointerEvents = 'none';
      btn.style.transition = 'opacity 0.4s ease';
      btn.style.opacity = '0';
      btn.addEventListener('transitionend', () => btn.remove(), { once: true });
    }
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

  const remaining = cardCount - selectedCards.length;
  setStatus(`Pick ${remaining} more card${remaining > 1 ? 's' : ''}`);
}

async function startRevealSequence() {
  // Remove draw button but keep doily visible through the card reveal
  const doily = shuffleScene.querySelector('.shuffle-doily');
  const drawBtn = document.querySelector('.auto-draw-btn');
  if (drawBtn) {
    drawBtn.style.transition = 'opacity 0.4s ease';
    drawBtn.style.opacity = '0';
  }
  // Fade out hands and cards container but keep doily + shuffle-scene visible
  const hands = shuffleScene.querySelectorAll('.shuffle-hand');
  hands.forEach(h => { h.style.transition = 'opacity 0.5s ease'; h.style.opacity = '0'; });
  cardsEl.style.transition = 'opacity 0.5s ease';
  cardsEl.style.opacity = '0';
  if (statusEl) { statusEl.style.transition = 'opacity 0.5s ease'; statusEl.style.opacity = '0'; }

  await delay(500);
  if (drawBtn) drawBtn.remove();
  // Collapse inner elements but keep shuffle-scene for the doily
  cardsEl.innerHTML = '';
  cardsEl.className = '';

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
  spreadArea.style.position = 'fixed';
  spreadArea.style.top = '50%';
  spreadArea.style.left = '50%';
  spreadArea.style.transform = 'translate(-50%, -50%)';
  spreadArea.style.margin = '0';
  spreadArea.style.zIndex = '10';

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

  // Scale timing based on spread complexity
  const timings = {
    single:     { preFlip: 800,  showCards: 1200, fadeOut: 600 },
    threeCard:  { preFlip: 1200, showCards: 1800, fadeOut: 700 },
    celticCross: { preFlip: 1800, showCards: 2500, fadeOut: 800 },
  };
  const t = timings[spreadType] || timings.threeCard;

  await delay(t.preFlip);

  // All cards flip at once — one dramatic reveal
  playRevealSound();
  spreadCards.forEach(el => el.classList.add('flipped'));

  await delay(t.showCards);

  if (!isCentered) {
    document.querySelector('.reading-stage')?.classList.add('spread-visible');
  }

  // Fade spread + doily out together, then proceed to reading
  fadeOutRevealSound(t.fadeOut);
  if (doily) {
    doily.style.transition = `opacity ${t.fadeOut}ms ease`;
    doily.style.opacity = '0';
  }

  spreadArea.style.transition = `transform ${t.fadeOut}ms ease, opacity ${t.fadeOut}ms ease`;
  spreadArea.style.transform = 'translate(-50%, -50%) scale(0.92)';
  spreadArea.style.opacity = '0';
  await delay(t.fadeOut);

  // Show loading overlay — always display at least one full animation cycle,
  // even if the API already returned, so the text is never cut off mid-sentence.
  {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'api-loading-overlay visible';

    const loadingText = 'The spirits are consulting the cards…';
    const charDelay = 0.05; // seconds per character
    let charIndex = 0;
    loadingOverlay.innerHTML = loadingText.split('').map((ch) => {
      if (ch === ' ') return `<span class="loading-char loading-space" style="animation-delay:${charIndex++ * charDelay}s">&nbsp;</span>`;
      return `<span class="loading-char" style="animation-delay:${charIndex++ * charDelay}s">${ch}</span>`;
    }).join('');
    document.body.appendChild(loadingOverlay);

    const totalChars = charIndex;
    // Time for all characters to finish fading in + a brief hold
    const fadeInDuration = (totalChars * charDelay + 0.6) * 1000;
    const holdTime = 800;
    const fadeOutDuration = 600;
    const cycleDuration = fadeInDuration + holdTime;

    // Wait for the API if it hasn't returned yet
    const apiReady = (readingData && readingData.reading)
      ? Promise.resolve()
      : (readingPromise || Promise.resolve());

    // Track whether we can navigate (API done + current cycle finished)
    let apiDone = !!(readingData && readingData.reading);

    apiReady.then(() => { apiDone = true; });

    // Run animation cycles until both: API is done AND current cycle completes
    await new Promise(resolve => {
      function runCycle() {
        const chars = loadingOverlay.querySelectorAll('.loading-char');
        // Reset and restart staggered fade-in
        chars.forEach(c => {
          c.style.transition = 'none';
          c.style.animation = 'none';
          c.offsetHeight; // force reflow
          c.style.opacity = '';
          c.style.animation = '';
        });

        // At end of this cycle, check if we can exit
        setTimeout(() => {
          if (apiDone) {
            // Fade all characters out, then resolve
            chars.forEach(c => { c.style.transition = `opacity ${fadeOutDuration / 1000}s ease`; c.style.opacity = '0'; });
            setTimeout(resolve, fadeOutDuration);
          } else {
            // Fade out, then start next cycle
            chars.forEach(c => { c.style.transition = `opacity ${fadeOutDuration / 1000}s ease`; c.style.opacity = '0'; });
            setTimeout(runCycle, fadeOutDuration + 100);
          }
        }, cycleDuration);
      }

      // First cycle is already animating from the CSS animation-delay,
      // so just wait for it to complete before checking
      setTimeout(() => {
        if (apiDone) {
          // First cycle done and API ready — fade out and go
          const chars = loadingOverlay.querySelectorAll('.loading-char');
          chars.forEach(c => { c.style.transition = `opacity ${fadeOutDuration / 1000}s ease`; c.style.opacity = '0'; });
          setTimeout(resolve, fadeOutDuration);
        } else {
          // Need more cycles — fade out first cycle, then loop
          const chars = loadingOverlay.querySelectorAll('.loading-char');
          chars.forEach(c => { c.style.transition = `opacity ${fadeOutDuration / 1000}s ease`; c.style.opacity = '0'; });
          setTimeout(runCycle, fadeOutDuration + 100);
        }
      }, cycleDuration);
    });

    // Brief pause before navigating
    await delay(300);
    loadingOverlay.classList.remove('visible');
    await delay(500);
    loadingOverlay.remove();
  }

  // Extract reading — readingData is the full API response: { cards, spread, reading, savedId }
  const reading = (readingData && readingData.reading) || null;
  const payload = {
    selectedCards,
    spreadType,
    savedReadingId,
    question: question || null,
    reading
  };

  sessionStorage.setItem('velvet_reading', JSON.stringify(payload));

  // Remove the beforeunload guard so navigation isn't blocked by a popup
  window._readingInProgress = false;
  window.removeEventListener('beforeunload', preventUnload);

  // Page-fade-out matching reading.html entry-cover — navigate on transitionend (same pattern as ask→reveal)
  const fadeOut = document.createElement('div');
  fadeOut.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;opacity:0;pointer-events:none;transition:opacity 0.8s ease;';
  document.body.appendChild(fadeOut);
  requestAnimationFrame(() => { fadeOut.style.opacity = '1'; });
  fadeOut.addEventListener('transitionend', () => {
    window.location.href = '/reading.html';
  }, { once: true });
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
  // Prevent accidental navigation/refresh while reading is being generated
  window._readingInProgress = true;
  window.addEventListener('beforeunload', preventUnload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  readingPromise = fetch('/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cards: selectedCards,
      spreadType,
      question: question || undefined
    }),
    signal: controller.signal
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
    .catch(() => {})
    .finally(() => {
      clearTimeout(timeout);
      window._readingInProgress = false;
      window.removeEventListener('beforeunload', preventUnload);
    });
}

function preventUnload(e) {
  if (window._readingInProgress) {
    e.preventDefault();
    e.returnValue = '';
  }
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

// --- Audio setup — preload sounds and unlock playback ---
const readingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
let revealBuffer = null;
fetch('/audio/reveal.mp3')
  .then(r => r.arrayBuffer())
  .then(buf => readingAudioCtx.decodeAudioData(buf))
  .then(decoded => { revealBuffer = decoded; })
  .catch(() => {});

let revealGainNode = null;
let revealSourceNode = null;

function playRevealSound() {
  if (!revealBuffer) return;
  if (readingAudioCtx.state === 'suspended') readingAudioCtx.resume();
  revealSourceNode = readingAudioCtx.createBufferSource();
  revealGainNode = readingAudioCtx.createGain();
  revealSourceNode.buffer = revealBuffer;
  revealGainNode.gain.value = 0.5;
  revealSourceNode.connect(revealGainNode).connect(readingAudioCtx.destination);
  revealSourceNode.start(0);
}

function fadeOutRevealSound(durationMs) {
  if (!revealGainNode || !revealSourceNode) return;
  const fadeTime = durationMs / 1000;
  revealGainNode.gain.setValueAtTime(revealGainNode.gain.value, readingAudioCtx.currentTime);
  revealGainNode.gain.linearRampToValueAtTime(0, readingAudioCtx.currentTime + fadeTime);
  setTimeout(() => {
    try { revealSourceNode.stop(); } catch (_) {}
  }, durationMs);
}

const shuffleAudio = new Audio('/audio/shuffle.mp3');
shuffleAudio.volume = 0.5;
shuffleAudio.loop = true;
shuffleAudio.preload = 'auto';

// Unlock audio: try immediately (gesture may carry from previous page),
// and also on first user interaction on this page as fallback.
function unlockAndPlay() {
  shuffleAudio.play().then(() => {
    // Pause immediately — we just needed to unlock; real play happens at shuffle time
    shuffleAudio.pause();
    shuffleAudio.currentTime = 0;
  }).catch(() => {});
  document.removeEventListener('click', unlockAndPlay);
  document.removeEventListener('touchstart', unlockAndPlay);
}
document.addEventListener('click', unlockAndPlay);
document.addEventListener('touchstart', unlockAndPlay);
// Attempt unlock right away (works in some browsers after navigation from user-gesture page)
unlockAndPlay();

// --- Auto-start on load ---
window.addEventListener('DOMContentLoaded', async () => {
  // Redirect if no valid spread param
  if (!spreadCardCounts[spreadType]) {
    window.location.href = '/';
    return;
  }

  // Intro sequence: doily visible → status text fades in → pause → hands/cards appear

  // Hide hands and cards container initially; doily and shuffle-scene stay visible
  const hands = shuffleScene.querySelectorAll('.shuffle-hand');
  hands.forEach(h => { h.style.opacity = '0'; });
  cardsEl.style.opacity = '0';
  if (statusEl) statusEl.style.opacity = '0';

  // Step 1: Status text fades in over the doily
  setStatus('The veil between worlds grows thin...');
  await delay(300);
  if (statusEl) {
    statusEl.style.transition = 'opacity 1s ease-out';
    statusEl.style.opacity = '1';
  }

  // Step 2: Hold the text for a moment
  await delay(2000);

  // Step 3: Fade in cards container, then start shuffle (hands fade via CSS .is-shuffling)
  cardsEl.style.transition = 'opacity 0.8s ease-out';
  cardsEl.style.opacity = '1';
  // Reset hand opacity so CSS .is-shuffling can control them
  hands.forEach(h => { h.style.opacity = ''; });

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
