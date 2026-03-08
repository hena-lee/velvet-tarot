const form = document.getElementById('reading-form');
let formSubmitted = false;

// Redirect to dedicated reading page on submit with zoom+fade transition
form.addEventListener('submit', (e) => {
  e.preventDefault();
  formSubmitted = true;
  const question = document.getElementById('question').value.trim();
  const spread = document.getElementById('spread').value;
  const params = new URLSearchParams({ spread });
  if (question) params.set('question', question);

  const section = document.querySelector('.reading-section');
  const cloudLayer = document.querySelector('.cloud-layer');
  if (section) {
    section.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
    section.style.transformOrigin = 'center center';
    section.style.transform = 'scale(1.5)';
    section.style.opacity = '0';
    if (cloudLayer) {
      cloudLayer.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
      cloudLayer.style.transformOrigin = 'center center';
      cloudLayer.style.transform = 'scale(1.5)';
      cloudLayer.style.opacity = '0';
    }
    setTimeout(() => {
      window.location.href = `/reading.html?${params}`;
    }, 600);
  } else {
    window.location.href = `/reading.html?${params}`;
  }
});

// --- Landing transition: curtain → powder room split → theater zoom (wheel-driven) ---
(function () {
  const imgWrapper = document.querySelector('.landing-image-wrapper');
  const landing = document.querySelector('.landing');
  const curtain = document.querySelector('.landing-curtain');
  const powderLeft = document.querySelector('.powder-left');
  const powderRight = document.querySelector('.powder-right');
  const homeBtn = document.querySelector('.home-btn');
  const readingForm = document.getElementById('reading-form');
  if (!imgWrapper || !landing) return;

  // Skip landing and go straight to reading form when ?new is in the URL
  if (new URLSearchParams(window.location.search).has('new')) {
    landing.style.visibility = 'hidden';
    landing.style.pointerEvents = 'none';
    if (readingForm) readingForm.style.opacity = '1';
    history.replaceState(null, '', '/');
    return;
  }

  // Show wrapper only after theater image loads to prevent flash of hidden layers
  const theaterImg = imgWrapper.querySelector('.landing-image');
  if (theaterImg) {
    if (theaterImg.complete) {
      imgWrapper.style.visibility = 'visible';
    } else {
      theaterImg.addEventListener('load', () => {
        imgWrapper.style.visibility = 'visible';
      });
    }
  }

  // phase 0 = curtain rise, phase 1 = powder room split, phase 2 = theater zoom
  let phase = 0;
  let progress = 0;   // 0–1 within current phase
  let isAnimating = false;
  let isDone = false;
  let snapTimer = null;
  const SNAP_THRESHOLD = 0.15;
  const ANIM_DURATION = 80;

  if (readingForm) readingForm.style.opacity = '0';

  function applyCurtain(p) {
    if (curtain) {
      curtain.style.transform = `translateY(${-p * 100}%)`;
    }
  }

  function applyPowderRoom(p) {
    if (powderLeft) {
      powderLeft.style.transform = `translateX(${-p * 100}%)`;
    }
    if (powderRight) {
      powderRight.style.transform = `translateX(${p * 100}%)`;
    }
  }

  function applyZoom(p) {
    const scale = 1 + p * 1.5;
    imgWrapper.style.transform = `scale(${scale})`;
    landing.style.opacity = 1 - p;
    if (readingForm) readingForm.style.opacity = Math.max(0, (p - 0.4) / 0.6);
  }

  function render() {
    if (phase === 0) {
      applyCurtain(progress);
      applyPowderRoom(0);
      applyZoom(0);
    } else if (phase === 1) {
      applyCurtain(1);
      applyPowderRoom(progress);
      applyZoom(0);
    } else {
      applyCurtain(1);
      applyPowderRoom(1);
      applyZoom(progress);
    }
  }

  function hideLanding() {
    isDone = true;
    landing.style.pointerEvents = 'none';
    landing.style.visibility = 'hidden';
  }

  function resetLanding() {
    isDone = false;
    formSubmitted = false;
    landing.style.visibility = '';
    landing.style.pointerEvents = '';
    window.scrollTo(0, 0);
    if (readingForm) readingForm.style.opacity = '0';
  }

  function animateTo(target, cb, duration) {
    isAnimating = true;
    const dur = duration || ANIM_DURATION;
    const start = progress;
    const dist = target - start;
    const t0 = performance.now();
    function step(now) {
      const elapsed = now - t0;
      const t = Math.min(elapsed / dur, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      progress = start + dist * ease;
      render();
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        progress = target;
        render();
        if (cb) cb();
        isAnimating = false;
      }
    }
    requestAnimationFrame(step);
  }

  window.addEventListener('wheel', (e) => {
    if (isAnimating) return;

    // Scroll back from the form page
    if (isDone) {
      if (!formSubmitted && e.deltaY < 0) {
        e.preventDefault();
        resetLanding();
        phase = 2;
        progress = 0.99;
        animateTo(0, () => {
          phase = 1;
          progress = 1;
          render();
        });
      }
      return;
    }

    e.preventDefault();

    const delta = e.deltaY / 800;

    // Scrolling backward past start of current phase → go to previous phase
    if (phase > 0 && progress + delta < 0) {
      phase--;
      progress = 1;
      render();
      return;
    }

    progress += delta;
    progress = Math.max(0, Math.min(1, progress));
    render();

    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      if (isAnimating || isDone) return;

      if (phase < 2 && progress >= SNAP_THRESHOLD) {
        // Snap current phase to completion, then wait for user to scroll again
        animateTo(1, () => {
          phase++;
          progress = 0;
          render();
        });
      } else if (phase === 2 && progress >= SNAP_THRESHOLD) {
        animateTo(1, hideLanding);
      } else if (progress > 0) {
        animateTo(0);
      }
    }, 50);
  }, { passive: false });

  // Click on layers to advance through phases
  const gif = document.querySelector('.landing-gif');

  const CLICK_DURATION = 500;

  function advancePhase() {
    if (isAnimating || isDone) return;
    animateTo(1, () => {
      if (phase < 2) {
        phase++;
        progress = 0;
        render();
      } else {
        hideLanding();
      }
    }, CLICK_DURATION);
  }

  if (curtain) curtain.addEventListener('click', () => {
    if (phase === 0) advancePhase();
  });

  if (powderLeft) powderLeft.addEventListener('click', () => {
    if (phase === 1) advancePhase();
  });
  if (powderRight) powderRight.addEventListener('click', () => {
    if (phase === 1) advancePhase();
  });

  if (gif) gif.addEventListener('click', () => {
    if (phase === 2) advancePhase();
  });

  // --- Touch support for mobile ---
  let touchStartY = null;
  let lastTouchY = null;
  let touchStartTime = 0;

  // Use landing element as touch target (covers viewport during animation)
  landing.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    touchStartY = e.touches[0].clientY;
    lastTouchY = touchStartY;
    touchStartTime = Date.now();
    clearTimeout(snapTimer);
  }, { passive: true });

  landing.addEventListener('touchmove', (e) => {
    if (isAnimating || touchStartY === null) return;

    const currentY = e.touches[0].clientY;

    // Scroll back from the form page
    if (isDone) {
      const totalDelta = currentY - touchStartY;
      if (!formSubmitted && totalDelta > 60) {
        e.preventDefault();
        touchStartY = null;
        resetLanding();
        phase = 2;
        progress = 0.99;
        animateTo(0, () => {
          phase = 1;
          progress = 1;
          render();
        });
      }
      return;
    }

    e.preventDefault();

    const deltaY = lastTouchY - currentY; // positive = swipe up = forward
    lastTouchY = currentY;

    // Half-screen swipe completes one phase
    const delta = deltaY / (window.innerHeight * 0.5);

    // Scrolling backward past start of current phase
    if (phase > 0 && progress + delta < 0) {
      phase--;
      progress = 1;
      render();
      return;
    }

    progress += delta;
    progress = Math.max(0, Math.min(1, progress));
    render();
  }, { passive: false });

  landing.addEventListener('touchend', () => {
    if (touchStartY === null) return;
    touchStartY = null;
    lastTouchY = null;

    if (isDone || isAnimating) return;

    // Same snap logic as wheel handler
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      if (isAnimating || isDone) return;

      if (phase < 2 && progress >= SNAP_THRESHOLD) {
        animateTo(1, () => {
          phase++;
          progress = 0;
          render();
        });
      } else if (phase === 2 && progress >= SNAP_THRESHOLD) {
        animateTo(1, hideLanding);
      } else if (progress > 0) {
        animateTo(0);
      }
    }, 50);
  }, { passive: true });

  // --- Resize handler ---
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      render();
    }, 150);
  });

  // Star icon → return to landing
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      if (!isDone || isAnimating) return;
      resetLanding();
      phase = 2;
      progress = 0.99;
      animateTo(0, () => {
        phase = 1;
        progress = 1;
        render();
        animateTo(0, () => {
          phase = 0;
          progress = 1;
          render();
          animateTo(0);
        });
      });
    });
  }
})();
