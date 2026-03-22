// --- Landing transition: curtain → powder room split → theater zoom (wheel-driven) ---
(function () {
  const imgWrapper = document.querySelector('.landing-image-wrapper');
  const landing = document.querySelector('.landing');
  const curtain = document.querySelector('.landing-curtain');
  const powderLeft = document.querySelector('.powder-left');
  const powderRight = document.querySelector('.powder-right');
  if (!imgWrapper || !landing) return;

  const cloudLayer = document.querySelector('.cloud-layer');

  // Skip landing and go straight to ask page when ?new is in the URL
  if (new URLSearchParams(window.location.search).has('new')) {
    history.replaceState(null, '', '/');
    window.location.href = '/ask.html';
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

  function hideLanding() {
    isDone = true;
    stopFlashLoop();
    landing.style.pointerEvents = 'none';
    // Hide skip button
    const skipBtn = document.querySelector('.skip-intro');
    if (skipBtn) skipBtn.classList.remove('visible');
    // Fade out clouds
    if (cloudLayer) {
      cloudLayer.style.transition = 'opacity 0.25s ease';
      cloudLayer.style.opacity = '0';
    }
    // Cover the screen with a solid overlay before navigating to prevent flash
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;inset:0;background:var(--rose-bg);z-index:99999;opacity:0;transition:opacity 0.3s ease;';
    document.body.appendChild(cover);
    requestAnimationFrame(() => { cover.style.opacity = '1'; });
    // Navigate after the overlay is fully opaque
    localStorage.setItem('velvet_visited', '1');
    setTimeout(() => {
      window.location.href = '/ask.html';
    }, 350);
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
    if (isAnimating || isDone) return;

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

  landing.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    touchStartY = e.touches[0].clientY;
    lastTouchY = touchStartY;
    clearTimeout(snapTimer);
  }, { passive: true });

  landing.addEventListener('touchmove', (e) => {
    if (isAnimating || touchStartY === null || isDone) return;

    e.preventDefault();

    const currentY = e.touches[0].clientY;
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

  // --- Skip intro: show for returning users ---
  const skipBtn = document.querySelector('.skip-intro');
  if (skipBtn && localStorage.getItem('velvet_visited')) {
    // Fade in gradually after a short delay
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
