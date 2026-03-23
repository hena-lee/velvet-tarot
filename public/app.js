// --- Landing transition: curtain → powder room split → theater zoom (wheel-driven) ---
(function () {
  const imgWrapper = document.querySelector('.landing-image-wrapper');
  const landing = document.querySelector('.landing');
  const curtain = document.querySelector('.landing-curtain');
  const powderLeft = document.querySelector('.powder-left');
  const powderRight = document.querySelector('.powder-right');
  if (!imgWrapper || !landing) return;

  const cloudLayer = document.querySelector('.cloud-layer');
  const gif = document.querySelector('.landing-gif');
  const header = document.querySelector('.app-header');

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
  let autoAdvanceTimer = null;
  let skippedIntro = false;

  // === Audio system ===
  // All audio requires a user gesture to unlock — we unlock on first interaction
  let audioUnlocked = false;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const clickPrompt = document.getElementById('click-prompt');

  function unlockAudio() {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => { audioUnlocked = true; }).catch(() => {});
    } else {
      audioUnlocked = true;
    }
    // Hide the click prompt once audio is unlocked
    if (clickPrompt) clickPrompt.classList.add('hidden');
  }
  // Only listen on events that qualify as user activation for autoplay
  ['click', 'touchstart', 'pointerdown'].forEach(evt =>
    window.addEventListener(evt, unlockAudio, { once: false, passive: true })
  );

  // Looping audio helper with fade support
  function createLoop(src, volume) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    audio._targetVol = volume;
    return audio;
  }

  function fadeIn(audio, duration) {
    if (!audio || audio._fading === 'in') return;
    audio._fading = 'in';
    audio.volume = 0;
    audio.play().catch(() => {});
    const step = 20;
    const inc = audio._targetVol / (duration / step);
    const iv = setInterval(() => {
      audio.volume = Math.min(audio.volume + inc, audio._targetVol);
      if (audio.volume >= audio._targetVol) {
        audio._fading = null;
        clearInterval(iv);
      }
    }, step);
    audio._fadeIv = iv;
  }

  function fadeOut(audio, duration) {
    if (!audio) return;
    if (audio._fadeIv) clearInterval(audio._fadeIv);
    audio._fading = 'out';
    const step = 20;
    const dec = audio.volume / (duration / step);
    const iv = setInterval(() => {
      audio.volume = Math.max(audio.volume - dec, 0);
      if (audio.volume <= 0) {
        audio.pause();
        audio.currentTime = 0;
        audio._fading = null;
        clearInterval(iv);
      }
    }, step);
    audio._fadeIv = iv;
  }

  // One-shot audio helper — uses Web Audio API buffers (works on wheel events)
  // with HTMLAudioElement fallback. earlyFade starts fading at 25% of duration.
  function playOneShot(src, volume, earlyFade) {
    // Try Web Audio API first (not blocked by autoplay on wheel events)
    const buffer = oneShotBuffers[src];
    if (buffer && audioCtx.state !== 'closed') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain).connect(audioCtx.destination);
      source.start(0);
      if (earlyFade) {
        const fadeStart = audioCtx.currentTime + buffer.duration * 0.25;
        gain.gain.setValueAtTime(volume, fadeStart);
        gain.gain.linearRampToValueAtTime(0, fadeStart + buffer.duration * 0.25);
        source.stop(fadeStart + buffer.duration * 0.25);
      }
      // Return a dummy with pause event for storm sequence compatibility
      const dummy = new EventTarget();
      const stopTime = earlyFade ? buffer.duration * 0.5 : buffer.duration;
      setTimeout(() => dummy.dispatchEvent(new Event('pause')), stopTime * 1000);
      return dummy;
    }
    // Fallback: HTMLAudioElement (works after click/touch activation)
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
    if (earlyFade) {
      audio.addEventListener('loadedmetadata', () => {
        const startFade = audio.duration * 0.25;
        const fadeDur = startFade * 1000;
        setTimeout(() => {
          const step = 20;
          const dec = audio.volume / (fadeDur / step);
          const iv = setInterval(() => {
            audio.volume = Math.max(audio.volume - dec, 0);
            if (audio.volume <= 0) {
              audio.pause();
              clearInterval(iv);
            }
          }, step);
        }, startFade * 1000);
      }, { once: true });
    }
    return audio;
  }

  // Audio sources
  const thunderLoop = createLoop('/audio/thunder.mp3', 0.4);
  const rainLoop = createLoop('/audio/rain.mp3', 0.35);
  const curtainSound = '/audio/curtain.mp3';
  const doorsSound = '/audio/doors.mp3';
  const zoomSound = '/audio/zoom.mp3';
  let curtainLastP = 0;
  let curtainMoving = false;
  let doorsLastP = 0;
  let doorsMoving = false;

  // Pre-load one-shot sounds as audio buffers for Web Audio API playback.
  // This avoids HTMLAudioElement autoplay restrictions on wheel events.
  const oneShotBuffers = {};
  [curtainSound, doorsSound, zoomSound].forEach(src => {
    fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => { oneShotBuffers[src] = decoded; })
      .catch(() => {});
  });

  // === Foreground rain — soft-focus drops for depth ===
  const rainCanvas = document.getElementById('rain-canvas');
  const rainCtx = rainCanvas ? rainCanvas.getContext('2d') : null;
  let rainAnimId = null;
  const drops = [];

  function initRainCanvas() {
    if (!rainCanvas) return;
    rainCanvas.width = window.innerWidth * devicePixelRatio;
    rainCanvas.height = window.innerHeight * devicePixelRatio;
    rainCanvas.style.width = window.innerWidth + 'px';
    rainCanvas.style.height = window.innerHeight + 'px';
    rainCtx.scale(devicePixelRatio, devicePixelRatio);
  }

  function spawnDrop() {
    // Vary size for depth — larger = closer to camera
    const size = 1.5 + Math.random() * 4;
    const alpha = 0.08 + (size / 5.5) * 0.18;
    const H = window.innerHeight;
    // Start drops in the bottom third of the screen
    const startY = H * 0.33 + Math.random() * (H * 0.1);
    return {
      x: Math.random() * window.innerWidth,
      y: startY - Math.random() * 40,
      w: size * 0.4,
      h: size * (8 + Math.random() * 14),
      speed: 6 + size * 4 + Math.random() * 3,
      alpha: alpha,
    };
  }

  function tickRain() {
    if (!rainCtx) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    rainCtx.clearRect(0, 0, W, H);

    // Spawn new drops
    for (let i = 0; i < 3; i++) {
      if (drops.length < 80) drops.push(spawnDrop());
    }

    // Single fill style — CSS blur on the canvas softens everything in one GPU pass
    rainCtx.fillStyle = 'rgba(195, 205, 220, 1)';

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.speed;
      // Slight wind drift
      d.x += 0.3;

      if (d.y > H + 30) {
        drops.splice(i, 1);
        continue;
      }

      rainCtx.globalAlpha = d.alpha;
      rainCtx.beginPath();
      rainCtx.ellipse(d.x, d.y + d.h / 2, d.w, d.h / 2, 0, 0, Math.PI * 2);
      rainCtx.fill();
    }

    rainAnimId = requestAnimationFrame(tickRain);
  }

  function startRain() {
    if (!rainCanvas || rainAnimId) return;
    initRainCanvas();
    drops.length = 0;
    rainCanvas.classList.add('active');
    tickRain();
  }

  function stopRain() {
    if (rainAnimId) {
      cancelAnimationFrame(rainAnimId);
      rainAnimId = null;
    }
    if (rainCanvas) rainCanvas.classList.remove('active');
    drops.length = 0;
  }

  if (rainCanvas) {
    window.addEventListener('resize', () => {
      if (rainAnimId) initRainCanvas();
    });
  }

  function triggerCloudFlash() {
    const clouds = document.querySelectorAll('.landing-cloud');
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

    // Theater image flashes in sync with header
    if (theaterImg) {
      flashTimers.push(setTimeout(() => {
        theaterImg.classList.add('theater-flash');
        theaterImg.addEventListener('animationend', () => {
          theaterImg.classList.remove('theater-flash');
        }, { once: true });
      }, headerSync));

      flashTimers.push(setTimeout(() => {
        theaterImg.classList.add('theater-flash-dim');
        theaterImg.addEventListener('animationend', () => {
          theaterImg.classList.remove('theater-flash-dim');
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
    // Gradually darken the ground + start foreground rain
    if (landing) landing.classList.add('wet-ground');
    startRain();
    // Fade in thunder and rain audio
    fadeIn(thunderLoop, 3000);
    fadeIn(rainLoop, 4000);
    triggerCloudFlash();
    // Auto-advance to ask page after 5s if user hasn't scrolled past the gif
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      if (!isDone && phase <= 2) {
        phase = 2;
        progress = 0;
        render();
        animateTo(1, hideLanding, 600);
      }
    }, 5000);
  }

  function stopFlashLoop() {
    flashLoopRunning = false;
    flashTimers.forEach(t => clearTimeout(t));
    flashTimers = [];
    clearTimeout(autoAdvanceTimer);
    // Clean up any lingering flash classes
    document.querySelectorAll('.landing-cloud').forEach(c => {
      c.classList.remove('flash', 'flash-dim');
    });
    const header = document.querySelector('.app-header');
    if (header) header.classList.remove('header-flash', 'header-flash-dim');
    // Clean up theater flash
    if (theaterImg) theaterImg.classList.remove('theater-flash', 'theater-flash-dim');
    // Remove wet ground effect
    landing.classList.remove('wet-ground');
    stopRain();
    // Fade out thunder and rain audio
    fadeOut(thunderLoop, 2000);
    fadeOut(rainLoop, 2500);
  }

  function applyCurtain(p) {
    if (curtain) {
      curtain.style.transform = `translateY(${-p * 100}%)`;
    }
    // Play sound when movement starts or changes direction
    const delta = p - curtainLastP;
    if (Math.abs(delta) > 0.001 && !curtainMoving) {
      playOneShot(curtainSound, 0.5, true);
    }
    curtainMoving = Math.abs(delta) > 0.001;
    curtainLastP = p;
  }

  let powderFlashTriggered = false;

  function applyPowderRoom(p) {
    if (powderLeft) {
      powderLeft.style.transform = `translateX(${-p * 100}%)`;
    }
    if (powderRight) {
      powderRight.style.transform = `translateX(${p * 100}%)`;
    }
    // Play sound when movement starts or changes direction
    const delta = p - doorsLastP;
    if (Math.abs(delta) > 0.001 && !doorsMoving) {
      const doorsAudio = playOneShot(doorsSound, 0.5, true);
      // Start storm sequence after the first opening completes
      if (!powderFlashTriggered && !isDone) {
        doorsAudio.addEventListener('pause', () => {
          if (!powderFlashTriggered && !isDone) {
            powderFlashTriggered = true;
            startFlashLoop();
          }
        }, { once: true });
      }
    }
    doorsMoving = Math.abs(delta) > 0.001;
    doorsLastP = p;
    // Full storm reset when doors close back
    if (p === 0) {
      powderFlashTriggered = false;
      stopFlashLoop();
    }
  }

  let zoomPlayed = false;
  function applyZoom(p) {
    if (p > 0) stopFlashLoop();
    if (p > 0 && !zoomPlayed) {
      zoomPlayed = true;
      playOneShot(zoomSound, 0.5, false);
    }
    // Everything scales up together — theater, header, clouds — as if the camera pushes in
    const scale = 1 + p * 1.5;
    landing.style.transform = `scale(${scale})`;
    landing.style.transformOrigin = '50% 55%';
    if (cloudLayer) {
      cloudLayer.style.transform = `scale(${scale})`;
      cloudLayer.style.transformOrigin = '50% 55%';
    }
    // Fade to black
    landing.style.opacity = 1 - p;
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
    // Cover the screen with black — we've zoomed into darkness
    const cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;opacity:0;transition:opacity 0.8s ease;';
    document.body.appendChild(cover);
    requestAnimationFrame(() => { cover.style.opacity = '1'; });
    // Longer pause in darkness to build suspense before the reading card
    localStorage.setItem('velvet_visited', '1');
    setTimeout(() => {
      window.location.href = skippedIntro ? '/ask.html?skip' : '/ask.html';
    }, 1400);
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
      if (window._playClickSound) window._playClickSound();
      skippedIntro = true;
      skipBtn.classList.remove('visible');
      // Silently jump curtain + doors to fully open so no movement sounds trigger
      curtainLastP = 1;
      curtainMoving = false;
      doorsLastP = 1;
      doorsMoving = false;
      phase = 2;
      progress = 0;
      render();
      animateTo(1, hideLanding, 600);
    });
  }
})();
