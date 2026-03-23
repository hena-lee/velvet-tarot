// Shared navbar and footer injected consistently across all pages
(function () {
  const isHome = document.querySelector(".landing") !== null;
  const isReading = document.body.classList.contains("reading-page");

  // Brand: button on home (triggers scroll), anchor on other pages
  const brandHtml = isHome
    ? `<button class="nav-brand home-btn" aria-label="Home">VT</button>`
    : `<a href="/" class="nav-brand" aria-label="Home">VT</a>`;

  const navbar = document.createElement("nav");
  navbar.className = "navbar nav-hidden";
  navbar.innerHTML = `
    ${brandHtml}
    <div class="nav-links">
      <a href="/history.html" class="nav-link">Readings</a>
      <a href="/artifacts.html" class="nav-link">Arcana</a>
      <a href="/download.html" class="nav-link">Download</a>
    </div>
  `;

  document.body.prepend(navbar);

  // --- Click sound for UI interactions ---
  function playClickSound() {
    const audio = new Audio("/audio/click.mp3");
    audio.volume = 0.7;
    audio.playbackRate = 1.8;
    audio.play().catch(() => {});
  }
  window._playClickSound = playClickSound;

  // Nav links + brand
  navbar.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("click", () => playClickSound());
  });

  // Mobile gate — shown on small screens across all pages
  if (!document.getElementById('mobile-gate')) {
    const gate = document.createElement('div');
    gate.className = 'mobile-gate';
    gate.id = 'mobile-gate';
    gate.innerHTML = `
      <div class="mobile-gate-content">
        <span class="mobile-gate-label">Velvet Tarot</span>
        <h1 class="mobile-gate-title">
          This experience was built for larger screens.
        </h1>
        <p class="mobile-gate-subtitle">
          For the full visual journey — animated cards, lace frames, and
          all — please visit on a desktop or tablet.
        </p>
        <div class="mobile-gate-thesis">
          <em>"You don't see with your eye, you perceive with your mind."</em>
        </div>
      </div>
    `;
    document.body.prepend(gate);
  }

  // Auto-hide navbar: invisible trigger zone at top reveals it on hover
  const navTrigger = document.createElement('div');
  navTrigger.className = 'nav-trigger';
  document.body.appendChild(navTrigger);

  let hideTimer = null;

  function revealNav() {
    navbar.classList.remove('nav-hidden');
    clearTimeout(hideTimer);
  }

  function scheduleHide(ms) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => navbar.classList.add('nav-hidden'), ms);
  }

  navTrigger.addEventListener('mouseenter', revealNav);
  navbar.addEventListener('mouseenter', revealNav);
  navbar.addEventListener('mouseleave', () => scheduleHide(1500));

  // Mobile: tap near top of screen
  document.addEventListener('touchstart', (e) => {
    if (e.touches[0].clientY < 48) {
      revealNav();
      scheduleHide(3000);
    }
  }, { passive: true });

  // Show briefly when scrolled back to top
  window.addEventListener('scroll', () => {
    if (window.scrollY < 10) {
      revealNav();
      scheduleHide(2500);
    }
  });

  // Custom wand cursor — only on devices with a mouse/trackpad
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (hasFinePointer) {
    const wand = document.createElement('div');
    wand.className = 'wand-cursor';
    document.body.append(wand);

    const pastelColors = ['#f9c6d0', '#fdfd96', '#ffb7b2', '#c7ceea', '#ffd1dc'];
    const sparkleChars = ['✦', '⋆', '˚', '✶', '✷', '⊹', '✵'];
    let trailThrottle = 0;

    document.addEventListener('mousemove', (e) => {
      wand.style.visibility = 'visible';
      wand.style.left = (e.clientX - 6) + 'px';
      wand.style.top = (e.clientY - 6) + 'px';

      trailThrottle++;
      if (trailThrottle % 3 !== 0) return;

      for (let i = 0; i < 2; i++) {
        const trail = document.createElement('div');
        trail.className = 'wand-trail';
        const offsetX = (Math.random() - 0.5) * 20;
        const offsetY = (Math.random() - 0.5) * 20;
        const fallDist = 15 + Math.random() * 30;
        const drift = (Math.random() - 0.5) * 30;
        const size = 8 + Math.random() * 12;
        const spin = (Math.random() - 0.5) * 180;
        trail.style.left = (e.clientX + offsetX) + 'px';
        trail.style.top = (e.clientY + offsetY) + 'px';
        trail.style.color = pastelColors[Math.floor(Math.random() * pastelColors.length)];
        trail.style.setProperty('--char', '"' + sparkleChars[Math.floor(Math.random() * sparkleChars.length)] + '"');
        trail.style.setProperty('--size', size + 'px');
        trail.style.setProperty('--duration', (0.4 + Math.random() * 0.5) + 's');
        trail.style.setProperty('--fall', fallDist + 'px');
        trail.style.setProperty('--drift', drift + 'px');
        trail.style.setProperty('--spin', spin + 'deg');
        document.body.append(trail);
        trail.addEventListener('animationend', () => trail.remove());
      }
    });

    function spawnSparkles(x, y) {
      const count = 8;
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = 'wand-sparkle';
        spark.style.background = pastelColors[Math.floor(Math.random() * pastelColors.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 25;
        spark.style.left = x + 'px';
        spark.style.top = y + 'px';
        spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
        spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
        document.body.append(spark);
        spark.addEventListener('animationend', () => spark.remove());
      }
    }

    document.addEventListener('mousedown', (e) => {
      wand.classList.remove('twitch');
      void wand.offsetWidth;
      wand.classList.add('twitch');
      spawnSparkles(e.clientX, e.clientY);
    });

    wand.addEventListener('animationend', () => {
      wand.classList.remove('twitch');
    });
  }

  // --- Page transitions (View Transitions API + fade fallback) ---
  // Only apply on non-home, non-reading pages to avoid conflicting with their own transitions
  if (!isHome && !isReading) {
    const overlay = document.createElement('div');
    overlay.className = 'page-overlay';
    document.body.appendChild(overlay);

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      // Skip external links, new-tab links, and anchor-only links
      if (link.origin !== location.origin) return;
      if (link.target === '_blank') return;
      if (link.getAttribute('href').startsWith('#')) return;
      e.preventDefault();
      const href = link.href;
      if (document.startViewTransition) {
        document.startViewTransition(() => { location.href = href; });
      } else {
        overlay.classList.add('active');
        setTimeout(() => { location.href = href; }, 350);
      }
    });
  }

  // --- Dust motes — subtle floating particles across entire site ---
  (function initDustMotes() {
    const canvas = document.createElement('canvas');
    canvas.className = 'dust-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0.4;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let w, h;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const MOTE_COUNT = 35;
    const motes = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.08 - Math.random() * 0.12,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.002 + Math.random() * 0.004,
        alpha: 0.2 + Math.random() * 0.4,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.drift += m.driftSpeed;
        m.x += m.vx + Math.sin(m.drift) * 0.12;
        m.y += m.vy;
        // Wrap around
        if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w; }
        if (m.x < -5) m.x = w + 5;
        if (m.x > w + 5) m.x = -5;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 200, 170, ${m.alpha})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  // Vercel Analytics
  const analyticsScript = document.createElement('script');
  analyticsScript.defer = true;
  analyticsScript.src = '/_vercel/insights/script.js';
  document.head.appendChild(analyticsScript);
})();
