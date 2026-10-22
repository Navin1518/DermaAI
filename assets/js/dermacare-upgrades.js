(() => {
  'use strict';

  const config = {
    amSelector: '[data-dc-routine="am"]',
    pmSelector: '[data-dc-routine="pm"]'
  };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const normalizedSkin = value => {
    const skin = String(value || '').toLowerCase();
    return ['oily', 'dry', 'combination', 'sensitive'].includes(skin) ? skin : 'combination';
  };

  const PRODUCTS = [
    {name:'CeraVe Foaming Facial Cleanser',kind:'Cleanser',price:'$15.99',skin:['oily','combination'],mark:'01',url:'https://www.cerave.com/skincare/cleansers/foaming-facial-cleanser'},
    {name:'The Ordinary Niacinamide 10% + Zinc 1%',kind:'Oil-control serum',price:'$6.00',skin:['oily','combination'],mark:'02',url:'https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html'},
    {name:'CeraVe PM Facial Moisturizing Lotion',kind:'Barrier-support moisturizer',price:'$14.99',skin:['dry','sensitive','combination'],mark:'03',url:'https://www.cerave.com/skincare/moisturizers/pm-facial-moisturizing-lotion'},
    {name:'La Roche-Posay Anthelios SPF 50',kind:'Broad-spectrum sunscreen',price:'$25.99',skin:['oily','dry','combination','sensitive'],mark:'04',url:'https://www.laroche-posay.us/our-products/sunscreen'}
  ];

  const state = {skinType:'combination', zones:{}};

  function setupTheme() {
    const host = $('[data-dc="theme"]');
    if (!host) return;
    host.innerHTML = '<button class="dc-control" type="button" aria-label="Switch color theme" title="Switch color theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><span>Theme</span></button>';
    const button = $('button', host);
    button.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      button.setAttribute('aria-pressed', String(next === 'dark'));
      try {
        localStorage.setItem('dc:theme', JSON.stringify(next));
      } catch (error) {
        console.error('Unable to save the selected theme.', error);
      }
    });
    button.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  }

  function setupEnvironment() {
    const host = $('[data-dc="env"]');
    if (!host) return;
    host.innerHTML = '<button class="dc-control" type="button" aria-label="Check local UV index" title="Share your location to check the local UV index"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2"/></svg><span>UV</span><span class="dc-env-status" aria-live="polite">Check local</span></button>';
    const button = $('button', host);
    const status = $('.dc-env-status', button);
    button.addEventListener('click', () => {
      if (!navigator.geolocation) {
        status.textContent = 'Location unavailable';
        status.dataset.state = 'error';
        return;
      }
      status.textContent = 'Locating…';
      status.removeAttribute('data-state');
      navigator.geolocation.getCurrentPosition(async position => {
        try {
          const {latitude, longitude} = position.coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=uv_index`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`UV service returned HTTP ${response.status}`);
          const data = await response.json();
          const uv = data.current && data.current.uv_index;
          if (typeof uv !== 'number' || !Number.isFinite(uv)) throw new Error('UV service returned no valid UV index');
          const level = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very high' : 'Extreme';
          status.textContent = `UV ${uv.toFixed(1)} · ${level}`;
          button.title = `Local UV index: ${uv.toFixed(1)} (${level})`;
        } catch (error) {
          console.error('Unable to load local UV conditions.', error);
          status.textContent = 'UV unavailable';
          status.dataset.state = 'error';
        }
      }, error => {
        status.textContent = error.code === error.PERMISSION_DENIED ? 'Location denied' : 'UV unavailable';
        status.dataset.state = 'error';
      }, {maximumAge:300000, timeout:10000});
    });
  }

  function setupHeatmap() {
    const host = $('[data-dc="heatmap"]');
    if (!host) return;
    host.innerHTML = `<section class="dc-heatmap" aria-label="Facial skin zone map">
      <div class="dc-heatmap-head"><div><h4>Facial zone map</h4><p class="dc-heatmap-status" aria-live="polite">Run an assessment to map zones</p></div></div>
      <svg class="dc-face" viewBox="0 0 220 230" role="img" aria-label="Facial zones: no diagnosis yet">
        <path class="dc-face-outline" d="M43 34Q48 9 110 9t67 25l-8 88q-5 68-59 91-54-23-59-91z"/>
        <ellipse class="dc-zone" data-zone="forehead" cx="110" cy="53" rx="38" ry="19"><title>Forehead: no result</title></ellipse>
        <ellipse class="dc-zone" data-zone="cheeks" cx="69" cy="111" rx="24" ry="20"><title>Cheeks: no result</title></ellipse>
        <ellipse class="dc-zone" data-zone="cheeks" cx="151" cy="111" rx="24" ry="20" aria-hidden="true"/>
        <ellipse class="dc-zone" data-zone="nose" cx="110" cy="112" rx="12" ry="28"><title>Nose: no result</title></ellipse>
        <ellipse class="dc-zone" data-zone="chin" cx="110" cy="166" rx="26" ry="14"><title>Chin: no result</title></ellipse>
        <path class="dc-face-detail" d="M71 89q11-8 22 0m34 0q11-8 22 0m-39 39q10 7 20 0m-23 24q13 6 26 0"/>
      </svg>
      <div class="dc-zone-key"><span><i style="--dc-zone:#DDECE2"></i>Clear</span><span><i style="--dc-zone:#F5D98C"></i>Mild</span><span><i style="--dc-zone:#EBA879"></i>Moderate</span><span><i style="--dc-zone:#D9786B"></i>Severe</span></div>
    </section>`;
    document.addEventListener('dermacare:diagnosis', event => {
      const detail = event.detail || {};
      const levels = ['clear', 'mild', 'moderate', 'severe'];
      const zones = detail.zones && typeof detail.zones === 'object' ? detail.zones : {};
      for (const zone of ['forehead', 'cheeks', 'nose', 'chin']) {
        const value = levels.includes(zones[zone]) ? zones[zone] : (levels.includes(detail.severity) ? detail.severity : 'clear');
        const matching = $$(`[data-zone="${zone}"]`, host);
        matching.forEach(part => {
          part.dataset.level = value;
          const title = $('title', part);
          if (title) title.textContent = `${zone}: ${value}`;
        });
        state.zones[zone] = value;
      }
      const label = levels.includes(detail.severity) ? detail.severity : 'assessment';
      $('.dc-heatmap-status', host).textContent = `Assessment complete · ${label} overall`;
      $('.dc-face', host).setAttribute('aria-label', `Facial zones: ${Object.entries(state.zones).map(([name, value]) => `${name} ${value}`).join(', ')}`);
    });
  }

  function readDays() {
    try {
      const value = JSON.parse(localStorage.getItem('dc:routine-days') || '[]');
      return Array.isArray(value) ? value.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)) : [];
    } catch (error) {
      console.error('Unable to read routine streak history.', error);
      return [];
    }
  }

  function streakLength(days) {
    const set = new Set(days);
    const cursor = new Date();
    if (!set.has(today())) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (set.has(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function setupStreak() {
    const host = $('[data-dc="streak"]');
    if (!host) return;
    host.innerHTML = '<section class="dc-panel"><div class="dc-streak-head"><div><h3>Routine consistency</h3><p>Daily progress rings and your completed-day streak</p></div></div><div class="dc-streak-body"></div><p class="dc-streak-note" aria-live="polite"></p></section>';
    const render = () => {
      const am = $(config.amSelector);
      const pm = $(config.pmSelector);
      const progress = container => {
        const boxes = container ? $$('[role="checkbox"],input[type="checkbox"]', container) : [];
        const total = boxes.length;
        const done = boxes.filter(box => box.matches('input[type="checkbox"]') ? box.checked : box.getAttribute('aria-checked') === 'true').length;
        return {done, total, percent:total ? Math.round(done / total * 100) : 0};
      };
      const morning = progress(am), evening = progress(pm);
      const allDone = morning.total > 0 && evening.total > 0 && morning.done === morning.total && evening.done === evening.total;
      let days = readDays();
      if (allDone) {
        const current = today();
        if (!days.includes(current)) {
          days = [...days, current].sort().slice(-90);
          try {
            localStorage.setItem('dc:routine-days', JSON.stringify(days));
          } catch (error) {
            console.error('Unable to save routine streak history.', error);
          }
        }
      }
      const streak = streakLength(days);
      $('.dc-streak-body', host).innerHTML = [
        ['AM routine',morning,` ${morning.done}/${morning.total} steps`],
        ['PM routine',evening,` ${evening.done}/${evening.total} steps`],
        ['Current streak',{percent:Math.round(Math.min(streak / 7 * 100, 100))},`${streak} ${streak === 1 ? 'day' : 'days'}`]
      ].map(([label, data, value]) => `<div class="dc-ring-item"><span class="dc-ring" style="--dc-p:${data.percent}%"><b>${data.percent}%</b></span><span><strong>${label}</strong><small>${value}</small></span></div>`).join('');
      $('.dc-streak-note', host).textContent = allDone ? 'All routine steps complete today. Great consistency!' : 'Complete every AM and PM step to count a day toward your streak.';
    };
    render();
    const routineObserver = new MutationObserver(records => {
      const changed = records.some(record => {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        return target && [config.amSelector, config.pmSelector].some(selector => target.matches(selector) || target.closest(selector));
      });
      if (changed) render();
    });
    routineObserver.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['aria-checked','class']});
    document.addEventListener('change', event => {
      if (event.target.matches && event.target.matches('input[type="checkbox"]') &&
          [config.amSelector, config.pmSelector].some(selector => event.target.closest(selector))) render();
    });
    document.addEventListener('keydown', event => {
      const item = event.target.closest && event.target.closest('[role="checkbox"]');
      if (item && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        item.click();
      }
    });
  }

  function renderShelf() {
    const host = $('[data-dc="shelf"]');
    if (!host) return;
    const matched = PRODUCTS.map(product => {
      const score = product.skin.includes(state.skinType) ? 96 : 78;
      return {...product, score};
    }).sort((a, b) => b.score - a.score);
    host.innerHTML = `<section class="dc-panel">
      <div class="dc-shelf-head"><div><h3>Product shelf</h3><p>Options matched to ${state.skinType} skin</p></div><span class="badge">Routine essentials</span></div>
      <div class="dc-product-grid">${matched.map(product => `<article class="dc-product">
        <div class="dc-product-mark" aria-hidden="true">${product.mark}</div>
        <h4>${product.name}</h4><p>${product.kind}</p>
        <div class="dc-product-meta"><span class="dc-match">${product.score}% match</span><span class="dc-price">${product.price}</span></div>
        <a class="btn btn-ghost" href="${product.url}" target="_blank" rel="noopener noreferrer">View product</a>
      </article>`).join('')}</div>
      <p class="dc-price-note">Indicative US retail prices, not live-verified. Confirm current price and availability with the retailer before purchase.</p>
    </section>`;
  }

  function setupComparison() {
    const host = $('[data-dc="compare"]');
    if (!host) return;
    const items = [
      {key:'before',label:'Week 0',caption:'Baseline'},
      {key:'after6',label:'Week 6',caption:'Mid-plan'},
      {key:'after12',label:'Week 12',caption:'Follow-up'}
    ];
    host.classList.add('dc-panel');
    host.innerHTML = `<div class="dc-compare-head"><div><h3>Progress photo comparison</h3><p>Use your own consistent, well-lit photos to track changes.</p></div></div><div class="dc-compare-grid">${items.map(item => `<figure class="dc-compare-card" data-photo="${item.key}">
      <div class="dc-compare-image"><img alt="${item.label} progress photo"><span class="dc-photo-caption">Demo placeholder</span></div>
      <figcaption class="dc-compare-meta"><b>${item.label}</b><small>${item.caption}</small></figcaption>
    </figure>`).join('')}</div>`;
    items.forEach(item => {
      const path = host.dataset[item.key];
      if (!path) return;
      const figure = $(`[data-photo="${item.key}"]`, host);
      const image = $('img', figure);
      const placeholder = $('.dc-photo-caption', figure);
      image.addEventListener('load', () => {
        image.style.display = 'block';
        placeholder.hidden = true;
      });
      image.addEventListener('error', () => {
        image.style.display = 'none';
        placeholder.hidden = false;
      });
      image.src = path;
    });
  }

  const definitions = {
    acne:'A skin condition involving clogged pores and inflammation.',
    sebum:'The natural oil produced by skin glands.',
    comedones:'Pores clogged with oil and dead skin; includes blackheads and whiteheads.',
    papules:'Small, inflamed bumps on the skin.',
    pustules:'Inflamed bumps containing pus.',
    retinoid:'A vitamin A-derived topical ingredient that affects skin cell turnover.',
    niacinamide:'A form of vitamin B3 used in skincare.',
    ceramides:'Skin lipids that help support the protective barrier.',
    adapalene:'A topical retinoid used to treat acne.',
    'salicylic acid':'A beta hydroxy acid that helps exfoliate inside pores.',
    'benzoyl peroxide':'A topical acne ingredient that reduces acne-causing bacteria.',
    'photosensitivity':'Increased sensitivity to sunlight.',
    'skin barrier':'The outer protective layer that helps retain moisture.'
  };
  const terms = Object.keys(definitions).sort((a, b) => b.length - a.length);
  const termPattern = new RegExp(`\\b(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');

  function highlightTerms(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('.dc-term,script,style,textarea,input,button,a')) return NodeFilter.FILTER_REJECT;
        termPattern.lastIndex = 0;
        return termPattern.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const content = node.nodeValue;
      termPattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let offset = 0, match;
      while ((match = termPattern.exec(content))) {
        fragment.append(document.createTextNode(content.slice(offset, match.index)));
        const key = match[0].toLowerCase();
        const span = document.createElement('span');
        span.className = 'dc-term';
        span.tabIndex = 0;
        span.dataset.dcTerm = key;
        span.title = definitions[key];
        span.setAttribute('aria-label', `${match[0]}: ${definitions[key]}`);
        span.textContent = match[0];
        fragment.append(span);
        offset = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(content.slice(offset)));
      node.replaceWith(fragment);
    });
  }

  function setupAutoTerms() {
    $$('[data-dc-autoterms]').forEach(highlightTerms);
    const observer = new MutationObserver(records => {
      const roots = new Set();
      records.forEach(record => {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        const root = target && target.closest('[data-dc-autoterms]');
        if (root) roots.add(root);
      });
      roots.forEach(highlightTerms);
    });
    observer.observe(document.body, {subtree:true, childList:true});
  }

  function setupWelcomeAndAuth() {
    const intro = $('#dcIntro');
    const gate = $('#dcAuthGate');
    const app = $('.app');
    const form = $('#dcAuthForm');
    const signOut = $('#dcSignOut');
    if (!intro || !gate || !app || !form) return;

    const authStorageKey = 'dc:auth-state-v1';
    const introStorageKey = 'dc:intro-seen-v1';
    const skinButtons = $$('#dcAuthSkin [data-skin]');
    let authMode = 'signin';
    let selectedSkin = 'combination';

    function readGuestState() {
      try {
        const value = JSON.parse(localStorage.getItem(authStorageKey) || 'null');
        if (value && value.version === 1 && value.mode === 'guest') {
          return {mode:'guest', skinType:normalizedSkin(value.skinType)};
        }
      } catch (error) {
        console.warn('Unable to restore the saved demo session.', error);
      }
      return null;
    }

    function setWorkspaceLocked(locked) {
      app.inert = locked;
      if (locked) {
        app.setAttribute('aria-hidden', 'true');
        document.body.classList.add('dc-gate-open');
      } else {
        app.removeAttribute('aria-hidden');
        document.body.classList.remove('dc-gate-open');
      }
      if (signOut) signOut.hidden = locked;
    }

    function showAuth() {
      gate.hidden = false;
      setWorkspaceLocked(true);
      window.requestAnimationFrame(() => $('#dcAuthEmail').focus({preventScroll:true}));
    }

    function finishIntro(guestState) {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      intro.classList.add('dc-intro-exit');
      window.setTimeout(() => {
        intro.hidden = true;
        intro.setAttribute('aria-hidden', 'true');
        if (guestState) {
          gate.hidden = true;
          setWorkspaceLocked(false);
          DermaUp.setProfile({skinType:guestState.skinType});
        } else {
          showAuth();
        }
      }, reducedMotion ? 50 : 620);
    }

    const guestState = readGuestState();
    let hasSeenIntro = false;
    try {
      hasSeenIntro = localStorage.getItem(introStorageKey) === '1';
      if (!hasSeenIntro) localStorage.setItem(introStorageKey, '1');
    } catch (error) {
      console.warn('Unable to save the welcome-screen preference.', error);
    }

    if (hasSeenIntro) {
      intro.hidden = true;
      intro.setAttribute('aria-hidden', 'true');
      if (guestState) {
        setWorkspaceLocked(false);
        DermaUp.setProfile({skinType:guestState.skinType});
      } else {
        showAuth();
      }
    } else {
      setWorkspaceLocked(true);
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 1880;
      window.setTimeout(() => finishIntro(guestState), duration);
    }

    function setMode(mode) {
      authMode = mode;
      const isSignup = mode === 'signup';
      const tabs = $('.dc-auth-tabs');
      const nameField = $('#dcNameField');
      const nameInput = $('#dcAuthName');
      const skinGroup = $('#dcAuthSkin');
      const password = $('#dcAuthPassword');
      const passwordToggle = $('.dc-password-toggle');
      const message = $('#dcAuthMessage');
      tabs.dataset.mode = mode;
      $('#dcSignInTab').setAttribute('aria-selected', String(!isSignup));
      $('#dcSignUpTab').setAttribute('aria-selected', String(isSignup));
      nameField.hidden = !isSignup;
      nameInput.disabled = !isSignup;
      nameInput.required = isSignup;
      skinGroup.hidden = !isSignup;
      password.autocomplete = isSignup ? 'new-password' : 'current-password';
      password.type = 'password';
      passwordToggle.textContent = 'Show';
      passwordToggle.setAttribute('aria-label', 'Show password');
      passwordToggle.setAttribute('aria-pressed', 'false');
      $('#dcAuthSubmit').textContent = isSignup ? 'Create demo preview' : 'Continue with demo';
      message.textContent = '';
      message.removeAttribute('data-state');
    }

    $('#dcSignInTab').addEventListener('click', () => setMode('signin'));
    $('#dcSignUpTab').addEventListener('click', () => setMode('signup'));
    skinButtons.forEach(button => button.addEventListener('click', () => {
      selectedSkin = button.dataset.skin;
      skinButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    }));

    $('.dc-password-toggle').addEventListener('click', event => {
      const button = event.currentTarget;
      const password = $('#dcAuthPassword');
      const show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`);
      button.setAttribute('aria-pressed', String(show));
      password.focus({preventScroll:true});
    });

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const message = $('#dcAuthMessage');
      message.dataset.state = 'error';
      message.textContent = 'Authentication is not connected in this demo. Use Explore as guest; no credentials are sent or saved.';
    });
    $$('#dcAuthGate [data-auth-provider]').forEach(button => button.addEventListener('click', () => {
      const message = $('#dcAuthMessage');
      message.dataset.state = 'error';
      message.textContent = `${button.dataset.authProvider} sign-in is not configured for this demo. No account connection was attempted.`;
    }));

    $('#dcGuestPreview').addEventListener('click', () => {
      const skinType = authMode === 'signup' ? selectedSkin : 'combination';
      let storageWarning = false;
      try {
        localStorage.setItem(authStorageKey, JSON.stringify({version:1,mode:'guest',skinType}));
      } catch (error) {
        console.warn('Unable to persist the guest preview session.', error);
        storageWarning = true;
      }
      form.reset();
      setMode('signin');
      if (storageWarning) {
        const message = $('#dcAuthMessage');
        message.dataset.state = 'error';
        message.textContent = 'Storage is unavailable; your guest session will last only until you close this page.';
      }
      gate.hidden = true;
      setWorkspaceLocked(false);
      DermaUp.setProfile({skinType});
    });

    if (signOut) signOut.addEventListener('click', () => {
      let storageWarning = false;
      try {
        localStorage.removeItem(authStorageKey);
      } catch (error) {
        console.warn('Unable to clear the saved guest session.', error);
        storageWarning = true;
      }
      form.reset();
      setMode('signin');
      if (storageWarning) {
        $('#dcAuthMessage').textContent = 'Storage is unavailable; this guest session may return if you reload the page.';
      }
      gate.hidden = false;
      setWorkspaceLocked(true);
      window.requestAnimationFrame(() => $('#dcAuthEmail').focus({preventScroll:true}));
    });

    gate.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = $$('button:not(:disabled),input:not(:disabled)', gate).filter(element => !element.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !gate.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function setupMotion() {
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('dc-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, {threshold:0.08, rootMargin:'0px 0px -32px 0px'});
      $$('.page-head,.page .card,.dc-panel,.kpi').forEach(element => {
        element.classList.add('dc-reveal');
        revealObserver.observe(element);
      });
    } else {
      $$('.dc-reveal').forEach(element => element.classList.add('dc-revealed'));
    }

    document.addEventListener('click', event => {
      const button = event.target.closest && event.target.closest('.app .btn,.app .nav-btn,.app .chip,.app .mnav button');
      if (!button) return;
      const bounds = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'dc-ripple';
      ripple.style.left = `${event.clientX - bounds.left - 7}px`;
      ripple.style.top = `${event.clientY - bounds.top - 7}px`;
      button.append(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), {once:true});
    });

    if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      $$('.app .btn-primary').forEach(button => {
        button.addEventListener('pointermove', event => {
          const bounds = button.getBoundingClientRect();
          button.style.setProperty('--dc-mx', `${(event.clientX - bounds.left - bounds.width / 2) * .045}px`);
          button.style.setProperty('--dc-my', `${(event.clientY - bounds.top - bounds.height / 2) * .08}px`);
        });
        button.addEventListener('pointerleave', () => {
          button.style.removeProperty('--dc-mx');
          button.style.removeProperty('--dc-my');
        });
      });
    }

    let celebrated = false;
    document.addEventListener('click', event => {
      if (!event.target.closest || !event.target.closest('.step')) return;
      window.setTimeout(() => {
        const checks = $$('[data-dc-routine] [role="checkbox"]');
        const complete = checks.length > 0 && checks.every(item => item.getAttribute('aria-checked') === 'true');
        if (complete && !celebrated) {
          celebrated = true;
          celebrateRoutine();
        } else if (!complete) {
          celebrated = false;
        }
      }, 0);
    });
  }

  function celebrateRoutine() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const burst = document.createElement('div');
    burst.className = 'dc-routine-confetti';
    burst.setAttribute('aria-hidden', 'true');
    const colors = ['#2dd4bf','#67e8f9','#a78bfa','#fbbf24','#fb7185','#34d399'];
    for (let index = 0; index < 52; index++) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${8 + Math.random() * 84}%`);
      piece.style.setProperty('--y', `${30 + Math.random() * 30}%`);
      piece.style.setProperty('--dx', `${(Math.random() - .5) * 220}px`);
      piece.style.setProperty('--dy', `${80 + Math.random() * 270}px`);
      piece.style.setProperty('--turn', `${Math.random() * 720 - 360}deg`);
      piece.style.setProperty('--size', `${4 + Math.random() * 5}px`);
      piece.style.setProperty('--delay', `${Math.random() * 180}ms`);
      piece.style.setProperty('--color', colors[index % colors.length]);
      burst.append(piece);
    }
    document.body.append(burst);
    window.setTimeout(() => burst.remove(), 1700);
  }

  const DermaUp = {
    config,
    PRODUCTS,
    setProfile(profile = {}) {
      if (Object.prototype.hasOwnProperty.call(profile, 'skinType')) {
        state.skinType = normalizedSkin(profile.skinType);
        renderShelf();
      }
    }
  };
  window.DermaUp = DermaUp;

  setupTheme();
  setupEnvironment();
  setupHeatmap();
  setupStreak();
  setupComparison();
  setupAutoTerms();
  setupWelcomeAndAuth();
  setupMotion();
  const selectedSkin = $('#typeSeg .opt.active') || $('#rtType .chip.active');
  DermaUp.setProfile({skinType:selectedSkin && selectedSkin.dataset.v});
  document.addEventListener('click', event => {
    const selected = event.target.closest && event.target.closest('#typeSeg .opt, #rtType .chip');
    if (selected) DermaUp.setProfile({skinType:selected.dataset.v});
  });
})();
