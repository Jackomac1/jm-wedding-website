'use strict';

// ============================================================
// 0. iOS safe area — push nav below status bar / notch
// ============================================================
(function applySafeAreaInset() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
  document.documentElement.appendChild(probe);
  const inset = parseInt(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  if (inset > 0) {
    document.documentElement.style.setProperty('--safe-top', inset + 'px');
  }
})();

// ============================================================
// 1. Navigation — scroll behaviour
// ============================================================
(function initNavScroll() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  // Inner pages use nav-solid by default, no scroll watcher needed
  if (nav.classList.contains('nav-solid')) return;

  function onScroll() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();

// ============================================================
// 2. Mobile hamburger menu
// ============================================================
(function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const navMenu   = document.getElementById('navMenu');
  if (!hamburger || !navMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  // Close when any nav link is clicked
  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();

// ============================================================
// 3. Countdown Timer
// ============================================================
(function initCountdown() {
  const daysEl    = document.getElementById('countDays');
  const hoursEl   = document.getElementById('countHours');
  const minsEl    = document.getElementById('countMinutes');
  const secsEl    = document.getElementById('countSeconds');
  const countdown = document.getElementById('countdown');
  const message   = document.getElementById('countdownMessage');

  if (!daysEl) return;

  const TARGET = new Date('2027-08-29T16:00:00');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function tick() {
    const now  = new Date();
    const diff = TARGET - now;

    if (diff <= 0) {
      if (countdown) countdown.style.display = 'none';
      if (message) {
        message.textContent = 'The big day is here!';
        message.style.display = 'block';
      }
      return;
    }

    const totalSecs = Math.floor(diff / 1000);
    const days  = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins  = Math.floor((totalSecs % 3600) / 60);
    const secs  = totalSecs % 60;

    daysEl.textContent  = days;
    hoursEl.textContent = pad(hours);
    minsEl.textContent  = pad(mins);
    secsEl.textContent  = pad(secs);
  }

  tick();
  setInterval(tick, 1000);
})();

// ============================================================
// 4. Scroll fade-in animations (IntersectionObserver)
// ============================================================
(function initFadeIn() {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;

  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    els.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
})();

// ============================================================
// 5. Active nav link
// ============================================================
(function initActiveLink() {
  const path  = window.location.pathname.replace(/\/$/, '');
  const links = document.querySelectorAll('.nav-link[data-page]');

  const pageMap = {
    '/home':      'home',
    '/our-story': 'our-story',
    '/details':   'details',
    '/registry':  'registry',
    '/rsvp':      'rsvp',
    '/contact':   'contact'
  };

  const activePage = pageMap[path];
  if (!activePage) return;

  links.forEach(link => {
    if (link.dataset.page === activePage) {
      link.classList.add('active');
    }
  });
})();

// ============================================================
// 6. Logout button
// ============================================================
(function initLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/enter';
    }
  });
})();
