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

  localStorage.setItem('velvet_visited', '1');
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

// --- Spread pill selection ---
document.querySelectorAll('.spread-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.spread-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    document.getElementById('spread').value = pill.dataset.value;
  });
});

// --- Landing transition: curtain → powder room split → theater zoom (wheel-driven) ---
(function () {
  const imgWrapper = document.querySelector('.landing-image-wrapper');
  const landing = document.querySelector('.landing');
  const curtain = document.querySelector('.landing-curtain');
  const powderLeft = document.querySelector('.powder-left');
  const powderRight = document.querySelector('.powder-right');
  const homeBtn = document.querySelector('.home-btn');
  const readingForm = document.getElementById('reading-form-wrap') || document.getElementById('reading-form');
  if (!imgWrapper || !landing) return;

  // Define cloudLayer here so it's accessible in all branches
  const cloudLayerEl = document.querySelector('.cloud-layer');

  // Skip landing and go straight to reading form when ?new is in the URL
  if (new URLSearchParams(window.location.search).has('new')) {
    landing.style.visibility = 'hidden';
    landing.style.pointerEvents = 'none';
    if (readingForm) readingForm.style.opacity = '1';
    // Also hide clouds — they belong to the landing theater, not the form
    if (cloudLayerEl) {
      cloudLayerEl.style.opacity = '0';
      cloudLayerEl.style.visibility = 'hidden';
    }
    history.replaceState(null, '', '/');
    return;
  }

  // Lock scrolling while the theatrical landing is active
  document.body.classList.add('no-scroll');

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
  const SNAP_THRESHOLD = 0.08;
  const ANIM_DURATION = 80;

  if (readingForm) readingForm.style.opacity = '0';

  let flashTimers = [];
  let flashLoopRunning = false;

  function triggerCloudFlash() {
    const clouds = document.querySelectorAll('.landing-cloud');
    const header = document.querySelector('.app-header');
    const stagger = 120;
    const headerSync = 2 * stagger;
    const firstRoundDuration = (clouds.length - 1) * stagger + 500;
    const fullCycleDuration = firstRoundDuration + 200 + (clouds.length - 1) * stagger + 500;

    // First round — bright flash
    clouds.forEach((cloud, i) => {
      flashTimers.push(setTimeout(() => {
        cloud.classList.add('flash');
        cloud.addEventListener('animationend', () => {
          cloud.classList.remove('flash');
        }, { once: true });
      }, i * stagger));
    });

    // Header flashes in sync with clouds
    if (header) {
      flashTimers.push(setTimeout(() => {
        header.classList.add('header-flash');
        header.addEventListener('animationend', () => {
          header.classList.remove('header-flash');
        }, { once: true });
      }, headerSync));

      flashTimers.push(setTimeout(() => {
        header.classList.add('header-flash-dim');
        header.addEventListener('animationend', () => {
          header.classList.remove('header-flash-dim');
        }, { once: true });
      }, firstRoundDuration + 200 + headerSync));
    }

    // Second round — dimmer afterglow, same stagger order
    clouds.forEach((cloud, i) => {
      flashTimers.push(setTimeout(() => {
        cloud.classList.add('flash-dim');
        cloud.addEventListener('animationend', () => {
          cloud.classList.remove('flash-dim');
        }, { once: true });
      }, firstRoundDuration + 200 + i * stagger));
    });

    // Loop: schedule next cycle after a pause
    flashTimers.push(setTimeout(() => {
      if (flashLoopRunning) triggerCloudFlash();
    }, fullCycleDuration + 1500));
  }

  function startFlashLoop() {
    if (flashLoopRunning) return;
    flashLoopRunning = true;
    // Gradually darken the ground
    if (landing) landing.classList.add('wet-ground');
    triggerCloudFlash();
  }

  function stopFlashLoop() {
    flashLoopRunning = false;
    flashTimers.forEach(t => clearTimeout(t));
    flashTimers = [];
    // Clean up any lingering flash classes
    document.querySelectorAll('.landing-cloud').forEach(c => {
      c.classList.remove('flash', 'flash-dim');
    });
    const header = document.querySelector('.app-header');
    if (header) header.classList.remove('header-flash', 'header-flash-dim');
    // Remove wet ground
    if (landing) landing.classList.remove('wet-ground');
  }

  function applyCurtain(p) {
    if (curtain) {
      curtain.style.transform = `translateY(${-p * 100}%)`;
    }
  }

  let powderFlashTriggered = false;

  function applyPowderRoom(p) {
    if (powderLeft) {
      powderLeft.style.transform = `translateX(${-p * 100}%)`;
    }
    if (powderRight) {
      powderRight.style.transform = `translateX(${p * 100}%)`;
    }
    // Start flashing when doors are 20% open
    if (p > 0.2 && !powderFlashTriggered) {
      powderFlashTriggered = true;
      startFlashLoop();
    }
    // Reset flag if doors close back
    if (p === 0) {
      powderFlashTriggered = false;
    }
  }

  function applyZoom(p) {
    if (p > 0) stopFlashLoop();
    const scale = 1 + p * 1.5;
    imgWrapper.style.transform = `scale(${scale})`;
    landing.style.opacity = 1 - p;
    if (readingForm) readingForm.style.opacity = Math.max(0, (p - 0.4) / 0.6);
    // Fade clouds in sync with the zoom
    if (cloudLayer) cloudLayer.style.opacity = String(1 - p);
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

  const cloudLayer = cloudLayerEl;

  function hideLanding() {
    isDone = true;
    stopFlashLoop();
    landing.style.pointerEvents = 'none';
    landing.style.visibility = 'hidden';
    document.body.classList.remove('no-scroll');
    // Hide skip button once landing is complete
    const skipBtn = document.querySelector('.skip-intro');
    if (skipBtn) skipBtn.classList.remove('visible');
    // Hide clouds immediately — no lingering fade
    if (cloudLayer) {
      cloudLayer.style.transition = 'opacity 0.25s ease';
      cloudLayer.style.opacity = '0';
      setTimeout(() => { cloudLayer.style.visibility = 'hidden'; }, 250);
    }
  }

  function resetLanding() {
    isDone = false;
    formSubmitted = false;
    landing.style.visibility = '';
    landing.style.pointerEvents = '';
    document.body.classList.add('no-scroll');
    window.scrollTo(0, 0);
    if (readingForm) readingForm.style.opacity = '0';
    // Restore clouds when returning to the landing
    if (cloudLayer) {
      cloudLayer.style.visibility = '';
      cloudLayer.style.transition = 'opacity 0.5s ease';
      cloudLayer.style.opacity = '1';
    }
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

    const delta = e.deltaY / 500;

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

  // --- Skip intro: show for returning users ---
  const skipBtn = document.querySelector('.skip-intro');
  if (skipBtn && localStorage.getItem('velvet_visited')) {
    // Fade in gradually after a short delay — feels like an invitation, not a button
    setTimeout(() => skipBtn.classList.add('visible'), 800);
    skipBtn.addEventListener('click', () => {
      skipBtn.classList.remove('visible');
      phase = 2;
      progress = 0;
      render();
      animateTo(1, hideLanding, 600);
    });
  }
})();
