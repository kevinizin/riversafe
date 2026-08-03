/* ============================================================
   HortaPop — lógica do jogo
   ============================================================ */
(function () {
  'use strict';

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  const el = function (tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  /* data local (não UTC) — importante para a contagem de dias seguidos */
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ==================== PERFIS ==================== */
  /* Cada perfil tem seu próprio progresso, guardado neste mesmo aparelho
     (não é uma conta online — troca de aparelho não leva o progresso junto). */
  const LEGACY_KEY = 'hortapop.v1';     // versão sem perfis, mantida só para migração
  const PROFILES_KEY = 'hortapop.profiles';
  const ACTIVE_KEY = 'hortapop.active';
  const saveKey = function (id) { return 'hortapop.save.' + id; };

  const DEFAULT = {
    v: 1, xp: 0, score: 0,
    levels: {}, srs: {},
    set: { sound: 1, voice: 1, haptic: 1, typing: 0 },
    streak: { n: 0, last: '' },
  };
  const EMOJIS = ['🥑', '🍎', '🍓', '🍉', '🍇', '🍍', '🥕', '🌽', '🥦', '🍒', '🥭', '🍋', '🍑', '🥝', '🍌', '🌶️', '🧅', '🍐', '🫐', '🥔'];

  function loadProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch (e) { return []; }
  }
  function saveProfiles() {
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(PROFILES)); } catch (e) {}
  }
  function getActiveId() {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; }
  }
  function setActiveId(id) {
    try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
  }

  let PROFILES = loadProfiles();
  let ACTIVE = '';
  let S = JSON.parse(JSON.stringify(DEFAULT));

  function loadState(id) {
    try {
      const raw = localStorage.getItem(saveKey(id));
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      const d = JSON.parse(raw);
      return Object.assign(JSON.parse(JSON.stringify(DEFAULT)), d, {
        set: Object.assign({}, DEFAULT.set, d.set || {}),
        streak: Object.assign({}, DEFAULT.streak, d.streak || {}),
      });
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT)); }
  }
  function save() {
    if (!ACTIVE) return;
    try { localStorage.setItem(saveKey(ACTIVE), JSON.stringify(S)); } catch (e) {}
  }

  /* progresso de antes de existirem perfis (v1) vira o primeiro perfil, sem perder nada */
  function migrateLegacy() {
    if (PROFILES.length) return;
    let legacy = null;
    try { const raw = localStorage.getItem(LEGACY_KEY); if (raw) legacy = JSON.parse(raw); } catch (e) {}
    if (!legacy) return;
    const id = 'p' + Date.now();
    PROFILES = [{ id: id, name: 'Jogador 1', emoji: '🥑', createdAt: Date.now() }];
    saveProfiles();
    try { localStorage.setItem(saveKey(id), JSON.stringify(legacy)); } catch (e) {}
    setActiveId(id);
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
  }

  function peekStats(id) {
    const st = loadState(id);
    const words = ITEMS.filter(function (i) { return st.srs[i.id] && st.srs[i.id].seen > 0; }).length;
    const stars = Object.keys(st.levels).reduce(function (sum, k) { return sum + (st.levels[k].stars || 0); }, 0);
    return { words: words, stars: stars };
  }

  function createProfile(name, emoji) {
    const id = 'p' + Date.now() + Math.floor(Math.random() * 1000);
    const prof = { id: id, name: name, emoji: emoji, createdAt: Date.now() };
    PROFILES.push(prof);
    saveProfiles();
    return prof;
  }
  function updateProfile(id, patch) {
    const p = PROFILES.filter(function (pp) { return pp.id === id; })[0];
    if (!p) return;
    Object.assign(p, patch);
    saveProfiles();
  }
  function deleteProfile(id) {
    PROFILES = PROFILES.filter(function (p) { return p.id !== id; });
    saveProfiles();
    try { localStorage.removeItem(saveKey(id)); } catch (e) {}
    if (ACTIVE === id) { ACTIVE = ''; setActiveId(''); }
  }
  function switchProfile(id) {
    ACTIVE = id;
    setActiveId(id);
    S = loadState(id);
    updateProfile(id, { lastPlayed: Date.now() });
  }

  /* ==================== REPETIÇÃO ESPAÇADA ==================== */
  const MIN = 60000, DAY = 86400000;
  const STEPS = [10 * MIN, 1 * DAY, 2 * DAY, 4 * DAY, 8 * DAY, 16 * DAY, 32 * DAY];

  function srs(id) {
    if (!S.srs[id]) S.srs[id] = { s: 0, due: 0, seen: 0, ok: 0, bad: 0 };
    return S.srs[id];
  }
  function grade(id, good) {
    const r = srs(id);
    r.seen++;
    if (good) { r.ok++; r.s = Math.min(STEPS.length - 1, r.s + 1); }
    else { r.bad++; r.s = Math.max(0, r.s - 1); }
    r.due = Date.now() + (good ? STEPS[r.s] : 8 * MIN);
  }
  function dueItems() {
    const now = Date.now();
    return ITEMS.filter(function (i) {
      const r = S.srs[i.id];
      return r && r.seen > 0 && r.due <= now;
    }).sort(function (a, b) { return S.srs[a.id].due - S.srs[b.id].due; });
  }
  const known = function () { return ITEMS.filter(function (i) { return S.srs[i.id] && S.srs[i.id].seen > 0; }); };
  function strength(id) {
    const r = S.srs[id];
    if (!r || !r.seen) return 0;
    return Math.round((r.s / (STEPS.length - 1)) * 100);
  }

  /* ==================== XP / NÍVEL ==================== */
  function xpLevel() {
    let lv = 1, need = 100, left = S.xp;
    while (left >= need) { left -= need; lv++; need = 100 + (lv - 1) * 40; }
    return { lv: lv, cur: left, need: need };
  }
  function addXp(n) { S.xp += n; }

  /* ==================== SOM & VOZ ==================== */
  let ac = null;
  function actx() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function beep(freqs, dur, type, vol) {
    if (!S.set.sound) return;
    const c = actx(); if (!c) return;
    freqs.forEach(function (f, i) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      const t0 = c.currentTime + i * (dur * 0.65);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.14, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    });
  }
  const sfx = {
    ok: function () { beep([660, 880, 1180], 0.16, 'triangle', 0.13); },
    no: function () { beep([200, 150], 0.2, 'sawtooth', 0.09); },
    tap: function () { beep([520], 0.06, 'sine', 0.07); },
    win: function () { beep([523, 659, 784, 1047], 0.22, 'triangle', 0.14); },
  };
  function buzz(ms) {
    if (S.set.haptic && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices() || [];
    const en = vs.filter(function (v) { return /^en(-|_)?/i.test(v.lang); });
    voice = en.filter(function (v) { return /en[-_]US/i.test(v.lang); })[0] ||
            en.filter(function (v) { return /en[-_]GB/i.test(v.lang); })[0] || en[0] || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function say(text, rate) {
    if (!S.set.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate || 0.85;
      u.pitch = 1.05;
      if (voice) u.voice = voice;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ==================== NAVEGAÇÃO ==================== */
  let current = '';
  function go(id) {
    if (id === current) return;
    $$('.screen').forEach(function (s) { s.classList.toggle('on', s.id === id); });
    current = id;
    const sc = document.querySelector('#' + id + ' .scroll');
    if (sc) sc.scrollTop = 0;
    if (id === 's-home') renderHome();
    if (id === 's-dex') renderDex();
    if (id === 's-settings') renderSettingsProfile();
    try {
      if (id === 's-home') history.replaceState({ scr: id }, ''); else history.pushState({ scr: id }, '');
    } catch (e) {}
  }
  function goProfiles(mode) { renderProfiles(mode); go('s-profiles'); }
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-go]');
    if (t) { sfx.tap(); go(t.getAttribute('data-go')); }
    const c = e.target.closest('[data-close]');
    if (c) closeSheet();
  });
  window.addEventListener('popstate', function () {
    if ($('#sheet').classList.contains('on')) { closeSheet(); return; }
    if (current === 's-profiles' && !ACTIVE) {
      // sem perfil escolhido ainda: não deixa "voltar" sair dessa tela
      try { history.pushState({ scr: 's-profiles' }, ''); } catch (e) {}
      return;
    }
    if (current !== 's-home') { $$('.screen').forEach(function (s) { s.classList.toggle('on', s.id === 's-home'); }); current = 's-home'; renderHome(); }
  });

  /* ==================== FOLHA (modal) ==================== */
  function openSheet(html) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').classList.add('on');
    try { history.pushState({ sheet: 1 }, ''); } catch (e) {}
  }
  function closeSheet() { $('#sheet').classList.remove('on'); }

  /* ==================== PERFIS (UI) ==================== */
  let profilesMode = 'forced';

  function renderProfiles(mode) {
    profilesMode = mode;
    $('#profiles-back').style.visibility = mode === 'switch' ? 'visible' : 'hidden';
    $('#profiles-title').textContent = mode === 'switch' ? 'Trocar de perfil' : 'Quem vai jogar?';

    const box = $('#profiles-grid');
    box.innerHTML = '';
    PROFILES.forEach(function (p) {
      const stats = peekStats(p.id);
      const b = el('button', 'profcard' + (p.id === ACTIVE ? ' cur' : ''));
      b.innerHTML =
        '<div class="pavatar">' + p.emoji + '</div>' +
        '<b>' + escapeHtml(p.name) + '</b>' +
        '<span>' + stats.words + ' palavra' + (stats.words === 1 ? '' : 's') + (stats.stars ? ' · ' + stats.stars + '⭐' : '') + '</span>' +
        '<div class="pedit" data-edit="' + p.id + '">✏️</div>';
      b.onclick = function (e) {
        if (e.target.closest('.pedit')) return;
        sfx.tap(); selectProfile(p.id);
      };
      box.appendChild(b);
    });
    const add = el('button', 'profcard add');
    add.innerHTML = '<div class="pavatar">➕</div><b>Novo perfil</b><span>criar</span>';
    add.onclick = function () { sfx.tap(); openProfileEditor(null); };
    box.appendChild(add);

    Array.prototype.forEach.call(box.querySelectorAll('[data-edit]'), function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        sfx.tap();
        const id = btn.getAttribute('data-edit');
        const p = PROFILES.filter(function (pp) { return pp.id === id; })[0];
        if (p) openProfileEditor(p);
      };
    });
  }

  function selectProfile(id) {
    switchProfile(id);
    hello();
    go('s-home');
  }

  function renderSettingsProfile() {
    const p = PROFILES.filter(function (pp) { return pp.id === ACTIVE; })[0];
    $('#settings-prof-name').textContent = p ? (p.emoji + ' ' + p.name) : '—';
  }

  function openProfileEditor(profile) {
    const isNew = !profile;
    let chosen = profile ? profile.emoji : pick(EMOJIS);
    const html =
      '<h3 style="margin:0 0 4px">' + (isNew ? 'Novo perfil' : 'Editar perfil') + '</h3>' +
      '<p style="color:var(--ink-soft);font-weight:700;font-size:.85rem;margin:0">Escolha um nome e um desenho</p>' +
      '<input class="typein" id="prof-name" maxlength="18" placeholder="Nome" value="' + (profile ? escapeHtml(profile.name) : '') + '" style="margin-top:12px">' +
      '<div class="emojpick" id="prof-emoji"></div>' +
      '<button class="btn primary" id="prof-save">Salvar</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn ghost" id="prof-delete" style="color:var(--red)">Excluir perfil</button>') +
      '<div style="height:10px"></div><button class="btn ghost" data-close="1">Cancelar</button>';
    openSheet(html);

    const grid = $('#prof-emoji');
    EMOJIS.forEach(function (em) {
      const b = el('button', em === chosen ? 'on' : '', em);
      b.onclick = function () {
        chosen = em;
        Array.prototype.forEach.call(grid.children, function (c) { c.classList.toggle('on', c.textContent === em); });
        sfx.tap();
      };
      grid.appendChild(b);
    });

    const nameInput = $('#prof-name');
    setTimeout(function () { try { nameInput.focus(); } catch (e) {} }, 250);
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#prof-save').click(); });

    $('#prof-save').onclick = function () {
      const name = nameInput.value.trim().slice(0, 18) || 'Jogador';
      if (isNew) {
        const p = createProfile(name, chosen);
        closeSheet();
        selectProfile(p.id);
      } else {
        updateProfile(profile.id, { name: name, emoji: chosen });
        closeSheet();
        renderProfiles(profilesMode);
        if (ACTIVE === profile.id) hello();
      }
    };

    if (!isNew) {
      $('#prof-delete').onclick = function () { openConfirmDeleteProfile(profile); };
    }
  }

  function openConfirmDeleteProfile(profile) {
    openSheet('<div style="text-align:center;padding:8px 6px">' +
      '<div style="font-size:2.4rem">⚠️</div>' +
      '<h3 style="margin:8px 0 4px">Excluir "' + escapeHtml(profile.name) + '"?</h3>' +
      '<p style="color:var(--ink-soft);font-weight:700;font-size:.9rem">Todo o progresso desse perfil será perdido, sem volta.</p>' +
      '<button class="btn" id="do-del-prof" style="margin-top:12px;color:var(--red)">Sim, excluir</button>' +
      '<div style="height:10px"></div><button class="btn ghost" data-close="1">Cancelar</button></div>');
    $('#do-del-prof').onclick = function () {
      const wasActive = ACTIVE === profile.id;
      deleteProfile(profile.id);
      closeSheet();
      if (wasActive) {
        S = JSON.parse(JSON.stringify(DEFAULT));
        if (PROFILES.length) selectProfile(PROFILES[0].id);
        else renderProfiles('forced');
      } else {
        renderProfiles(profilesMode);
      }
    };
  }

  $('#btn-profile').onclick = function () { sfx.tap(); goProfiles('switch'); };
  $('#btn-switch-profile').onclick = function () { sfx.tap(); goProfiles('switch'); };
  $('#profiles-back').onclick = function () { sfx.tap(); if (profilesMode === 'switch') go('s-home'); };

  /* ==================== HOME ==================== */
  function levelState(lv, idx) {
    const rec = S.levels[lv.id] || {};
    let unlocked = idx === 0;
    if (idx > 0) {
      const prev = S.levels[LEVELS[idx - 1].id];
      unlocked = !!(prev && prev.stars >= 1);
    }
    return { rec: rec, unlocked: unlocked, stars: rec.stars || 0, learned: !!rec.learned };
  }

  function renderHome() {
    const activeProf = PROFILES.filter(function (p) { return p.id === ACTIVE; })[0];
    $('#btn-profile').textContent = activeProf ? activeProf.emoji : '🙂';
    $('#btn-profile').setAttribute('aria-label', activeProf ? ('Perfil: ' + activeProf.name) : 'Trocar de perfil');

    const x = xpLevel();
    $('#xpfill').style.width = Math.round((x.cur / x.need) * 100) + '%';
    $('#xplevel').textContent = 'Nível ' + x.lv;
    $('#xptext').textContent = x.cur + ' / ' + x.need + ' XP';
    $('#st-words').textContent = known().length;
    $('#st-streak').textContent = S.streak.n;
    $('#st-score').textContent = S.score;

    const due = dueItems().length;
    $('#review-count').textContent = due ? (due + ' palavra' + (due > 1 ? 's' : '')) : 'tudo em dia';

    const box = $('#levels');
    box.innerHTML = '';
    LEVELS.forEach(function (lv, idx) {
      const st = levelState(lv, idx);
      const b = el('button', 'level' + (st.unlocked ? '' : ' locked'));
      const words = lv.boss ? ITEMS.length : lv.items.length;
      const starTxt = st.stars ? '⭐'.repeat(st.stars) + '☆'.repeat(3 - st.stars) : '☆☆☆';
      b.innerHTML =
        '<div class="lvicon" style="background:' + lv.color + '">' + lv.emoji + '</div>' +
        '<div class="lvtxt"><b>' + lv.id + '. ' + lv.name + '</b>' +
        '<span>' + words + ' palavras</span>' +
        '<div class="stars">' + (st.unlocked ? starTxt : '') + '</div></div>' +
        (st.unlocked ? '' : '<div class="lock">🔒</div>') +
        (st.unlocked && !st.learned ? '<div class="badge-new">NOVA</div>' : '');
      b.onclick = function () {
        sfx.tap();
        if (!st.unlocked) {
          openSheet('<div style="text-align:center;padding:10px 6px 4px">' +
            '<div style="font-size:2.4rem">🔒</div>' +
            '<h3 style="margin:8px 0 4px">Fase bloqueada</h3>' +
            '<p style="color:var(--ink-soft);font-weight:700;font-size:.9rem">Ganhe pelo menos 1 estrela na fase ' + (LEVELS[idx - 1].id) + ' para liberar esta.</p>' +
            '<button class="btn ghost" data-close="1" style="margin-top:12px">Ok</button></div>');
          return;
        }
        openLevelSheet(lv, st);
      };
      box.appendChild(b);
    });
  }

  function openLevelSheet(lv, st) {
    const items = lv.items.map(function (id) { return BY_ID[id]; });
    const preview = items.slice(0, 12).map(function (i) {
      return '<div class="gcell" style="box-shadow:none;padding:4px 2px 6px"><div class="artbox mini">' +
        ART.render(i) + '</div><b>' + i.en + '</b><span>' + i.pt + '</span></div>';
    }).join('');
    openSheet(
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">' +
      '<div class="lvicon" style="background:' + lv.color + '">' + lv.emoji + '</div>' +
      '<div><b style="font-size:1.1rem">' + lv.name + '</b>' +
      '<div style="font-size:.8rem;color:var(--ink-soft);font-weight:700">' + items.length + ' palavras' +
      (st.stars ? ' • ' + '⭐'.repeat(st.stars) : '') + '</div></div></div>' +
      '<div class="grid" style="margin:14px 0">' + preview + '</div>' +
      (items.length > 12 ? '<div style="text-align:center;font-size:.78rem;color:var(--ink-soft);font-weight:700;margin-bottom:12px">+ ' + (items.length - 12) + ' outras</div>' : '') +
      '<button class="btn ' + (st.learned ? 'ghost' : 'primary') + '" id="sh-learn">📚 Aprender as palavras</button>' +
      '<div style="height:10px"></div>' +
      '<button class="btn ' + (st.learned ? 'primary' : 'ghost') + '" id="sh-play">🎮 Jogar a fase</button>'
    );
    $('#sh-learn').onclick = function () { closeSheet(); startLearn(lv); };
    $('#sh-play').onclick = function () { closeSheet(); startPlay(lv, items); };
  }

  /* ==================== APRENDER (flashcards) ==================== */
  let learn = null;

  function startLearn(lv) {
    learn = { lv: lv, items: lv.items.map(function (id) { return BY_ID[id]; }).slice(0, 12), i: 0 };
    $('#learn-title').textContent = lv ? lv.name : 'Aprender';
    go('s-learn');
    renderLearn();
  }

  function cardHtml(it, big) {
    const cat = CATS[it.cat];
    return '<div class="artbox pop">' + ART.render(it) + '</div>' +
      '<div style="text-align:center">' +
      '<span class="pill" style="background:' + cat.color + '">' + cat.label + '</span>' +
      '<div class="word">' + it.en + '</div>' +
      '<div class="phon">🔊 ' + it.ph + '</div>' +
      '<div class="ptword">' + it.pt + '</div>' +
      '</div>' +
      '<div class="sep"></div>' +
      '<div class="exline">' + it.ex + '<small>' + it.exPt + '</small></div>' +
      (it.note ? '<div class="note">💡 ' + it.note + '</div>' : '') +
      (big ? '' : '');
  }

  function renderLearn() {
    const it = learn.items[learn.i];
    const dots = learn.items.map(function (_, i) {
      return '<i class="' + (i === learn.i ? 'on' : (i < learn.i ? 'done' : '')) + '"></i>';
    }).join('');
    $('#learn-dots').innerHTML = dots;
    $('#learn-card').innerHTML =
      cardHtml(it) +
      '<div style="display:flex;justify-content:center;margin-top:16px"><button class="speak" id="learn-speak">🔊</button></div>' +
      '<div style="text-align:center;font-size:.74rem;color:var(--ink-soft);font-weight:700;margin-top:8px">toque para ouvir e repita em voz alta</div>';
    $('#learn-speak').onclick = function () { say(it.en); buzz(10); };
    $('#learn-prev').style.visibility = learn.i === 0 ? 'hidden' : 'visible';
    $('#learn-next').textContent = learn.i === learn.items.length - 1 ? 'Jogar agora 🎮' : 'Próxima';
    say(it.en);
    // marca como visto (força bem baixa até acertar no jogo)
    srs(it.id);
  }

  $('#learn-next').onclick = function () {
    sfx.tap();
    if (learn.i < learn.items.length - 1) { learn.i++; renderLearn(); }
    else {
      const lv = learn.lv;
      if (lv) {
        S.levels[lv.id] = Object.assign({ stars: 0, best: 0 }, S.levels[lv.id], { learned: true });
        save();
        startPlay(lv, lv.items.map(function (id) { return BY_ID[id]; }));
      } else go('s-home');
    }
  };
  $('#learn-prev').onclick = function () { sfx.tap(); if (learn.i > 0) { learn.i--; renderLearn(); } };

  /* ==================== JOGO ==================== */
  let G = null;

  const TYPES_RECOG = ['pick-name', 'pick-art', 'listen', 'shadow', 'pt2en', 'en2pt'];

  function buildQuestions(items, opts) {
    opts = opts || {};
    const pool = items.slice();
    const qs = [];
    const hard = !!opts.hard;

    // 1ª passagem: reconhecer
    shuffle(pool).forEach(function (it, n) {
      let t;
      const str = strength(it.id);
      if (str < 20) t = n % 2 ? 'pick-name' : 'listen';
      else t = pick(hard ? ['shadow', 'listen', 'pt2en', 'en2pt', 'pick-art'] : TYPES_RECOG);
      qs.push(makeQ(t, it, items));
    });

    // 2ª passagem: produzir (escrever)
    shuffle(pool).forEach(function (it) {
      const str = strength(it.id);
      const useType = S.set.typing || (hard && str >= 50);
      qs.push(makeQ(useType ? 'type' : 'spell', it, items));
    });

    return qs.slice(0, Math.max(8, Math.min(24, qs.length)));
  }

  function distractors(it, from, n) {
    let pool = from.filter(function (o) { return o.id !== it.id; });
    const same = pool.filter(function (o) { return o.cat === it.cat; });
    if (same.length >= n) pool = same;
    if (pool.length < n) {
      pool = pool.concat(ITEMS.filter(function (o) {
        return o.id !== it.id && pool.indexOf(o) < 0;
      }));
    }
    return shuffle(pool).slice(0, n);
  }

  function makeQ(type, it, from) {
    const q = { type: type, item: it };
    if (type !== 'spell' && type !== 'type') {
      q.opts = shuffle(distractors(it, from, 3).concat([it]));
    }
    return q;
  }

  function startPlay(lv, items, opts) {
    opts = opts || {};
    G = {
      lv: lv, items: items,
      qs: buildQuestions(items, { hard: !!(lv && lv.boss) || !!opts.hard }),
      i: 0, score: 0, streak: 0, best: 0,
      right: 0, total: 0, missed: [], answered: false, title: opts.title || (lv ? lv.name : 'Treino'),
    };
    G.count = G.qs.length;
    go('s-play');
    nextQ();
  }

  $('#play-quit').onclick = function () {
    sfx.tap();
    hideFb();
    go('s-home');
  };

  function nextQ() {
    hideFb();
    G.answered = false;
    if (G.i >= G.qs.length) return finish();
    const q = G.qs[G.i];
    $('#play-progress').style.width = Math.round((G.i / G.count) * 100) + '%';
    $('#play-score').textContent = G.score;
    $('#play-combo').textContent = G.streak >= 3 ? '🔥 ' + G.streak + ' seguidos • x' + mult().toFixed(1) : '';
    renderQ(q);
  }

  function mult() { return Math.min(3, 1 + Math.floor(G.streak / 3) * 0.5); }

  function renderQ(q) {
    const body = $('#play-body');
    const foot = $('#play-foot');
    foot.innerHTML = '';
    body.innerHTML = '';
    const it = q.item;

    const ttl = el('div', 'qtitle');
    const stage = el('div', 'qstage');

    if (q.type === 'pick-name') {
      ttl.innerHTML = 'Qual é o nome <b>em inglês</b>?';
      stage.innerHTML = '<div class="artbox pop">' + ART.render(it) + '</div>';
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(optionButtons(q, function (o) { return o.en; }));

    } else if (q.type === 'shadow') {
      ttl.innerHTML = 'Só pela <b>sombra</b>: o que é isso?';
      stage.innerHTML = '<div class="artbox pop">' + ART.render(it, { silhouette: true }) + '</div>';
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(optionButtons(q, function (o) { return o.en; }));

    } else if (q.type === 'pick-art') {
      ttl.innerHTML = 'Toque na imagem certa';
      stage.innerHTML = '<div class="bigword">' + it.en + '</div><div class="phon">' + it.ph + '</div>';
      const sp = el('button', 'speak', '🔊');
      sp.style.marginTop = '10px';
      sp.onclick = function () { say(it.en); };
      stage.appendChild(sp);
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(artOptions(q));
      say(it.en);

    } else if (q.type === 'listen') {
      ttl.innerHTML = '<b>Ouça</b> e toque na imagem';
      const sp = el('button', 'speak', '🔊');
      sp.style.cssText = 'width:88px;height:88px;font-size:2.2rem;margin:10px auto';
      sp.onclick = function () { say(it.en, 0.75); buzz(8); };
      stage.appendChild(sp);
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(artOptions(q));
      setTimeout(function () { say(it.en, 0.8); }, 220);

    } else if (q.type === 'pt2en') {
      ttl.innerHTML = 'Como se diz em <b>inglês</b>?';
      stage.innerHTML = '<div class="bigword pt">' + it.pt + '</div>';
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(optionButtons(q, function (o) { return o.en; }));

    } else if (q.type === 'en2pt') {
      ttl.innerHTML = 'O que significa?';
      stage.innerHTML = '<div class="bigword">' + it.en + '</div>';
      const sp = el('button', 'speak', '🔊');
      sp.style.marginTop = '10px';
      sp.onclick = function () { say(it.en); };
      stage.appendChild(sp);
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(optionButtons(q, function (o) { return o.pt; }));
      say(it.en);

    } else if (q.type === 'spell') {
      ttl.innerHTML = '<b>Escreva</b> em inglês';
      stage.innerHTML = '<div class="artbox" style="max-width:150px">' + ART.render(it) + '</div>' +
        '<div class="ptword" style="font-size:1.15rem">' + it.pt + '</div>';
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(spellUI(q, foot));

    } else if (q.type === 'type') {
      ttl.innerHTML = '<b>Digite</b> em inglês';
      stage.innerHTML = '<div class="artbox" style="max-width:140px">' + ART.render(it) + '</div>' +
        '<div class="ptword" style="font-size:1.15rem">' + it.pt + '</div>';
      body.appendChild(ttl); body.appendChild(stage);
      body.appendChild(typeUI(q, foot));
    }
  }

  function optionButtons(q, label) {
    const wrap = el('div', 'opts');
    q.opts.forEach(function (o) {
      const b = el('button', 'opt', label(o));
      b.onclick = function () {
        if (G.answered) return;
        answer(q, o.id === q.item.id, b, wrap, function (n) { return n.textContent === label(q.item); });
      };
      wrap.appendChild(b);
    });
    return wrap;
  }

  function artOptions(q) {
    const wrap = el('div', 'opts two');
    q.opts.forEach(function (o) {
      const b = el('button', 'opt art', '<div class="artbox">' + ART.render(o) + '</div>');
      b.dataset.id = o.id;
      b.onclick = function () {
        if (G.answered) return;
        answer(q, o.id === q.item.id, b, wrap, function (n) { return n.dataset.id === q.item.id; });
      };
      wrap.appendChild(b);
    });
    return wrap;
  }

  /* ---- soletrar com letrinhas ---- */
  function spellUI(q, foot) {
    const target = q.item.en.toUpperCase();
    const wrap = el('div');
    const slots = el('div', 'slots');
    const tiles = el('div', 'tiles');
    const filled = [];

    const letters = target.replace(/[^A-Z]/g, '').split('');
    const extra = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const bag = shuffle(letters.concat(shuffle(extra).slice(0, Math.min(4, Math.max(2, 10 - letters.length)))));

    // só confere quando você mandar — dá para apagar e trocar as letras à vontade
    const okBtn = el('button', 'btn primary', 'Conferir');
    okBtn.onclick = function () { if (firstEmpty() < 0) check(); };
    foot.appendChild(okBtn);

    function draw() {
      slots.innerHTML = '';
      let li = 0;
      target.split('').forEach(function (ch) {
        if (ch === ' ' || ch === '-') { slots.appendChild(el('div', 'slot space')); return; }
        const v = filled[li];
        const s = el('div', 'slot' + (v ? '' : ' empty'), v || '');
        const idx = li;
        if (v) s.onclick = function () { if (G.answered) return; clear(idx); };
        slots.appendChild(s);
        li++;
      });
      const done = firstEmpty() < 0;
      okBtn.disabled = !done;
      okBtn.classList.toggle('off', !done);
      okBtn.textContent = done ? 'Conferir' : 'Faltam letras…';
      back.classList.toggle('off', !filled.some(function (c) { return c; }));
    }
    function clear(i) {
      filled[i] = null;
      sfx.tap(); buzz(6);
      usedFix(); draw();
    }
    function lastFilled() {
      for (let i = letters.length - 1; i >= 0; i--) if (filled[i]) return i;
      return -1;
    }
    function usedFix() {
      // recalcula quais peças estão usadas
      const counts = {};
      filled.forEach(function (c) { if (c) counts[c] = (counts[c] || 0) + 1; });
      const seen = {};
      Array.prototype.forEach.call(tiles.children, function (t) {
        const c = t.textContent;
        seen[c] = (seen[c] || 0);
        if (seen[c] < (counts[c] || 0)) { t.classList.add('used'); seen[c]++; }
        else t.classList.remove('used');
      });
    }
    function firstEmpty() {
      const n = letters.length;
      for (let i = 0; i < n; i++) if (!filled[i]) return i;
      return -1;
    }
    bag.forEach(function (ch) {
      const t = el('button', 'tile', ch);
      t.onclick = function () {
        if (G.answered) return;
        const i = firstEmpty();
        if (i < 0) return;
        filled[i] = ch;
        sfx.tap(); buzz(6);
        usedFix(); draw();
      };
      tiles.appendChild(t);
    });

    function check() {
      const good = filled.join('') === letters.join('');
      // marca letra por letra: dá para ver exatamente onde errou
      let li = 0;
      Array.prototype.forEach.call(slots.children, function (s) {
        if (s.classList.contains('space')) return;
        s.classList.add(filled[li] === letters[li] ? 'ok' : 'bad');
        li++;
      });
      okBtn.classList.add('off');
      if (!good) {
        // depois de um instante, mostra a grafia certa no lugar
        setTimeout(function () {
          let j = 0;
          Array.prototype.forEach.call(slots.children, function (s) {
            if (s.classList.contains('space')) return;
            s.textContent = letters[j];
            s.classList.remove('bad', 'empty');
            s.classList.add('ok');
            j++;
          });
        }, 900);
      }
      setTimeout(function () {
        answer(q, good, null, null, null);
      }, good ? 180 : 420);
    }

    const hint = el('div', 'hintrow');
    const back = el('button', 'btn ghost sm', '⌫ Apagar');
    back.onclick = function () {
      if (G.answered) return;
      const i = lastFilled();
      if (i >= 0) clear(i);
    };
    const hb = el('button', 'btn ghost sm', '💡 Dica');
    hb.onclick = function () {
      if (G.answered) return;
      const i = firstEmpty();
      if (i < 0) return;
      filled[i] = letters[i];
      sfx.tap();
      usedFix(); draw();
    };
    const sb = el('button', 'btn ghost sm', '🔊 Ouvir');
    sb.onclick = function () { say(q.item.en); };
    [back, hb, sb].forEach(function (b) { b.style.maxWidth = '120px'; hint.appendChild(b); });

    wrap.appendChild(slots);
    wrap.appendChild(tiles);
    wrap.appendChild(hint);
    wrap.appendChild(el('div', 'tip', 'toque numa letra do quadro para apagar'));
    draw();
    return wrap;
  }

  /* ---- digitar com o teclado ---- */
  function typeUI(q, foot) {
    const wrap = el('div');
    const inp = el('input', 'typein');
    inp.type = 'text';
    inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false;
    inp.placeholder = q.item.en.replace(/[A-Za-z]/g, '_').replace(/^_/, q.item.en[0]);
    wrap.style.marginTop = '18px';
    wrap.appendChild(inp);

    const row = el('div', 'hintrow');
    const sb = el('button', 'btn ghost sm', '🔊 Ouvir');
    sb.style.maxWidth = '140px';
    sb.onclick = function () { say(q.item.en); };
    row.appendChild(sb);
    wrap.appendChild(row);

    const btn = el('button', 'btn primary', 'Conferir');
    btn.onclick = function () {
      if (G.answered) return;
      const norm = function (s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); };
      const good = norm(inp.value) === norm(q.item.en);
      inp.blur();
      answer(q, good, null, null, null);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    foot.appendChild(btn);
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 250);
    return wrap;
  }

  /* ---- resposta ---- */
  function answer(q, good, node, wrap, isRight, after) {
    if (G.answered) return;
    G.answered = true;
    G.total++;
    const it = q.item;

    if (wrap && isRight) {
      Array.prototype.forEach.call(wrap.children, function (n) {
        if (isRight(n)) n.classList.add('correct');
        else if (n === node) n.classList.add('wrong');
        else n.classList.add('dim');
      });
    }

    grade(it.id, good);

    if (good) {
      G.right++;
      G.streak++;
      G.best = Math.max(G.best, G.streak);
      const base = (q.type === 'spell' || q.type === 'type') ? 20 : 10;
      const pts = Math.round(base * mult());
      G.score += pts;
      S.score += pts;
      addXp(5);
      sfx.ok(); buzz(14);
      floatPoints('+' + pts);
      $('#play-score').textContent = G.score;
      say(it.en);
      showFb(true, it, q);
      setTimeout(function () { if (after) after(); advance(); }, 950);
    } else {
      G.streak = 0;
      if (G.missed.indexOf(it.id) < 0) G.missed.push(it.id);
      sfx.no(); buzz([30, 40, 30]);
      $('#play-body').classList.add('shake');
      setTimeout(function () { $('#play-body').classList.remove('shake'); }, 400);
      // reforço: a palavra errada volta no fim da rodada
      if (G.qs.length < G.count + 6) G.qs.push(makeQ(pick(['pick-name', 'listen', 'spell']), it, G.items));
      showFb(false, it, q);
      $('#fb-next').onclick = function () { if (after) after(); advance(); };
    }
    save();
  }

  function advance() { G.i++; nextQ(); }

  function showFb(good, it, q) {
    const fb = $('#fb');
    fb.className = 'fb on ' + (good ? 'good' : 'bad');
    $('#fb-em').textContent = good ? pick(['✅', '🎉', '🌟', '👏']) : '💡';
    $('#fb-title').textContent = good ? pick(['Isso!', 'Muito bem!', 'Perfeito!', 'Boa!']) : it.en;
    $('#fb-sub').innerHTML = good
      ? '<b>' + it.en + '</b> = ' + it.pt + ' · ' + it.ph
      : 'é <b>' + it.pt + '</b> · fala-se <b>' + it.ph + '</b>';
    $('#fb-speak').onclick = function () { say(it.en); };
    $('#fb-next').classList.toggle('hidden', !!good);
    if (!good) say(it.en);
  }
  function hideFb() { $('#fb').className = 'fb'; }

  function floatPoints(txt) {
    const n = el('div', 'plusone', txt);
    n.style.left = (window.innerWidth / 2 - 20) + 'px';
    n.style.top = (window.innerHeight * 0.42) + 'px';
    document.body.appendChild(n);
    setTimeout(function () { n.remove(); }, 900);
  }

  /* ==================== FIM DA RODADA ==================== */
  function finish() {
    const acc = G.total ? G.right / G.total : 0;
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : acc >= 0.5 ? 1 : 0;
    addXp(20 + stars * 10);

    if (G.lv) {
      const rec = S.levels[G.lv.id] || { stars: 0, best: 0 };
      rec.stars = Math.max(rec.stars || 0, stars);
      rec.best = Math.max(rec.best || 0, G.score);
      rec.learned = true;
      S.levels[G.lv.id] = rec;
    }
    bumpStreak();
    save();

    $('#res-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    $('#res-score').textContent = G.score;
    $('#res-sub').textContent = 'pontos • ' + Math.round(acc * 100) + '% de acerto';
    $('#res-card').innerHTML =
      '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:.9rem;margin-bottom:6px">' +
      '<span>Acertos</span><span>' + G.right + ' / ' + G.total + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:.9rem;margin-bottom:6px">' +
      '<span>Melhor sequência</span><span>🔥 ' + G.best + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-weight:800;font-size:.9rem">' +
      '<span>XP ganho</span><span>+' + (G.right * 5 + 20 + stars * 10) + '</span></div>';

    const miss = $('#res-miss');
    if (G.missed.length) {
      miss.innerHTML = '<div class="secttl">Para revisar</div>' + G.missed.map(function (id) {
        const it = BY_ID[id];
        return '<div class="missitem"><div class="artbox">' + ART.render(it) + '</div>' +
          '<div style="flex:1"><b>' + it.en + '</b><span>' + it.pt + ' · ' + it.ph + '</span></div></div>';
      }).join('') + '<div class="misslist"></div>';
    } else {
      miss.innerHTML = '<div class="empty">Nenhum erro. Impecável! 🏆</div>';
    }

    // próxima fase
    const idx = G.lv ? LEVELS.indexOf(G.lv) : -1;
    const nxt = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
    const btnNext = $('#res-next');
    if (nxt && stars >= 1) {
      btnNext.textContent = 'Próxima fase: ' + nxt.name + ' →';
      btnNext.onclick = function () { sfx.tap(); startLearn(nxt); };
      btnNext.classList.remove('hidden');
    } else if (nxt) {
      btnNext.textContent = 'Tentar de novo para liberar a próxima';
      btnNext.onclick = function () { sfx.tap(); replay(); };
    } else {
      btnNext.textContent = 'Voltar ao início';
      btnNext.onclick = function () { sfx.tap(); go('s-home'); };
    }
    $('#res-again').onclick = function () { sfx.tap(); replay(); };

    go('s-result');
    if (stars >= 2) { sfx.win(); confetti(); } else sfx.ok();
  }

  function replay() {
    if (G.lv) startPlay(G.lv, G.items);
    else startPlay(null, G.items, { title: G.title });
  }

  function bumpStreak() {
    const t = dayKey();
    if (S.streak.last === t) return;
    const y = dayKey(new Date(Date.now() - DAY));
    S.streak.n = (S.streak.last === y) ? S.streak.n + 1 : 1;
    S.streak.last = t;
  }

  function confetti() {
    const box = $('#confetti');
    const cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#f76707', '#e599f7'];
    for (let i = 0; i < 60; i++) {
      const b = el('b');
      b.style.left = Math.random() * 100 + 'vw';
      b.style.top = '-20px';
      b.style.background = pick(cols);
      b.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      b.style.animationDelay = (Math.random() * 0.5) + 's';
      b.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      box.appendChild(b);
      setTimeout(function () { b.remove(); }, 3600);
    }
  }

  /* ==================== REVISÃO / TREINO LIVRE ==================== */
  $('#btn-review').onclick = function () {
    sfx.tap();
    let list = dueItems();
    if (!list.length) {
      const k = known();
      if (!k.length) {
        openSheet('<div style="text-align:center;padding:8px 6px"><div style="font-size:2.4rem">🌱</div>' +
          '<h3 style="margin:8px 0 4px">Comece pela fase 1</h3>' +
          '<p style="color:var(--ink-soft);font-weight:700;font-size:.9rem">A revisão usa as palavras que você já estudou.</p>' +
          '<button class="btn primary" data-close="1" style="margin-top:12px">Ok</button></div>');
        return;
      }
      list = k.sort(function (a, b) { return strength(a.id) - strength(b.id); }).slice(0, 10);
    }
    list = list.slice(0, 12);
    startPlay(null, list, { title: 'Revisão', hard: true });
  };

  $('#btn-random').onclick = function () {
    sfx.tap();
    const k = known();
    const pool = k.length >= 6 ? k : LEVELS[0].items.map(function (id) { return BY_ID[id]; });
    startPlay(null, shuffle(pool).slice(0, 10), { title: 'Treino livre' });
  };

  /* ==================== DICIONÁRIO ==================== */
  let dexFilter = 'all';
  function renderDex() {
    const fl = $('#dex-filters');
    const cats = [['all', 'Tudo'], ['fruit', 'Frutas'], ['veg', 'Legumes'], ['green', 'Verduras'], ['herb', 'Temperos']];
    fl.innerHTML = cats.map(function (c) {
      return '<button class="chip' + (dexFilter === c[0] ? ' on' : '') + '" data-cat="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    Array.prototype.forEach.call(fl.children, function (b) {
      b.onclick = function () { dexFilter = b.dataset.cat; sfx.tap(); renderDex(); };
    });

    const list = ITEMS.filter(function (i) { return dexFilter === 'all' || i.cat === dexFilter; });
    const g = $('#dex-grid');
    g.innerHTML = '';
    list.forEach(function (it) {
      const st = strength(it.id);
      const c = el('button', 'gcell',
        '<div class="artbox mini">' + ART.render(it) + '</div>' +
        '<b>' + it.en + '</b><span>' + it.pt + '</span>' +
        '<div class="strength"><i style="width:' + st + '%"></i></div>');
      c.onclick = function () { sfx.tap(); openItemSheet(it); };
      g.appendChild(c);
    });
  }

  function openItemSheet(it) {
    const r = S.srs[it.id];
    openSheet(
      cardHtml(it) +
      '<div style="display:flex;gap:10px;margin-top:16px">' +
      '<button class="btn primary" id="sh-say">🔊 Ouvir</button>' +
      '<button class="btn ghost" id="sh-slow" style="flex:0 0 120px">🐢 Devagar</button></div>' +
      '<div style="margin-top:14px;font-size:.78rem;color:var(--ink-soft);font-weight:800;text-align:center">' +
      (r && r.seen ? ('memória: ' + strength(it.id) + '% · visto ' + r.seen + '× · acertos ' + r.ok) : 'ainda não estudada') +
      '</div>' +
      '<div style="height:10px"></div>' +
      '<button class="btn ghost" data-close="1">Fechar</button>'
    );
    $('#sh-say').onclick = function () { say(it.en); };
    $('#sh-slow').onclick = function () { say(it.en, 0.55); };
  }

  /* ==================== AJUSTES ==================== */
  const SWITCHES = [['#sw-sound', 'sound'], ['#sw-voice', 'voice'], ['#sw-haptic', 'haptic'], ['#sw-typing', 'typing']];
  function refreshSwitches() {
    SWITCHES.forEach(function (p) { $(p[0]).classList.toggle('on', !!S.set[p[1]]); });
  }
  function bindSwitch(id, key) {
    const n = $(id);
    n.classList.toggle('on', !!S.set[key]);
    n.onclick = function () {
      S.set[key] = S.set[key] ? 0 : 1;
      n.classList.toggle('on', !!S.set[key]);
      save(); sfx.tap(); buzz(10);
      if (key === 'voice' && S.set.voice) say('Apple');
    };
  }
  SWITCHES.forEach(function (p) { bindSwitch(p[0], p[1]); });

  $('#btn-reset').onclick = function () {
    openSheet('<div style="text-align:center;padding:8px 6px"><div style="font-size:2.4rem">⚠️</div>' +
      '<h3 style="margin:8px 0 4px">Apagar o progresso deste perfil?</h3>' +
      '<p style="color:var(--ink-soft);font-weight:700;font-size:.9rem">Pontos, estrelas e memória das palavras deste perfil serão perdidos. Os outros perfis não são afetados.</p>' +
      '<button class="btn" id="do-reset" style="margin-top:12px;color:var(--red)">Sim, apagar</button>' +
      '<div style="height:10px"></div><button class="btn ghost" data-close="1">Cancelar</button></div>');
    $('#do-reset').onclick = function () {
      S = JSON.parse(JSON.stringify(DEFAULT));
      save(); refreshSwitches(); closeSheet(); hello(); go('s-home');
    };
  };

  /* ==================== INÍCIO ==================== */
  function hello() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Bom dia!' : h < 18 ? 'Boa tarde!' : 'Boa noite!';
    const k = known().length;
    $('#hello').textContent = k ? (g + ' Você já conhece ' + k + ' palavras.') : (g + ' Vamos aprender inglês da horta?');
  }

  // destrava o áudio no primeiro toque (iOS)
  document.addEventListener('touchstart', function once() {
    actx();
    document.removeEventListener('touchstart', once);
  }, { passive: true });

  migrateLegacy();
  ACTIVE = getActiveId();
  const activeProfile = PROFILES.filter(function (p) { return p.id === ACTIVE; })[0];
  if (activeProfile) {
    S = loadState(ACTIVE);
    hello();
    current = 's-home';
    $$('.screen').forEach(function (s) { s.classList.toggle('on', s.id === 's-home'); });
    renderHome();
    try { history.replaceState({ scr: 's-home' }, ''); } catch (e) {}
  } else {
    ACTIVE = '';
    current = 's-profiles';
    renderProfiles('forced');
    $$('.screen').forEach(function (s) { s.classList.toggle('on', s.id === 's-profiles'); });
    try { history.replaceState({ scr: 's-profiles' }, ''); } catch (e) {}
  }

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
