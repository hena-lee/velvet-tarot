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
  leftCol.className = 'reading-col-left';

  // Card reveal background image — lives inside the container so it
  // scales and aligns with the heading + scroll box automatically.
  const revealBg = document.createElement('img');
  revealBg.src = '/images/assets/cardreveal.png';
  revealBg.alt = '';
  revealBg.className = 'card-reveal-bg';
  leftCol.appendChild(revealBg);

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
    let sectionText = sections[i] ? sections[i].text : '';
    // Strip redundant "Card Name (orientation) — " prefix from the AI description
    sectionText = sectionText.replace(/^.*?\)\s*[—–\-:]\s*/, '');

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

  // Scroll sound — reuse shared utility from components.js
  if (window._attachScrollSound) window._attachScrollSound(cardScroll);

  // ── Right column: two stacked boxes ──
  const rightCol = document.createElement('div');
  rightCol.className = 'reading-col-right';

  // Top box — envelope
  const topBox = document.createElement('div');
  topBox.className = 'right-box right-box-top';

  const envelope = document.createElement('div');
  envelope.className = 'envelope-sequence';
  envelope.setAttribute('role', 'button');
  envelope.setAttribute('aria-label', 'Open your reading');

  const imgSealed = document.createElement('img');
  imgSealed.src = '/images/assets/pinkenvelope.png';
  imgSealed.alt = 'Sealed envelope';
  imgSealed.className = 'envelope-img envelope-sealed';

  const imgBroken = document.createElement('img');
  imgBroken.src = '/images/assets/sealbroken.png';
  imgBroken.alt = 'Seal broken';
  imgBroken.className = 'envelope-img envelope-broken';

  const imgOpen = document.createElement('img');
  imgOpen.src = '/images/assets/openenvelope.png';
  imgOpen.alt = 'Open envelope';
  imgOpen.className = 'envelope-img envelope-open';

  envelope.appendChild(imgSealed);
  envelope.appendChild(imgBroken);
  envelope.appendChild(imgOpen);

  // Summary content — hidden inside top box, revealed after envelope opens
  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'envelope-summary-wrap';

  const summaryHeading = document.createElement('h2');
  summaryHeading.className = 'reading-summary-heading';
  summaryHeading.textContent = 'Your Reading';
  summaryWrap.appendChild(summaryHeading);

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
  summaryWrap.appendChild(summaryText);

  topBox.appendChild(envelope);
  topBox.appendChild(summaryWrap);
  rightCol.appendChild(topBox);

  // Stack container — pen overlays notes in the same space
  const penNotesStack = document.createElement('div');
  penNotesStack.className = 'pen-notes-stack';

  // Bottom box — notes (invisible until envelope opens, always in layout for sizing)
  const bottomBox = document.createElement('div');
  bottomBox.className = 'right-box right-box-bottom';
  bottomBox.style.opacity = '0';
  bottomBox.style.transition = 'opacity 1.2s ease';

  const notesWrap = document.createElement('div');
  notesWrap.className = 'reading-notes-wrap';
  notesWrap.innerHTML = `
    <label class="reading-notes-label">Your Notes</label>
    <textarea class="reading-notes" placeholder="Write your reflections here…" rows="5"></textarea>
    <div class="notes-actions-row">
      <button class="notes-seal-btn" type="button">seal your thoughts</button>
      <a href="/ask.html?skip" class="reading-begin-again">begin again →</a>
    </div>
    <p class="notes-hint">Revisit sealed notes in <a href="/history.html">Past Readings</a>.</p>
  `;
  bottomBox.appendChild(notesWrap);

  // Pen image — sits on top of notes box, fades out to reveal it
  const penImg = document.createElement('img');
  penImg.src = '/images/assets/pen.png';
  penImg.alt = '';
  penImg.className = 'right-pen-img';

  penNotesStack.appendChild(bottomBox);
  penNotesStack.appendChild(penImg);
  rightCol.appendChild(penNotesStack);

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  readingEl.appendChild(grid);

  // Notes auto-grow
  const notesArea = notesWrap.querySelector('.reading-notes');

  function autoGrow() {
    notesArea.style.height = '4em';
    notesArea.style.height = notesArea.scrollHeight + 'px';
  }
  notesArea.addEventListener('input', autoGrow);

  const sealBtn = notesWrap.querySelector('.notes-seal-btn');
  sealBtn.addEventListener('click', async () => {
    const notes = notesArea.value.trim() || null;
    if (!savedReadingId) return;
    sealBtn.disabled = true;
    sealBtn.textContent = 'sealing…';
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
      sealBtn.textContent = 'sealed ✦';
      setTimeout(() => {
        sealBtn.textContent = 'seal your thoughts';
        sealBtn.disabled = false;
      }, 2000);
    } catch (_) {
      sealBtn.textContent = 'not sealed — try again';
      sealBtn.disabled = false;
    }
  });

  // Summary hidden until envelope is opened
  summaryWrap.style.opacity = '0';
  summaryWrap.style.transition = 'opacity 1.8s ease';

  // Preload envelope sounds
  const sealAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let sealBuffer = null;
  let clickBuffer = null;
  fetch('/audio/breakseal.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => sealAudioCtx.decodeAudioData(buf))
    .then(decoded => { sealBuffer = decoded; })
    .catch(() => {});
  fetch('/audio/click.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => sealAudioCtx.decodeAudioData(buf))
    .then(decoded => { clickBuffer = decoded; })
    .catch(() => {});

  // Envelope click — animate seal break → open → reveal summary
  let envelopeOpened = false;
  envelope.addEventListener('click', () => {
    if (envelopeOpened) return;
    envelopeOpened = true;
    envelope.style.cursor = 'default';
    envelope.style.transform = '';

    if (sealAudioCtx.state === 'suspended') sealAudioCtx.resume();

    // Play click sound immediately on tap
    if (clickBuffer) {
      const src = sealAudioCtx.createBufferSource();
      const gain = sealAudioCtx.createGain();
      src.buffer = clickBuffer;
      src.playbackRate.value = 1.8;
      gain.gain.value = 0.7;
      src.connect(gain).connect(sealAudioCtx.destination);
      src.start(0);
    }

    // Play break-seal sound
    if (sealBuffer) {
      const source = sealAudioCtx.createBufferSource();
      const gain = sealAudioCtx.createGain();
      source.buffer = sealBuffer;
      gain.gain.value = 0.1;
      source.connect(gain).connect(sealAudioCtx.destination);
      source.start(0);
    }

    // Step 1: cross-fade sealed → seal broken
    imgSealed.style.opacity = '0';
    imgBroken.style.opacity = '1';

    // Step 2: after a beat, cross-fade seal broken → open
    setTimeout(() => {
      imgBroken.style.opacity = '0';
      imgOpen.style.opacity = '1';
    }, 800);

    // Step 3: fade out envelope, simultaneously fade in summary
    setTimeout(() => {
      envelope.style.transition = 'opacity 0.8s ease';
      envelope.style.opacity = '0';
      summaryWrap.style.opacity = '1';
      summaryWrap.style.pointerEvents = 'auto';

      setTimeout(() => {
        envelope.style.display = 'none';
      }, 800);

      // Step 4: after summary is visible, cross-fade pen → notes
      setTimeout(() => {
        penImg.style.transition = 'opacity 1.2s ease';
        penImg.style.opacity = '0';
        bottomBox.style.opacity = '1';

        setTimeout(() => {
          penImg.style.display = 'none';
        }, 1200);
      }, 2500);
    }, 1800);
  });

  // --- Envelope parallax tilt (stops after click) ---
  topBox.addEventListener('mousemove', (e) => {
    if (envelopeOpened) return;
    const rect = envelope.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = (e.clientX - cx) / (rect.width / 2);
    const ny = (e.clientY - cy) / (rect.height / 2);
    const maxTilt = 1.2;
    const ry = nx * maxTilt;
    const rx = -ny * maxTilt;
    envelope.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  topBox.addEventListener('mouseleave', () => {
    if (!envelopeOpened) envelope.style.transform = '';
  });
}

// --- Load and display on page load ---
window.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('velvet_reading');
  if (!raw) {
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
  } catch (err) {
    console.error('[velvet-reading] Error:', err);
    window.location.href = '/ask.html';
    return;
  }

  // --- Card reveal parallax tilt (matches readingform hover) ---
  const colLeft = document.querySelector('.reading-col-left');
  const revealImg = document.querySelector('.reading-col-left .card-reveal-bg');
  if (colLeft && revealImg) {
    const baseTransform = 'translate(-50%, -50%) scaleX(1.25)';
    colLeft.addEventListener('mousemove', (e) => {
      const rect = colLeft.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);
      const maxTilt = 1;
      const ry = nx * maxTilt;
      const rx = -ny * maxTilt;
      revealImg.style.transform = `${baseTransform} rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    colLeft.addEventListener('mouseleave', () => {
      revealImg.style.transform = baseTransform;
    });
  }
});
