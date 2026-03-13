// Shared navbar and footer injected consistently across all pages
(function () {
  const isHome = document.querySelector(".landing") !== null;
  const isReading = document.body.classList.contains("reading-page");
  const isHistory = document.body.classList.contains("history-page");

  // Star: <span> with home-btn on index (for landing JS), <a> link on other pages
  const starHtml = isHome
    ? '<span class="home-btn nav-star">&#10022;</span>'
    : '<a href="/" class="nav-star">&#10022;</a>';

  // New Reading link: visible on history, hidden-until-summary on reading, absent elsewhere
  let newReadingLink = '';
  if (isHistory) {
    newReadingLink = '<a href="/?new">New Reading</a>';
  } else if (isReading) {
    newReadingLink = '<a href="/?new" class="nav-new-reading" style="display:none">New Reading</a>';
  }

  const navbar = document.createElement("nav");
  navbar.className = "navbar";
  navbar.innerHTML = `
    <div class="nav-icon">${starHtml}</div>
    <div class="nav-links">
      ${newReadingLink}
      <a href="/history.html">Past Readings</a>
      <a href="/artifacts.html">Artifacts</a>
      <a href="/download.html">Download</a>
    </div>
  `;

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = "<span>&copy; 2026 freehand engineering by hena </span>";

  document.body.prepend(navbar);
  document.body.append(footer);

  // Hide navbar on scroll down, show on scroll up or at top
  let lastScrollY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > lastScrollY && y > 50) {
      navbar.classList.add('nav-hidden');
    } else {
      navbar.classList.remove('nav-hidden');
    }
    lastScrollY = y;
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
})();
