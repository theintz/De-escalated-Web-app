(function () {
  'use strict';
  const M = window.Menu;
  const $ = (id) => document.getElementById(id);

  // ---- storage (best effort: may be unavailable in private mode) ----
  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    clear() {
      try { ['rm.draft', 'rm.myCode', 'rm.partnerCode'].forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    },
  };

  const myCode = validCode(store.get('rm.myCode'));
  const state = {
    answers: validDraft(store.get('rm.draft')) || (myCode ? M.decode(myCode) : Array(M.ITEM_COUNT).fill(M.NONE)),
    myCode,
    partnerCode: validCode(store.get('rm.partnerCode')),
    filter: null,
  };

  function validDraft(d) {
    return Array.isArray(d) && d.length === M.ITEM_COUNT && d.every((a) => a >= M.NONE && a <= M.OFF) ? d : null;
  }
  function validCode(c) {
    try { M.decode(c); return M.normalize(c); } catch (e) { return null; }
  }

  // A shared link carries the partner's code in the URL fragment (never sent to a server).
  const hashCode = new URLSearchParams(location.hash.slice(1)).get('c');
  if (hashCode) {
    const code = validCode(hashCode);
    if (code && code !== state.myCode) {
      state.partnerCode = code;
      store.set('rm.partnerCode', code);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---- views ----
  function show(view) {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + view; });
    window.scrollTo(0, 0);
  }

  // ---- form ----
  function renderLegend() {
    $('legend').innerHTML = M.RATINGS.map((r) =>
      `<span class="legend-item r${r.value}"><span class="icon">${r.icon}</span>${r.label}</span>`).join('');
  }

  function renderForm() {
    let index = 0;
    $('menu-form').innerHTML = M.CATEGORIES.map((cat) => `
      <fieldset class="category">
        <legend>${cat.title}</legend>
        ${cat.items.map((item) => {
          const i = index++;
          return `
            <div class="item" role="radiogroup" aria-labelledby="q${i}-label">
              <span class="item-label" id="q${i}-label">${item}</span>
              <span class="choices">
                ${M.RATINGS.map((r) => `
                  <label class="choice r${r.value}" title="${r.label}">
                    <input type="radio" name="q${i}" value="${r.value}" ${state.answers[i] === r.value ? 'checked' : ''}>
                    <span><span class="icon" aria-hidden="true">${r.icon}</span>${r.short}</span>
                  </label>`).join('')}
              </span>
            </div>`;
        }).join('')}
      </fieldset>`).join('');
    updateProgress();
  }

  function updateProgress() {
    const done = state.answers.filter((a) => a !== M.NONE).length;
    $('progress').textContent = `${done} of ${M.ITEM_COUNT} answered`;
  }

  $('menu-form').addEventListener('change', (e) => {
    const i = Number(e.target.name.slice(1));
    state.answers[i] = Number(e.target.value);
    store.set('rm.draft', state.answers);
    updateProgress();
  });

  $('btn-start').addEventListener('click', () => { renderForm(); show('form'); });

  $('btn-submit').addEventListener('click', () => {
    const missing = state.answers.filter((a) => a === M.NONE).length;
    if (missing && !confirm(`${missing} item${missing > 1 ? 's are' : ' is'} unanswered and will show as "unanswered" in the results. Continue?`)) return;
    state.myCode = M.encode(state.answers);
    store.set('rm.myCode', state.myCode);
    showCode();
  });

  // ---- my code ----
  function showCode() {
    $('my-code').textContent = M.format(state.myCode);
    $('my-link').value = `${location.origin}${location.pathname}#c=${state.myCode}`;
    $('btn-to-compare').textContent = state.partnerCode ? 'See results' : 'Compare with partner';
    show('code');
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

  $('btn-copy-code').addEventListener('click', (e) => copy(M.format(state.myCode), e.target));
  $('btn-copy-link').addEventListener('click', (e) => copy($('my-link').value, e.target));
  $('btn-edit').addEventListener('click', () => {
    state.answers = M.decode(state.myCode);
    renderForm();
    show('form');
  });
  $('btn-to-compare').addEventListener('click', () => {
    if (state.partnerCode) showResults(M.decode(state.myCode), M.decode(state.partnerCode));
    else showCompare();
  });

  // ---- compare ----
  function showCompare() {
    $('input-mine').value = state.myCode ? M.format(state.myCode) : '';
    $('input-theirs').value = state.partnerCode ? M.format(state.partnerCode) : '';
    $('compare-error').hidden = true;
    show('compare');
  }

  $('btn-have-code').addEventListener('click', showCompare);
  $('btn-compare-back').addEventListener('click', () => (state.myCode ? showCode() : show('intro')));

  $('compare-form').addEventListener('submit', (e) => {
    e.preventDefault();
    let mine, theirs;
    try { mine = M.decode($('input-mine').value); } catch (err) { return compareError('Your code: ' + err.message); }
    try { theirs = M.decode($('input-theirs').value); } catch (err) { return compareError("Partner's code: " + err.message); }
    state.myCode = M.normalize($('input-mine').value);
    state.partnerCode = M.normalize($('input-theirs').value);
    store.set('rm.myCode', state.myCode);
    store.set('rm.partnerCode', state.partnerCode);
    showResults(mine, theirs);
  });

  function compareError(msg) {
    $('compare-error').textContent = msg;
    $('compare-error').hidden = false;
  }

  // ---- results ----
  const ratingLabel = (v) => (M.RATINGS.find((r) => r.value === v) || { label: '—' }).label;
  const ratingIcon = (v) => (M.RATINGS.find((r) => r.value === v) || { icon: '' }).icon;

  function showResults(mine, theirs) {
    const result = M.compare(mine, theirs);
    state.filter = null;
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
          <h3>${cat.title}</h3>
          <div class="result-row result-head" aria-hidden="true"><span></span><span>You</span><span>Partner</span><span></span></div>
          ${rows.map((r) => `
            <div class="result-row">
              <span class="item-label">${r.item}</span>
              <span class="answer r${r.mine}"><span class="who">You</span><span class="icon">${ratingIcon(r.mine)}</span>${ratingLabel(r.mine)}</span>
              <span class="answer r${r.theirs}"><span class="who">Partner</span><span class="icon">${ratingIcon(r.theirs)}</span>${ratingLabel(r.theirs)}</span>
              <span class="badge t-${r.tier}">${M.TIERS[r.tier].label}</span>
            </div>`).join('')}
        </section>`;
    }).join('') || '<p class="muted">Nothing in this category.</p>';
  }

  $('btn-print').addEventListener('click', () => window.print());
  $('btn-restart').addEventListener('click', () => {
    if (!confirm('This clears your answers and codes from this browser. Make sure you have saved your code if you need it. Continue?')) return;
    store.clear();
    location.reload();
  });

  // ---- start ----
  renderLegend();
  $('partner-notice').hidden = !state.partnerCode;
  $('btn-have-code').hidden = !state.myCode;
  if (state.myCode) $('btn-start').textContent = 'Edit my answers';
  show('intro');
})();
