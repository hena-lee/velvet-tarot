// Shared navbar and footer injected consistently across all pages
(function () {
  const isHome = document.querySelector(".landing") !== null;
  const isReading = document.body.classList.contains("reading-page");
  const isHistory = document.body.classList.contains("history-page");

  const wandSvg = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
    <line x1="2" y1="16" x2="10" y2="8"/>
    <line x1="10" y1="8" x2="13" y2="3.5"/>
    <circle cx="14" cy="2.5" r="1.2" fill="currentColor" stroke="none"/>
    <line x1="14" y1="0.5" x2="14" y2="1.3"/>
    <line x1="16" y1="1.5" x2="15.3" y2="2"/>
    <line x1="12" y1="1.5" x2="12.7" y2="2"/>
  </svg>`;

  const eyeSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;

  const bookSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>`;

  const downloadSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="3" x2="12" y2="15"/>
    <polyline points="8 11 12 15 16 11"/>
    <line x1="3" y1="21" x2="21" y2="21"/>
  </svg>`;

  // Brand: button on home (triggers scroll), anchor on other pages
  const brandHtml = isHome
    ? `<button class="nav-brand home-btn" aria-label="Home">Velvet Tarot</button>`
    : `<a href="/" class="nav-brand" aria-label="Home">Velvet Tarot</a>`;

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

  // Vercel Analytics
  const analyticsScript = document.createElement('script');
  analyticsScript.defer = true;
  analyticsScript.src = '/_vercel/insights/script.js';
  document.head.appendChild(analyticsScript);
})();
