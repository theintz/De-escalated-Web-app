(function () {
  'use strict';
  const M = window.Menu;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // ---- storage (best effort: may be unavailable in private mode) ----
  const KEYS = ['rm.draft', 'rm.custom', 'rm.myCode', 'rm.partnerCode'];
  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    clear() {
      try { KEYS.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    },
  };

  const isRating = (a) => Number.isInteger(a) && a >= M.NONE && a <= M.OFF;
  function validDraft(d) {
    if (!Array.isArray(d) || d.length > M.ITEM_COUNT || !d.every(isRating)) return null;
    // Drafts saved before items were added are shorter: new items start unanswered.
    return d.concat(Array(M.ITEM_COUNT - d.length).fill(M.NONE));
  }
  function validCustom(list) {
    return Array.isArray(list) && list.length <= M.MAX_CUSTOM &&
      list.every((c) => c && M.CATEGORIES[c.category] && isRating(c.rating) && typeof c.text === 'string' && c.text)
      ? list : null;
  }
  function decodeOrNull(code) {
    try { return M.decode(code); } catch (e) { return null; }
  }
  // Accepts a bare code or a whole share link.
  function extractCode(input) {
    const s = String(input).trim();
    const hash = s.indexOf('#');
    const code = (hash < 0 ? s : s.slice(hash + 1)).replace(/^c=/, '');
    try { return decodeURIComponent(code); } catch (e) { return code; }
  }

  const saved = decodeOrNull(store.get('rm.myCode'));
  const state = {
    answers: validDraft(store.get('rm.draft')) || (saved ? saved.answers : Array(M.ITEM_COUNT).fill(M.NONE)),
    custom: validCustom(store.get('rm.custom')) || (saved ? saved.custom : []),
    myCode: saved ? M.normalize(store.get('rm.myCode')) : null,
    partnerCode: decodeOrNull(store.get('rm.partnerCode')) ? store.get('rm.partnerCode') : null,
    filter: null,
  };

  function saveDraft() {
    store.set('rm.draft', state.answers);
    store.set('rm.custom', state.custom);
  }

  // Only the person who starts the exchange can add custom items; whoever
  // received a partner's answers rates the partner's items instead.
  const canEditCustom = () => !state.partnerCode;

  // ---- incoming link ----
  // A shared link carries the code in the URL fragment, which is never sent to a server.
  // Format: #CODE (older links used #c=CODE).
  let openedPartnerLink = false;
  let linkError = null;
  if (location.hash.length > 1) {
    const code = extractCode(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const partner = M.decode(code);
      const normalized = M.normalize(code);
      if (normalized !== state.myCode) {
        state.partnerCode = normalized;
        store.set('rm.partnerCode', normalized);
        state.custom = M.mergeCustom(state.custom, partner.custom);
        saveDraft();
        openedPartnerLink = true;
      }
    } catch (e) {
      linkError = e.message;
    }
  }

  // Opening a link while the app is already open only changes the fragment.
  window.addEventListener('hashchange', () => { if (location.hash.length > 1) location.reload(); });

  // ---- views ----
  function show(view) {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    window.scrollTo(0, 0);
  }

  // ---- form ----
  function renderGuide(el) {
    el.innerHTML = M.RATINGS.map((r) => `
      <div class="guide-item">
        <span class="guide-label r${r.value}"><span class="icon" aria-hidden="true">${r.icon}</span>${r.label}</span>
        ${r.description ? `<span class="guide-desc">${r.description}</span>` : ''}
      </div>`).join('');
  }

  function itemRow(name, label, value, extra) {
    return `
      <div class="item" role="radiogroup" aria-labelledby="${name}-label">
        <span class="item-label" id="${name}-label">${esc(label)}${extra || ''}</span>
        <span class="choices">
          ${M.RATINGS.map((r) => `
            <label class="choice r${r.value}" title="${r.label}${r.description ? `: ${r.description}` : ''}">
              <input type="radio" name="${name}" value="${r.value}" ${value === r.value ? 'checked' : ''}>
              <span><span class="icon" aria-hidden="true">${r.icon}</span>${r.short}</span>
            </label>`).join('')}
        </span>
      </div>`;
  }

  function renderForm() {
    const editable = canEditCustom();
    const canAdd = editable && state.custom.length < M.MAX_CUSTOM;
    $('menu-form').innerHTML = M.CATEGORIES.map((cat, ci) => `
      <fieldset class="category">
        <legend>${esc(cat.title)}</legend>
        ${cat.items.map((item) => itemRow(`q${item.slot}`, item.text, state.answers[item.slot])).join('')}
        ${state.custom.map((c, j) => (c.category !== ci ? '' : itemRow(`c${j}`, c.text, c.rating,
          ' <span class="tag">custom</span>' +
          (editable ? ` <button type="button" class="remove" data-remove="${j}" aria-label="Remove ${esc(c.text)}">✕</button>` : '')))).join('')}
        ${canAdd ? `
          <div class="add-item">
            <input type="text" maxlength="${M.MAX_CUSTOM_LENGTH}" placeholder="Add your own item" data-input="${ci}" aria-label="Add your own ${esc(cat.title)} item">
            <button type="button" class="secondary small-btn" data-add="${ci}">Add</button>
          </div>` : ''}
      </fieldset>`).join('') +
      (editable && !canAdd ? `<p class="muted small">You've added the maximum of ${M.MAX_CUSTOM} custom items.</p>` : '');
    updateProgress();
  }

  function updateProgress() {
    const all = state.answers.concat(state.custom.map((c) => c.rating));
    const done = all.filter((a) => a !== M.NONE).length;
    $('progress').textContent = `${done} of ${all.length} answered`;
    $('btn-submit').textContent = state.partnerCode ? 'Show results' : 'Get my link';
  }

  function addCustom(ci) {
    const input = document.querySelector(`[data-input="${ci}"]`);
    const text = M.cleanText(input.value);
    if (!text || state.custom.length >= M.MAX_CUSTOM) return;
    state.custom.push({ category: ci, text, rating: M.NONE });
    saveDraft();
    renderForm();
    const next = document.querySelector(`[data-input="${ci}"]`);
    if (next) next.focus();
  }

  $('menu-form').addEventListener('submit', (e) => e.preventDefault());
  $('menu-form').addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (!name) return;
    const i = Number(name.slice(1));
    if (name[0] === 'q') state.answers[i] = Number(value);
    else state.custom[i].rating = Number(value);
    saveDraft();
    updateProgress();
  });
  $('menu-form').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    const remove = e.target.closest('[data-remove]');
    if (add) addCustom(Number(add.dataset.add));
    if (remove) {
      state.custom.splice(Number(remove.dataset.remove), 1);
      saveDraft();
      renderForm();
    }
  });
  $('menu-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.input !== undefined) {
      e.preventDefault();
      addCustom(Number(e.target.dataset.input));
    }
  });

  function showForm() {
    renderForm();
    show('form');
  }

  $('btn-start').addEventListener('click', showForm);

  // Unanswered items are fine: they show as "unanswered" in the results.
  $('btn-submit').addEventListener('click', () => {
    state.myCode = M.encode(state.answers, state.custom);
    store.set('rm.myCode', state.myCode);
    if (state.partnerCode) showResults();
    else showCode();
  });

  // ---- sharing ----
  const shareLink = () => `${location.origin}${location.pathname}#${state.myCode}`;

  function renderShare(container) {
    const link = shareLink();
    // Link on its own line with nothing after it, so messengers linkify it cleanly.
    const message = state.partnerCode
      ? `Here are my answers to the relationship menu. Open the link to see how they compare with yours:\n${link}`
      : `I filled out the relationship menu. Fill out yours and we can compare our answers:\n${link}`;
    container.innerHTML = `
      <div class="actions share">
        <a class="button primary" href="https://wa.me/?text=${encodeURIComponent(message)}" target="_blank" rel="noopener">Send via WhatsApp</a>
        ${navigator.share ? '<button type="button" class="secondary" data-share>Share…</button>' : ''}
      </div>
      <div class="code-box">
        <input readonly value="${esc(link)}" aria-label="Share link">
        <button type="button" class="secondary small-btn" data-copy>Copy link</button>
      </div>`;
    const share = container.querySelector('[data-share]');
    if (share) share.onclick = () => navigator.share({ text: message }).catch(() => { /* cancelled */ });
    container.querySelector('[data-copy]').onclick = (e) => copy(link, e.target);
  }

  function copy(text, button) {
    const done = () => {
      const old = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = old; }, 1500);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* user can copy manually */ }
    t.remove();
  }

  // ---- my link ----
  function showCode() {
    const hasCustom = state.myCode.includes('.');
    renderShare($('code-share'));
    $('short-code').hidden = hasCustom;
    $('custom-note').hidden = !hasCustom;
    if (!hasCustom) $('my-code').textContent = M.format(state.myCode);
    show('code');
  }

  $('btn-copy-code').addEventListener('click', (e) => copy(M.format(state.myCode), e.target));
  function editAnswers() {
    // Prefer the draft: it may hold changes made after the code was created.
    showForm();
  }
  $('btn-edit').addEventListener('click', editAnswers);
  $('btn-results-edit').addEventListener('click', editAnswers);
  $('btn-to-compare').addEventListener('click', showCompare);

  // ---- compare ----
  function showCompare() {
    const fmt = (c) => (c ? M.format(c) : '');
    $('input-mine').value = fmt(state.myCode);
    $('input-theirs').value = fmt(state.partnerCode);
    $('compare-error').hidden = true;
    show('compare');
  }

  $('btn-have-code').addEventListener('click', showCompare);
  $('btn-compare-back').addEventListener('click', () => (state.myCode ? showCode() : show('intro')));

  $('compare-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const mineCode = extractCode($('input-mine').value);
    const theirCode = extractCode($('input-theirs').value);
    let mine;
    try { mine = M.decode(mineCode); } catch (err) { return compareError('Your code: ' + err.message); }
    try { M.decode(theirCode); } catch (err) { return compareError("Partner's code: " + err.message); }
    state.myCode = M.normalize(mineCode);
    state.partnerCode = M.normalize(theirCode);
    state.answers = mine.answers;
    state.custom = mine.custom;
    saveDraft();
    store.set('rm.myCode', state.myCode);
    store.set('rm.partnerCode', state.partnerCode);
    showResults();
  });

  function compareError(msg) {
    $('compare-error').textContent = msg;
    $('compare-error').hidden = false;
  }

  // ---- results ----
  const ratingLabel = (v) => (M.RATINGS.find((r) => r.value === v) || { label: '—' }).label;
  const ratingIcon = (v) => (M.RATINGS.find((r) => r.value === v) || { icon: '' }).icon;

  function showResults() {
    const result = M.compare(M.decode(state.myCode), M.decode(state.partnerCode));
    state.filter = null;
    renderShare($('results-share'));
    renderSummary(result);
    renderResults(result);
    $('summary').onclick = (e) => {
      const btn = e.target.closest('[data-tier]');
      if (!btn) return;
      state.filter = state.filter === btn.dataset.tier ? null : btn.dataset.tier;
      renderSummary(result);
      renderResults(result);
    };
    show('results');
  }

  function renderSummary({ counts }) {
    $('summary').innerHTML = Object.entries(M.TIERS)
      .filter(([key]) => key !== 'unanswered' || counts.unanswered)
      .map(([key, t]) => `
        <button type="button" class="tier-chip t-${key} ${state.filter === key ? 'active' : ''}" data-tier="${key}"
          aria-pressed="${state.filter === key}" title="${t.description}">
          <span class="count">${counts[key]}</span>
          <span class="name">${t.label}</span>
          <span class="desc">${t.description}</span>
        </button>`).join('');
  }

  function renderResults({ categories }) {
    $('results').innerHTML = categories.map((cat) => {
      const rows = cat.rows.filter((r) => !state.filter || r.tier === state.filter);
      if (!rows.length) return '';
      return `
        <section class="category">
          <h3>${esc(cat.title)}</h3>
          <div class="result-row result-head" aria-hidden="true"><span></span><span>You</span><span>Partner</span><span></span></div>
          ${rows.map((r) => `
            <div class="result-row">
              <span class="item-label">${esc(r.item)}${r.custom ? ' <span class="tag">custom</span>' : ''}</span>
              <span class="answer r${r.mine}"><span class="who">You</span><span class="icon">${ratingIcon(r.mine)}</span>${ratingLabel(r.mine)}</span>
              <span class="answer r${r.theirs}"><span class="who">Partner</span><span class="icon">${ratingIcon(r.theirs)}</span>${ratingLabel(r.theirs)}</span>
              <span class="badge t-${r.tier}">${M.TIERS[r.tier].label}</span>
            </div>`).join('')}
        </section>`;
    }).join('') || '<p class="muted">Nothing in this category.</p>';
  }

  $('btn-print').addEventListener('click', () => window.print());
  $('btn-restart').addEventListener('click', () => {
    if (!confirm('This clears your answers and links from this browser. Make sure you have saved your link if you need it. Continue?')) return;
    store.clear();
    location.reload();
  });

  // ---- start ----
  renderGuide($('intro-guide'));
  renderGuide($('legend'));
  $('form-about').innerHTML = document.querySelector('#view-intro .about').innerHTML;
  $('form-notice').hidden = !state.partnerCode;
  if (state.myCode) $('btn-start').textContent = 'Edit my answers';
  if (linkError) {
    $('link-error').textContent = `The link you opened doesn't work: ${linkError}`;
    $('link-error').hidden = false;
  }

  if (openedPartnerLink && state.myCode) showResults();
  else if (openedPartnerLink) showForm();
  else show('intro');
})();
