/* ============================================================
   SHADOW ASCENDANT — «Портальный охотник»
   Аркадный рогалик на canvas. Один файл, без зависимостей.

   Управление:
     WASD / стрелки  — движение
     Пробел          — удар
     E               — поднять тень из павшего врага
     Esc             — пауза
     1 / 2 / 3       — выбор усиления
   ============================================================ */
(() => {
  'use strict';

  /* ==========================================================
     DOM И ВВОД
     ========================================================== */

  const C = document.querySelector('#canvas');

  // Без холста играть нечем: сообщаем в консоль и выходим, а не падаем
  // с «Cannot read properties of null» на первой же строке.
  if (!C || typeof C.getContext !== 'function') {
    console.error('Shadow Ascendant: не найден <canvas id="canvas">');
    return;
  }

  const X = C.getContext('2d');

  const $ = (id) => document.getElementById(id);

  /* Опциональные элементы — тач-панель, полоса босса, баннер, оверлеи —
     могут отсутствовать в чужой разметке. Игра в этом случае продолжает
     работать, просто без этой части интерфейса, поэтому все обращения к
     элементам идут через эти безопасные обёртки. */
  const setClass = (id, className, on) => {
    const node = $(id);
    if (node) node.classList.toggle(className, on);
  };

  const show = (id) => setClass(id, 'hidden', false);
  const hide = (id) => setClass(id, 'hidden', true);

  const bind = (id, handler) => {
    const node = $(id);
    if (node) node.onclick = handler;
    return node;
  };

  const listen = (id, type, handler) => {
    const node = $(id);
    if (node) node.addEventListener(type, handler);
  };

  const K = Object.create(null); // нажатые клавиши
  let stick = null;              // вектор виртуального стика (мобильные)

  // Пользователь просил меньше движения — глушим тряску и красную вспышку.
  const REDUCED_MOTION = (() => {
    try {
      const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      return !!(mq && mq.matches);
    } catch (error) {
      return false;
    }
  })();

  /* Размер игрового мира в CSS-пикселях арены.
     Пересчитывается при ресайзе, поэтому игра одинаково
     выглядит на телефоне, планшете и мониторе. */
  let W = 960;
  let H = 600;
  let DPR = 1;

  /* ==========================================================
     КОНСТАНТЫ
     ========================================================== */

  const VERSION = '1.1.1';
  const SAVE_KEY = 'shadow-ascendant';

  const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
  const PORTAL_NAMES = [
    'РАЗЛОМ БЕЗМОЛВИЯ',
    'ЗАТОНУВШИЕ ВРАТА',
    'ЧЁРНЫЙ ЛАБИРИНТ',
    'ЦИТАДЕЛЬ ПЕПЛА',
    'ПУСТОШЬ ОСКОЛКОВ',
    'ТРОН БЕЗДНЫ'
  ];

  const MAX_FX = 420;        // предел частиц
  const CORPSE_MAX = 60;     // предел живых трупов на арене
  const CORPSE_TTL = 9;      // сколько живёт труп под подъём
  const RAISE_RANGE = 96;    // радиус подъёма тени
  const BASE_ARMY_MAX = 8;   // базовый размер армии
  const VAULT_LIMIT = 500;   // предел хранилища
  const WAVE_GAP = 1.3;      // пауза между волнами
  const SPAWN_STEP = 0.32;   // интервал появления врагов в волне
  const LEVEL_HEAL = 0.2;    // доля HP, восстанавливаемая за уровень
  const XP_GROWTH = 1.28;    // рост требования опыта
  const BOSS_MINIONS = 10;   // предел врагов, которых плодит босс
  const BOSS_HEAL = 0.3;     // доля HP, возвращаемая перед боем с боссом
  const CONTACT_SLACK = 1;   // допуск на границе касания врага
  const REACH_SLACK = 6;     // тень бьёт, не прижимаясь к цели вплотную
  const APRON = 0.5;         // гистерезис подхода (защита от «зависания» на границе)

  /* ==========================================================
     ТАБЛИЦЫ КОНТЕНТА
     ========================================================== */

  const ENEMY_TYPES = {
    soldier: {
      name: 'ОХОТНИК',
      color: '#c13c67',
      core: '#35152e',
      hp: 30,
      speed: 58,
      radius: 14,
      damage: 7,
      xp: 16
    },
    runner: {
      name: 'БЕГУН',
      color: '#d45b89',
      core: '#45182f',
      hp: 20,
      speed: 105,
      radius: 11,
      damage: 5,
      xp: 20
    },
    brute: {
      name: 'БРУТ',
      color: '#b34758',
      core: '#391821',
      hp: 90,
      speed: 37,
      radius: 20,
      damage: 13,
      xp: 28
    },
    caster: {
      name: 'ПРОКЛЯТЫЙ',
      color: '#824fc7',
      core: '#24163c',
      hp: 42,
      speed: 45,
      radius: 15,
      damage: 9,
      xp: 32
    }
  };

  const SHADOW_TYPES = {
    soldier: {
      name: 'ВОИН ТЕНИ',
      color: '#7057db',
      damage: 10,
      speed: 165,
      attackSpeed: 0.62,
      radius: 11
    },
    runner: {
      name: 'ТЕНЬ-БЕГУН',
      color: '#4c8cff',
      damage: 8,
      speed: 210,
      attackSpeed: 0.48,
      radius: 9
    },
    brute: {
      name: 'ТЕНЬ-БРУТ',
      color: '#a54de0',
      damage: 15,
      speed: 125,
      attackSpeed: 0.82,
      radius: 15
    },
    caster: {
      name: 'ТЕНЬ-ПРОКЛЯТЫЙ',
      color: '#b15cff',
      damage: 13,
      speed: 150,
      attackSpeed: 0.72,
      radius: 11
    },
    boss: {
      name: 'ТЕНЬ ХРАНИТЕЛЯ',
      color: '#ff8b4c',
      damage: 20,
      speed: 118,
      attackSpeed: 0.95,
      radius: 17
    }
  };

  const UPGRADES = [
    {
      id: 'blade',
      name: 'КЛИНОК ТЕНИ',
      desc: 'Урон удара +14',
      apply: () => { P.dmg += 14; }
    },
    {
      id: 'vitality',
      name: 'ЖИВУЧЕСТЬ',
      desc: 'Макс. HP +35 и лечение',
      apply: () => {
        P.maxHp += 35;
        P.hp = Math.min(P.maxHp, P.hp + 35);
      }
    },
    {
      id: 'step',
      name: 'ШАГ СКВОЗЬ ТЬМУ',
      desc: 'Скорость +45',
      apply: () => { P.spd += 45; }
    },
    {
      id: 'reach',
      name: 'РАЗРЫВ',
      desc: 'Дальность удара +18',
      apply: () => { P.attackRange += 18; }
    },
    {
      id: 'commander',
      name: 'КОМАНДИР ТЕНЕЙ',
      desc: 'Максимум армии +1',
      apply: () => { P.armyMax += 1; }
    },
    {
      id: 'wrath',
      name: 'ЯРОСТЬ ТЕНЕЙ',
      desc: 'Урон теней +30%',
      apply: () => { P.armyDmg += 0.3; }
    },
    {
      id: 'haste',
      name: 'ХОЛОДНЫЙ РАСЧЁТ',
      desc: 'Перезарядка удара −20%',
      apply: () => { P.attackCd = Math.max(0.12, P.attackCd * 0.8); }
    },
    {
      id: 'regen',
      name: 'ТЁМНАЯ ПЛОТЬ',
      desc: 'Регенерация +1.5 HP/с',
      apply: () => { P.regen += 1.5; }
    },
    {
      id: 'harvest',
      name: 'ЖАТВА',
      desc: 'Лечение +3 HP за убийство',
      apply: () => { P.lifesteal += 3; }
    }
  ];

  /* ==========================================================
     УТИЛИТЫ
     ========================================================== */

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  const setText = (el, value) => {
    if (el && el.textContent !== value) el.textContent = value;
  };

  const setWidth = (el, percent) => {
    if (!el) return;
    const value = `${clamp(percent, 0, 100).toFixed(1)}%`;
    if (el.style.width !== value) el.style.width = value;
  };

  const setHTML = (el, html) => {
    if (el) el.innerHTML = html;
  };

  /* Монотонное время в мс: performance.now() там, где он есть.
     В отличие от Date.now() не зависит от перевода системных часов. */
  const now = () => (typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now());

  const formatTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, '0')}`;
  };

  /* ==========================================================
     ЗВУК (WebAudio, без внешних файлов)
     ========================================================== */

  const SOUND_KEY = 'shadow-ascendant-muted';

  let muted = false;
  let audioCtx = null;

  try {
    muted = localStorage.getItem(SOUND_KEY) === '1';
  } catch (error) {
    muted = false;
  }

  function audio() {
    if (muted) return null;

    // Браузер мог закрыть контекст (нехватка памяти, фоновый режим) —
    // тогда создаём новый, иначе звук не вернётся до перезагрузки.
    if (!audioCtx || audioCtx.state === 'closed') {
      const AC = window.AudioContext || window.webkitAudioContext;

      if (!AC) {
        muted = true;
        return null;
      }

      try {
        audioCtx = new AC();
      } catch (error) {
        muted = true;
        return null;
      }
    }

    /* «suspended» — автоблокировка до жеста пользователя, «interrupted» —
       входящий звонок или фон на iOS. Будим контекст в обоих случаях. */
    if (audioCtx.state !== 'running' && typeof audioCtx.resume === 'function') {
      try {
        const pending = audioCtx.resume();
        if (pending && pending.catch) pending.catch(() => {});
      } catch (error) {
        /* старые реализации WebAudio возвращают не промис */
      }
    }

    return audioCtx;
  }

  /* Разблокировка звука: браузер разрешает старт контекста только внутри
     обработчика жеста пользователя — клик по «Войти в портал», пробел, Enter. */
  function unlockAudio() {
    audio();
  }

  /* Звук выключен — не держим «живой» аудиопоток: в фоне он стоит
     батареи и на мобильных мешает другим приложениям. */
  function suspendAudio() {
    if (!audioCtx || audioCtx.state !== 'running' || typeof audioCtx.suspend !== 'function') return;

    try {
      const pending = audioCtx.suspend();
      if (pending && pending.catch) pending.catch(() => {});
    } catch (error) {
      /* старые реализации WebAudio возвращают не промис */
    }
  }

  /* Короткий синтезированный сигнал: частота → частота за время dur. */
  function tone(from, to, dur, type, volume, delay = 0) {
    const ctx = audio();
    if (!ctx) return;

    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to !== from) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + dur + 0.03);
    } catch (error) {
      /* звук не критичен для игры */
    }
  }

  const sfx = {
    swing: () => tone(560, 240, 0.11, 'triangle', 0.045),
    hit: () => tone(190, 95, 0.08, 'square', 0.03),
    kill: () => {
      tone(330, 120, 0.18, 'sawtooth', 0.035);
      tone(95, 60, 0.26, 'sine', 0.045, 0.02);
    },
    raise: () => tone(170, 470, 0.34, 'sine', 0.045),
    level: () => {
      tone(520, 780, 0.16, 'sine', 0.045);
      tone(780, 1050, 0.24, 'sine', 0.04, 0.13);
    },
    hurt: () => tone(150, 70, 0.13, 'square', 0.04),
    deny: () => tone(200, 130, 0.12, 'square', 0.03),
    boss: () => {
      tone(72, 46, 0.9, 'sawtooth', 0.06);
      tone(140, 92, 0.7, 'triangle', 0.035, 0.05);
    },
    win: () => [523, 659, 784].forEach((f, i) => tone(f, f * 1.26, 0.3, 'sine', 0.045, i * 0.14)),
    lose: () => [300, 190].forEach((f, i) => tone(f, f * 0.5, 0.5, 'sine', 0.045, i * 0.16))
  };

  // Кнопка всегда показывает реальное состояние: audio() умеет сам
  // выключать звук, если WebAudio в этом браузере нет.
  function syncSoundButton() {
    const button = $('sound');
    if (!button) return;

    // Кнопка иконочная, поэтому и подпись, и aria-label — про действие.
    const hint = muted ? 'Включить звук' : 'Выключить звук';

    setText(button, muted ? '🔇' : '🔊');

    if (button.title !== hint) button.title = hint;
    if (button.getAttribute && button.getAttribute('aria-label') !== hint) {
      button.setAttribute('aria-label', hint);
    }
  }

  function toggleSound() {
    muted = !muted;

    try {
      localStorage.setItem(SOUND_KEY, muted ? '1' : '0');
    } catch (error) {
      /* приватный режим — просто переключаем без сохранения */
    }

    // При включении пробуем разбудить контекст прямо на жесте пользователя:
    // позже, вне обработчика клика, браузер может не разрешить старт.
    if (!muted) sfx.level();
    else suspendAudio();

    syncSoundButton();

    return muted;
  }

  /* ==========================================================
     СОХРАНЕНИЕ ПРОГРЕССА
     ========================================================== */

  function defaultMeta() {
    return { portal: 1, shadows: [], clears: 0, kills: 0, best: 1 };
  }

  function loadMeta() {
    const meta = defaultMeta();

    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (error) {
      return meta; // приватный режим — играем без сохранений
    }

    if (!raw) return meta;

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return meta; // повреждённое сохранение не должно ломать игру
    }

    if (!data || typeof data !== 'object') return meta;

    const portal = Math.floor(Number(data.portal));
    if (Number.isFinite(portal) && portal > 0) meta.portal = portal;

    const list = [];
    if (Array.isArray(data.shadows)) {
      for (const item of data.shadows) {
        if (typeof item === 'string') list.push(item);
      }
    }

    // Старый формат хранил только число теней.
    if (list.length === 0 && Number(data.vault) > 0) {
      const count = clamp(Math.floor(Number(data.vault)), 0, VAULT_LIMIT);
      for (let i = 0; i < count; i++) list.push('soldier');
    }

    meta.shadows = list.slice(0, VAULT_LIMIT);

    meta.clears = Math.max(0, Math.floor(Number(data.clears)) || 0);
    meta.kills = Math.max(0, Math.floor(Number(data.kills)) || 0);
    meta.best = Math.max(meta.portal, Math.floor(Number(data.best)) || 1);

    return meta;
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2,
        portal: meta.portal,
        shadows: meta.shadows,
        clears: meta.clears,
        kills: meta.kills,
        best: meta.best
      }));
    } catch (error) {
      /* переполнение или приватный режим — молча продолжаем */
    }
  }

  const meta = loadMeta();

  const rank = () => RANKS[clamp(Math.floor((meta.portal - 1) / 2), 0, RANKS.length - 1)];
  const portalName = () => PORTAL_NAMES[(meta.portal - 1) % PORTAL_NAMES.length];

  /* ==========================================================
     СОСТОЯНИЕ
     ========================================================== */

  const S = {
    go: false,
    pause: false,
    choice: false,

    phase: 'idle',      // idle | hunt | boss | over
    kills: 0,
    goal: 0,
    wave: 0,
    time: 0,

    enemies: [],
    corpses: [],
    army: [],
    fx: [],
    spawnQueue: [],
    deployed: [],       // типы теней, выведенных из хранилища

    boss: null,
    raiseTarget: null,
    announce: null,
    waveGap: WAVE_GAP,
    pending: 0,
    options: [],

    last: 0
  };

  const P = {};

  function resetPlayer() {
    Object.assign(P, {
      x: W / 2,
      y: H / 2,
      r: 17,
      face: 0,

      hp: 100,
      maxHp: 100,
      hurt: 0,

      lvl: 1,
      xp: 0,
      next: 50,

      dmg: 25,
      spd: 245,
      attackRange: 98,
      attackArc: 1.35,
      attackCd: 0.35,
      cd: 0,
      flash: 0,

      regen: 0,
      lifesteal: 0,
      armyMax: BASE_ARMY_MAX,
      armyDmg: 1
    });
  }

  function resetRun() {
    Object.assign(S, {
      go: true,
      pause: false,
      choice: false,

      phase: 'hunt',
      kills: 0,
      goal: 24 + meta.portal * 7,
      wave: 0,
      time: 0,

      enemies: [],
      corpses: [],
      army: [],
      fx: [],
      spawnQueue: [],
      deployed: [],

      boss: null,
      raiseTarget: null,
      announce: null,
      waveGap: WAVE_GAP,
      pending: 0,
      options: []
    });
  }

  /* ==========================================================
     ОБЪЯВЛЕНИЯ И ЭФФЕКТЫ
     ========================================================== */

  function announce(title, text = '') {
    S.announce = { title, text, t: 2.6 };
  }

  function fx(x, y, color, amount = 8) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = rand(35, 145);

      S.fx.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color,
        t: 0.5
      });
    }

    if (S.fx.length > MAX_FX) S.fx.splice(0, S.fx.length - MAX_FX);
  }

  /* ==========================================================
     ВРАГИ
     ========================================================== */

  function randomEnemyType() {
    const r = Math.random();

    if (meta.portal >= 3 && r < 0.16) return 'caster';
    if (meta.portal >= 2 && r < 0.35) return 'brute';
    if (r < 0.55) return 'runner';

    return 'soldier';
  }

  /* Чем больше теневая армия охотника, тем сильнее укрепляется
     Хранитель: бой с боссом остаётся испытанием и без армии. */
  function bossConfig() {
    const p = meta.portal;
    const armyScale = 1 + 0.15 * S.army.length;

    return {
      name: 'ХРАНИТЕЛЬ ВРАТ',
      color: '#e98d39',
      core: '#4a2614',
      hp: (560 + p * 130) * armyScale,
      speed: 56 + p * 3,
      radius: 28,
      damage: 12 + p * 1.4,
      xp: 60
    };
  }

  /* Точка появления: подальше от игрока и внутри арены. */
  function spawnPoint(radius) {
    let best = null;

    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const length = rand(0.34, 0.55) * Math.min(W, H);

      const x = clamp(P.x + Math.cos(angle) * length, radius + 6, W - radius - 6);
      const y = clamp(P.y + Math.sin(angle) * length, radius + 6, H - radius - 6);
      const d = Math.hypot(x - P.x, y - P.y);

      if (!best || d > best.d) best = { x, y, d };
    }

    // Если арена тесная — уходим в самый дальний угол.
    if (best.d < 130) {
      best.x = clamp(P.x < W / 2 ? W - radius - 8 : radius + 8, radius, W - radius);
      best.y = clamp(P.y < H / 2 ? H - radius - 8 : radius + 8, radius, H - radius);
    }

    return best;
  }

  function spawn(type) {
    const key = type === 'boss' ? 'boss' : (ENEMY_TYPES[type] ? type : randomEnemyType());
    const isBoss = key === 'boss';
    const cfg = isBoss ? bossConfig() : ENEMY_TYPES[key];

    const step = Math.max(0, meta.portal - 1);
    const hpScale = isBoss ? 1 : 1 + step * 0.12;
    const damageScale = isBoss ? 1 : 1 + step * 0.05;
    const speedScale = isBoss ? 1 : 1 + step * 0.03;

    const point = spawnPoint(cfg.radius);
    const hp = cfg.hp * hpScale;

    const enemy = {
      type: key,
      boss: isBoss,

      name: cfg.name,
      color: cfg.color,
      core: cfg.core,

      x: point.x,
      y: point.y,
      r: cfg.radius,

      hp,
      max: hp,

      speed: cfg.speed * speedScale,
      damage: cfg.damage * damageScale,
      xp: cfg.xp,

      hit: 0,
      summon: 6
    };

    S.enemies.push(enemy);

    if (isBoss) S.boss = enemy;

    fx(enemy.x, enemy.y, isBoss ? '#ffb05e' : '#ef4d8d', isBoss ? 26 : 8);

    return enemy;
  }

  function queueWave() {
    S.wave++;
    S.waveGap = WAVE_GAP;

    const amount = 4 + S.wave * 2 + Math.floor(meta.portal * 0.6);

    for (let i = 0; i < amount; i++) {
      S.spawnQueue.push({ at: i * SPAWN_STEP, type: null });
    }

    if (S.wave === 1) {
      announce(`РАНГ ${rank()} · ${portalName()}`, `Цель: ${S.goal} существ, затем Хранитель врат`);
    } else {
      announce(`ВОЛНА ${S.wave}`, `Появилось врагов: ${amount}`);
    }
  }

  function updateSpawns(dt) {
    if (S.spawnQueue.length === 0) return;

    let ready = null;

    for (const item of S.spawnQueue) {
      item.at -= dt;
      if (item.at <= 0) (ready ||= []).push(item);
    }

    if (!ready) return;

    S.spawnQueue = S.spawnQueue.filter((item) => item.at > 0);

    for (const item of ready) spawn(item.type);
  }

  function startBossPhase() {
    S.phase = 'boss';

    // Перед решающим боем охотник переводит дыхание.
    const heal = P.maxHp * BOSS_HEAL;
    P.hp = Math.min(P.maxHp, P.hp + heal);

    const boss = spawn('boss');

    announce('ХРАНИТЕЛЬ ВРАТ', `Убей босса, чтобы закрыть портал · +${Math.round(heal)} HP`);
    fx(boss.x, boss.y, '#ffb05e', 30);
    fx(P.x, P.y, '#7dffb0', 18);

    sfx.boss();
  }

  function bossUpdate(boss, dt) {
    boss.summon -= dt;

    if (boss.summon > 0) return;

    boss.summon = 5;

    if (S.enemies.length >= BOSS_MINIONS) return;

    for (let i = 0; i < 2; i++) {
      const minion = spawn(randomEnemyType());

      minion.x = clamp(boss.x + rand(-70, 70), minion.r + 6, W - minion.r - 6);
      minion.y = clamp(boss.y + rand(-70, 70), minion.r + 6, H - minion.r - 6);
    }

    fx(boss.x, boss.y, '#ffb05e', 14);
  }

  /* ==========================================================
     ТЕНИ
     ========================================================== */

  function createShadow(type, x, y) {
    const cfg = SHADOW_TYPES[type] || SHADOW_TYPES.soldier;

    return {
      type: SHADOW_TYPES[type] ? type : 'soldier',

      x,
      y,
      r: cfg.radius,

      damage: cfg.damage + meta.portal * 2,
      speed: cfg.speed,
      attackSpeed: cfg.attackSpeed,

      cd: Math.random() * 0.4,
      pulse: Math.random() * Math.PI * 2
    };
  }

  function summonShadow(corpse) {
    if (S.army.length >= P.armyMax) return false;

    S.army.push(createShadow(corpse.type, corpse.x, corpse.y));
    fx(corpse.x, corpse.y, '#8968ff', 24);
    ui();

    return true;
  }

  /* Вывести часть хранилища в бой. */
  function deployArmy() {
    const count = Math.min(P.armyMax, meta.shadows.length);

    for (let i = 0; i < count; i++) {
      const type = meta.shadows[i];
      S.deployed.push(type);

      S.army.push(createShadow(
        type,
        P.x - 35 - i * 16,
        P.y + (i % 2 ? 18 : -18)
      ));
    }

    meta.shadows.splice(0, count);
  }

  /* ==========================================================
     ИНТЕРФЕЙС
     ========================================================== */

  function ui() {
    setText($('level'), `УР. ${P.lvl}`);
    setText($('hptext'), `${Math.max(0, Math.ceil(P.hp))} / ${P.maxHp}`);
    setWidth($('hp'), (P.hp / P.maxHp) * 100);
    setWidth($('xp'), (P.xp / P.next) * 100);

    setText($('shadows'), String(S.army.length));
    setText($('vault'), String(meta.shadows.length));

    const goal = Math.max(1, S.goal);

    setText(
      $('objective'),
      S.phase === 'boss'
        ? `ПОРТАЛ ${meta.portal} · УБЕЙ ХРАНИТЕЛЯ ВРАТ`
        : `ПОРТАЛ ${meta.portal} · ${portalName()} — ${Math.min(S.kills, goal)} / ${goal}`
    );
    setWidth($('objbar'), (S.kills / goal) * 100);

    const boss = S.boss && S.enemies.includes(S.boss) ? S.boss : null;

    setClass('bossbar', 'hidden', !boss);
    if (boss) {
      setText($('bossname'), boss.name);
      setWidth($('bosshp'), (boss.hp / boss.max) * 100);
    }

    const a = S.announce;
    setClass('banner', 'hidden', !a);
    if (a) {
      setText($('bannertitle'), a.title);
      setText($('bannertext'), a.text || '');
    }
  }

  function updateStats() {
    setText($('statvault'), String(meta.shadows.length));
    setText($('statclears'), String(meta.clears));
    setText($('statkills'), String(meta.kills));

    setText($('statbest'), String(meta.best));

    // Кнопка сброса нужна, только если есть что терять.
    setClass(
      'reset',
      'hidden',
      meta.clears === 0 && meta.kills === 0 && meta.portal === 1 && meta.shadows.length === 0
    );
  }

  /* ==========================================================
     СТАРТ / ФИНАЛ ОХОТЫ
     ========================================================== */

  function start() {
    if (S.go) return; // защита от двойного запуска

    resetPlayer();
    resetRun();

    hide('start');
    hide('end');
    hide('upgrade');
    hide('paused');
    setText($('pause'), 'Ⅱ');

    deployArmy();
    queueWave();
    ui();
  }

  function finish(win) {
    const clearedRank = rank();

    S.go = false;
    S.pause = false;
    S.choice = false;
    S.phase = 'over';
    S.boss = null;
    S.announce = null;
    S.spawnQueue.length = 0;

    hide('upgrade');
    hide('paused');
    setText($('pause'), 'Ⅱ');

    if (win) {
      // Тени, пережившие охоту, возвращаются в хранилище.
      const survivors = S.army.map((shadow) => shadow.type);
      meta.shadows.push(...survivors);
      if (meta.shadows.length > VAULT_LIMIT) {
        meta.shadows.splice(0, meta.shadows.length - VAULT_LIMIT);
      }

      meta.portal++;
      meta.clears++;
      meta.best = Math.max(meta.best, meta.portal);
    }

    meta.kills += S.kills;
    save();

    const rows = win
      ? [
        ['Убито существ', S.kills],
        ['Уровень охотника', P.lvl],
        ['Время в портале', formatTime(S.time)],
        ['Тени вернулись', S.army.length],
        ['В хранилище', meta.shadows.length],
        ['Дальше', `ВРАТА РАНГА ${rank()}`]
      ]
      : [
        ['Убито существ', S.kills],
        ['Уровень охотника', P.lvl],
        ['Время в портале', formatTime(S.time)],
        ['Тени потеряны', S.deployed.length],
        ['В хранилище', meta.shadows.length],
        ['Портал', `${meta.portal} · ${portalName()}`]
      ];

    setText($('endrank'), win ? `ПОРТАЛ РАНГА ${clearedRank} ЗАКРЫТ` : 'ОХОТА ПРЕРВАНА');
    setText($('endtitle'), win ? 'ВРАТА ОЧИЩЕНЫ' : 'ТЫ ПАЛ');
    setText($('endtext'), win
      ? `Тени вернулись в хранилище: +${S.army.length}. Следующий портал будет опаснее.`
      : `Тени, вышедшие с тобой, растворились во тьме. В хранилище осталось: ${meta.shadows.length}.`);
    setText($('again'), win ? 'СЛЕДУЮЩИЙ ПОРТАЛ' : 'ПОВТОРИТЬ ПОРТАЛ');

    setHTML($('endsummary'), rows
      .map(([key, value]) => `<li><span>${key}</span><b>${value}</b></li>`)
      .join(''));

    show('end');

    // Павшая армия растворяется во тьме.
    if (!win) S.army.length = 0;

    if (win) sfx.win();
    else sfx.lose();

    updateStats();
    ui();
  }

  /* ==========================================================
     ПАУЗА
     ========================================================== */

  function pause(on = !S.pause) {
    if (!S.go || S.choice) return;

    S.pause = on;

    setClass('paused', 'hidden', !on);
    setText($('pause'), on ? '▶' : 'Ⅱ');
  }

  /* ==========================================================
     УДАР И ПОДЪЁМ
     ========================================================== */

  function attack() {
    if (!S.go || S.pause || S.choice || P.cd > 0) return;

    P.cd = P.attackCd;
    P.flash = 0.16;

    let hit = false;

    for (const enemy of S.enemies) {
      if (enemy.hp <= 0) continue;

      const angle = angleTo(P, enemy);
      const difference = Math.abs(
        Math.atan2(Math.sin(angle - P.face), Math.cos(angle - P.face))
      );

      if (dist(P, enemy) < P.attackRange + enemy.r && difference < P.attackArc) {
        enemy.hp -= P.dmg;
        enemy.hit = 0.15;

        hit = true;

        fx(enemy.x, enemy.y, '#decfff', 5);
      }
    }

    sfx.swing();
    if (hit) sfx.hit();
  }

  function raise() {
    if (!S.go || S.pause || S.choice) return;

    if (S.army.length >= P.armyMax) {
      fx(P.x, P.y, '#ff557d', 12);
      announce('АРМИЯ ПОЛНА', `Максимум теней: ${P.armyMax}`);
      sfx.deny();
      return;
    }

    const corpse = nearestCorpse();

    if (!corpse) {
      fx(P.x, P.y, '#5a6488', 6);
      sfx.deny();
      return;
    }

    sfx.raise();

    S.corpses.splice(S.corpses.indexOf(corpse), 1);
    summonShadow(corpse);
  }

  function nearestCorpse() {
    let best = null;

    for (const corpse of S.corpses) {
      const d = dist(P, corpse);
      if (d > RAISE_RANGE) continue;
      if (!best || d < best.d) best = { corpse, d };
    }

    return best ? best.corpse : null;
  }

  /* ==========================================================
     УРОВНИ И УСИЛЕНИЯ
     ========================================================== */

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function pickUpgrades(count) {
    return shuffle([...UPGRADES]).slice(0, count);
  }

  function offerUpgrade() {
    // Экран уже открыт: уровни подождут в очереди до следующего выбора.
    if (S.choice) return;

    if (!S.go || S.pending <= 0) {
      S.pending = 0;
      S.options = [];
      S.choice = false;
      hide('upgrade');
      return;
    }

    S.pending--;
    S.choice = true;
    S.options = pickUpgrades(3);

    setText($('upgradesub'), `Выбери усиление · уровень ${P.lvl}`);

    const box = $('choices');
    if (box) {
      box.innerHTML = '';

      S.options.forEach((upgrade, index) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'choice';
        button.innerHTML = `<b>${upgrade.name}</b><span>${upgrade.desc}</span>`;
        button.onclick = () => takeUpgrade(index);

        box.appendChild(button);
      });
    }

    // Без #choices экран всё равно открывается: карточки отсутствуют,
    // но усиление можно взять с клавиатуры — 1 / 2 / 3.
    show('upgrade');
  }

  function takeUpgrade(index) {
    if (!S.choice) return;

    const upgrade = S.options[index];
    if (!upgrade) return;

    upgrade.apply();

    // Сначала закрываем экран, затем показываем следующий
    // из очереди накопленных уровней.
    S.choice = false;
    S.options = [];

    ui();
    offerUpgrade();
  }

  function gainXP(amount) {
    P.xp += amount;

    let levels = 0;

    while (P.xp >= P.next) {
      P.xp -= P.next;
      P.lvl++;
      levels++;

      P.next = Math.round(P.next * XP_GROWTH);
      P.hp = Math.min(P.maxHp, P.hp + P.maxHp * LEVEL_HEAL);

      fx(P.x, P.y, '#b69fff', 18);
      sfx.level();
    }

    // Уровни складываются в очередь: несколько убийств за один кадр
    // не должны «терять» усиления.
    if (levels > 0) {
      S.pending += levels;
      offerUpgrade();
    }

    ui();
  }

  /* ==========================================================
     СМЕРТЬ ВРАГА
     ========================================================== */

  function killEnemy(enemy) {
    const index = S.enemies.indexOf(enemy);
    if (index === -1) return;

    S.enemies.splice(index, 1);

    if (enemy === S.boss) S.boss = null;

    S.corpses.push({
      x: enemy.x,
      y: enemy.y,
      r: Math.max(9, enemy.r * 0.82),
      t: CORPSE_TTL,
      type: enemy.type
    });

    // Долгая охота не должна копить трупы: старшие растворяются первыми.
    if (S.corpses.length > CORPSE_MAX) S.corpses.splice(0, S.corpses.length - CORPSE_MAX);

    S.kills += enemy.boss ? 4 : 1;

    if (P.lifesteal > 0) {
      P.hp = Math.min(P.maxHp, P.hp + P.lifesteal);
    }

    gainXP(enemy.xp);

    fx(enemy.x, enemy.y, enemy.boss ? '#ff9d45' : '#ef4d8d', enemy.boss ? 26 : 12);

    sfx.kill();
  }

  /* ==========================================================
     ФИЗИКА ТОЛПЫ
     ========================================================== */

  function separate(list) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];

      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);

        const min = a.r + b.r;
        if (d >= min) continue;

        if (d < 0.01) {
          dx = rand(-1, 1);
          dy = rand(-1, 1);
          d = Math.hypot(dx, dy) || 1;
        }

        const overlap = min - d;
        const nx = dx / d;
        const ny = dy / d;

        const share = a.r + b.r;
        const pushA = overlap * (b.r / share);
        const pushB = overlap * (a.r / share);

        a.x -= nx * pushA;
        a.y -= ny * pushA;
        b.x += nx * pushB;
        b.y += ny * pushB;
      }
    }

    for (const item of list) {
      item.x = clamp(item.x, item.r, Math.max(item.r, W - item.r));
      item.y = clamp(item.y, item.r, Math.max(item.r, H - item.r));
    }
  }

  function moveToward(item, target, step) {
    const angle = angleTo(item, target);
    item.x += Math.cos(angle) * step;
    item.y += Math.sin(angle) * step;
  }

  function nearestEnemy(from) {
    let best = null;

    for (const enemy of S.enemies) {
      if (enemy.hp <= 0) continue;

      const d = dist(from, enemy);
      if (!best || d < best.d) best = { enemy, d };
    }

    return best ? best.enemy : null;
  }

  /* ==========================================================
     ШАГ ИГРЫ
     ========================================================== */

  function tick(dt) {
    if (!S.go || S.pause || S.choice) return;

    S.time += dt;

    P.cd = Math.max(0, P.cd - dt);
    P.flash = Math.max(0, P.flash - dt);
    P.hurt = Math.max(0, P.hurt - dt * 1.2);

    if (P.regen > 0) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);

    if (S.announce) {
      S.announce.t -= dt;
      if (S.announce.t <= 0) S.announce = null;
    }

    /* ---------------- движение игрока ---------------- */

    let dx = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0);
    let dy = (K.s || K.arrowdown ? 1 : 0) - (K.w || K.arrowup ? 1 : 0);

    if (stick && (stick.x || stick.y)) {
      dx = stick.x;
      dy = stick.y;
    }

    if (dx || dy) {
      const length = Math.hypot(dx, dy) || 1;

      P.x = clamp(P.x + (dx / length) * P.spd * dt, P.r + 4, W - P.r - 4);
      P.y = clamp(P.y + (dy / length) * P.spd * dt, P.r + 4, H - P.r - 4);

      P.face = Math.atan2(dy, dx);
    }

    /* ---------------- появление врагов ---------------- */

    updateSpawns(dt);

    /* ---------------- враги ---------------- */

    for (const enemy of S.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt);

      // gap — просвет между кругами. Порог APRON нужен из-за
      // плавающей точки: без него юнит «зависает» на самой границе.
      const gap = dist(enemy, P) - (enemy.r + P.r + CONTACT_SLACK);

      if (gap > APRON) {
        moveToward(enemy, P, Math.min(enemy.speed * dt, gap));
      } else {
        damagePlayer(enemy.damage * dt);
      }

      if (enemy.boss) bossUpdate(enemy, dt);
    }

    separate(S.enemies);

    /* ---------------- теневая армия ---------------- */

    for (const shadow of S.army) {
      shadow.pulse += dt;
      shadow.cd -= dt;

      const target = nearestEnemy(shadow);

      if (!target) {
        const home = dist(shadow, P) - 80;
        if (home > APRON) moveToward(shadow, P, Math.min(shadow.speed * dt, home));
        continue;
      }

      const gap = dist(shadow, target) - (shadow.r + target.r + REACH_SLACK);

      if (gap > APRON) {
        moveToward(shadow, target, Math.min(shadow.speed * dt, gap));
      } else if (shadow.cd <= 0) {
        target.hp -= shadow.damage * P.armyDmg;
        target.hit = 0.12;
        shadow.cd = shadow.attackSpeed;

        fx(target.x, target.y, SHADOW_TYPES[shadow.type].color, 3);
      }
    }

    separate(S.army);

    // Тени не должны толкать игрока и наоборот.
    for (const shadow of S.army) {
      const d = dist(shadow, P);
      const min = shadow.r + P.r;

      if (d < min && d > 0.01) {
        const angle = angleTo(P, shadow);
        shadow.x = P.x + Math.cos(angle) * min;
        shadow.y = P.y + Math.sin(angle) * min;
      }
    }

    /* ---------------- смерть врагов ---------------- */

    for (let i = S.enemies.length - 1; i >= 0; i--) {
      const enemy = S.enemies[i];
      if (enemy.hp <= 0) killEnemy(enemy);
    }

    /* ---------------- трупы, частицы ---------------- */

    for (const corpse of S.corpses) corpse.t -= dt;
    S.corpses = S.corpses.filter((corpse) => corpse.t > 0);

    S.raiseTarget = nearestCorpse();

    for (const particle of S.fx) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.t -= dt;
    }

    S.fx = S.fx.filter((particle) => particle.t > 0);

    /* ---------------- поражение ---------------- */

    if (P.hp <= 0) {
      P.hp = 0;
      finish(false);
      return;
    }

    /* ---------------- цель портала ---------------- */

    if (S.phase === 'hunt') {
      const clear = S.enemies.length === 0 && S.spawnQueue.length === 0;

      if (clear) {
        if (S.kills >= S.goal) {
          startBossPhase();
        } else {
          S.waveGap -= dt;
          if (S.waveGap <= 0) queueWave();
        }
      }
    } else if (S.phase === 'boss' && !S.enemies.some((enemy) => enemy.boss)) {
      finish(true);
      return;
    }

    ui();
  }

  function damagePlayer(amount) {
    // Звук удара — только на «входе» в урон, иначе он звучит каждый кадр.
    if (P.hurt < 0.12) sfx.hurt();

    P.hp -= amount;
    P.hurt = clamp(P.hurt + amount * 0.9, 0, 1);
  }

  /* ==========================================================
     ОТРИСОВКА
     ========================================================== */

  let bgGradient = null;
  let vignette = null;

  function buildGradients() {
    bgGradient = X.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.75);
    bgGradient.addColorStop(0, '#252650');
    bgGradient.addColorStop(1, '#080b15');

    vignette = X.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.24,
      W / 2, H / 2, Math.max(W, H) * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  }

  function circle(object, color) {
    X.beginPath();
    X.arc(object.x, object.y, Math.max(0.5, object.r), 0, Math.PI * 2);
    X.fillStyle = color;
    X.fill();
  }

  function drawBackground() {
    X.fillStyle = bgGradient || '#0d1120';
    X.fillRect(0, 0, W, H);

    X.strokeStyle = '#6570ba18';
    X.lineWidth = 1;

    for (let x = 0; x < W; x += 48) {
      X.beginPath();
      X.moveTo(x, 0);
      X.lineTo(x, H);
      X.stroke();
    }

    for (let y = 0; y < H; y += 48) {
      X.beginPath();
      X.moveTo(0, y);
      X.lineTo(W, y);
      X.stroke();
    }
  }

  function drawCorpses() {
    for (const corpse of S.corpses) {
      const active = corpse === S.raiseTarget;
      const fade = clamp(corpse.t / 2, 0.25, 1);

      X.globalAlpha = fade;

      circle(corpse, '#351833');

      X.strokeStyle = (SHADOW_TYPES[corpse.type] || SHADOW_TYPES.soldier).color;
      X.lineWidth = active ? 3 : 2;

      X.beginPath();
      X.arc(corpse.x, corpse.y, corpse.r + (active ? 9 : 7), 0, Math.PI * 2);
      X.stroke();

      if (active) {
        X.fillStyle = '#ded5ff';
        X.font = 'bold 12px Rajdhani, Arial, sans-serif';
        X.textAlign = 'center';
        X.fillText('E', corpse.x, corpse.y - corpse.r - 14);
      }

      X.globalAlpha = 1;
      X.lineWidth = 1;
    }
  }

  function drawShadows() {
    for (const shadow of S.army) {
      const cfg = SHADOW_TYPES[shadow.type] || SHADOW_TYPES.soldier;
      const pulse = 1 + Math.sin(shadow.pulse * 4) * 0.06;

      X.shadowBlur = 18;
      X.shadowColor = cfg.color;

      circle({ x: shadow.x, y: shadow.y, r: shadow.r * pulse }, cfg.color);

      X.shadowBlur = 0;

      circle({ x: shadow.x + 4, y: shadow.y - 2, r: 3 }, '#ded5ff');
    }
  }

  function drawEnemies() {
    for (const enemy of S.enemies) {
      circle(enemy, enemy.hit > 0 ? '#ffffff' : enemy.color);
      circle({ x: enemy.x, y: enemy.y, r: enemy.r * 0.5 }, enemy.core);

      // Полоса здоровья
      X.fillStyle = '#241421';
      X.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 9, enemy.r * 2, 4);

      X.fillStyle = enemy.boss ? '#ffb05e' : '#ff668d';
      X.fillRect(
        enemy.x - enemy.r,
        enemy.y - enemy.r - 9,
        enemy.r * 2 * clamp(enemy.hp / enemy.max, 0, 1),
        4
      );

      if (enemy.boss) {
        X.strokeStyle = '#ffb05e88';
        X.lineWidth = 2;

        X.beginPath();
        X.arc(enemy.x, enemy.y, enemy.r + 7, 0, Math.PI * 2);
        X.stroke();

        X.lineWidth = 1;
      }
    }
  }

  function drawPlayer() {
    X.save();

    X.translate(P.x, P.y);
    X.rotate(P.face);

    X.shadowBlur = 20;
    X.shadowColor = '#9a7fff';

    circle({ x: 0, y: 0, r: P.r }, P.hurt > 0.45 ? '#ff9db4' : '#8c70ee');

    X.shadowBlur = 0;

    circle({ x: 7, y: 0, r: 6 }, '#e8e1ff');

    if (P.flash > 0) {
      X.strokeStyle = '#ffffff';
      X.lineWidth = 7;

      X.beginPath();
      X.arc(0, 0, P.attackRange * 0.62, -P.attackArc * 0.75, P.attackArc * 0.75);
      X.stroke();

      X.lineWidth = 1;
    }

    X.restore();
  }

  function drawParticles() {
    for (const particle of S.fx) {
      X.globalAlpha = clamp(particle.t * 2, 0, 1);
      circle({ x: particle.x, y: particle.y, r: 2 }, particle.color);
      X.globalAlpha = 1;
    }
  }

  function draw() {
    drawBackground();

    const shake = REDUCED_MOTION ? 0 : P.hurt * 5;

    X.save();

    if (shake > 0.2) {
      X.translate(rand(-shake, shake), rand(-shake, shake));
    }

    drawCorpses();
    drawShadows();
    drawEnemies();
    drawPlayer();
    drawParticles();

    X.restore();

    if (vignette) {
      X.fillStyle = vignette;
      X.fillRect(0, 0, W, H);
    }

    if (!REDUCED_MOTION && P.hurt > 0.05) {
      X.fillStyle = `rgba(190, 30, 70, ${(P.hurt * 0.28).toFixed(3)})`;
      X.fillRect(0, 0, W, H);
    }
  }

  /* ==========================================================
     ЦИКЛ
     ========================================================== */

  function loop(time) {
    const dt = clamp((time - S.last) / 1000 || 0, 0, 0.033);

    S.last = time;

    tick(dt);
    draw();
    expireResetArm();

    requestAnimationFrame(loop);
  }

  /* ==========================================================
     АДАПТАЦИЯ РАЗМЕРА
     ========================================================== */

  /* Обёртка арены необязательна: без #arena берем размеры родителя canvas,
     а если и его нет (игра вставлена в чужой DOM) — размер самого canvas. */
  function arenaSize() {
    const arena = $('arena') || C.parentElement;
    const rect = arena && arena.getBoundingClientRect ? arena.getBoundingClientRect() : C.getBoundingClientRect();

    if (!rect) return { width: 960, height: 600 };

    return { width: rect.width || 960, height: rect.height || 600 };
  }

  function resize() {
    const box = arenaSize();

    const width = Math.max(280, Math.round(box.width));
    const height = Math.max(240, Math.round(box.height));

    W = width;
    H = height;
    DPR = Math.min(2, window.devicePixelRatio || 1);

    C.width = Math.round(W * DPR);
    C.height = Math.round(H * DPR);

    X.setTransform(DPR, 0, 0, DPR, 0, 0);

    buildGradients();

    P.x = clamp(P.x, P.r, W - P.r);
    P.y = clamp(P.y, P.r, H - P.r);

    for (const list of [S.enemies, S.army, S.corpses]) {
      for (const item of list) {
        item.x = clamp(item.x, 0, W);
        item.y = clamp(item.y, 0, H);
      }
    }

    draw();
  }

  /* ==========================================================
     ЭКРАНЫ
     ========================================================== */

  function setup() {
    setText($('rank'), `ВРАТА РАНГА ${rank()}`);
    setText($('portalname'), portalName());

    syncSoundButton();

    updateStats();
    ui();

    show('start');
    hide('end');
    hide('upgrade');
    hide('paused');
    hide('banner');
    hide('bossbar');
  }

  function nextPortal() {
    setup();
    start();
  }

  /* ==========================================================
     КЛАВИАТУРА
     ========================================================== */

  function resetKeys() {
    for (const key in K) K[key] = false;
  }

  const SCROLL_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

  addEventListener('keydown', (event) => {
    const key = (event.key || '').toLowerCase();

    K[key] = true;

    if (SCROLL_KEYS.includes(key)) event.preventDefault();

    if (S.choice) {
      if (['1', '2', '3'].includes(key)) {
        event.preventDefault();
        takeUpgrade(Number(key) - 1);
      }
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();

      if (!S.go) {
        unlockAudio(); // клавиша — тоже жест, браузер пустит звук
        start();
      } else {
        attack();
      }
    }

    if (event.code === 'KeyE') {
      event.preventDefault();
      raise();
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      pause();
    }

    if (event.code === 'Enter' && !S.go) {
      event.preventDefault();
      unlockAudio();
      start();
    }
  });

  addEventListener('keyup', (event) => {
    K[(event.key || '').toLowerCase()] = false;
  });

  // Клавиши не должны «залипать» при потере фокуса.
  addEventListener('blur', () => {
    resetKeys();
    if (S.go && !S.pause && !S.choice) pause(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;

    resetKeys();
    if (S.go && !S.pause && !S.choice) pause(true);
  });

  /* ==========================================================
     КНОПКИ
     ========================================================== */

  bind('sound', () => toggleSound());

  bind('play', () => {
    unlockAudio();
    start();
  });

  bind('again', () => nextPortal());
  bind('resume', () => pause(false));
  bind('pause', () => pause());
  bind('quit', () => finish(false));

  // Экранные кнопки боя: на касание реагируем сразу, без задержки click.
  // Отметка «уже обработано» — своя у каждой кнопки, иначе быстрый тап
  // по ⚔ и затем по ✦ терялся бы как двойное нажатие.
  const handledTouch = Object.create(null);

  for (const id of ['attack', 'raise', 'ta', 'tr']) {
    const button = $(id);
    if (!button) continue;

    const act = () => {
      if (id === 'attack' || id === 'ta') attack();
      else raise();
    };

    button.onclick = (event) => {
      if (event && event.preventDefault) event.preventDefault();

      if (now() - (handledTouch[id] || 0) < 500) return; // уже обработано pointerdown

      act();
    };

    listen(id, 'pointerdown', (event) => {
      if (event.pointerType === 'mouse') return;

      if (event.preventDefault) event.preventDefault();
      handledTouch[id] = now();
      act();
    });
  }

  // Сброс прогресса: защита от случайного нажатия — два клика подряд.
  const RESET_ARM_MS = 4000;

  let resetArm = 0;

  bind('reset', () => {
    if (now() < resetArm) {
      resetArm = 0;

      meta.portal = 1;
      meta.shadows = [];
      meta.clears = 0;
      meta.kills = 0;
      meta.best = 1;

      save();
      setup();

      return;
    }

    resetArm = now() + RESET_ARM_MS;
    setText($('reset'), 'НАЖМИ ЕЩЁ РАЗ ДЛЯ СБРОСА');
  });

  // Просроченное подтверждение снимаем сами: кнопка не должна выглядеть
  // «взведённой», когда второй клик уже ничего не сотрёт.
  function expireResetArm() {
    if (!resetArm || now() < resetArm) return;

    resetArm = 0;
    setText($('reset'), 'СБРОСИТЬ ПРОГРЕСС');
  }

  /* ==========================================================
     ВИРТУАЛЬНЫЙ СТИК
     ========================================================== */

  const joystick = $('stick');
  const knob = joystick && joystick.querySelector ? joystick.querySelector('i') : null;

  function moveStick(event) {
    const rect = joystick.getBoundingClientRect();

    let dx = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    let dy = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);

    const length = Math.hypot(dx, dy);

    if (length > 1) {
      dx /= length;
      dy /= length;
    }

    stick = { x: dx, y: dy };

    if (knob) knob.style.transform = `translate(${dx * 22}px, ${dy * 22}px)`;
  }

  function releaseStick() {
    stick = null;
    if (knob) knob.style.transform = 'translate(0,0)';
  }

  if (joystick) {
    joystick.addEventListener('pointerdown', (event) => {
      if (joystick.setPointerCapture) joystick.setPointerCapture(event.pointerId);
      moveStick(event);
      event.preventDefault();
    });

    joystick.addEventListener('pointermove', (event) => {
      if (!stick) return;
      moveStick(event);
      event.preventDefault();
    });

    joystick.addEventListener('pointerup', releaseStick);
    joystick.addEventListener('pointercancel', releaseStick);
    joystick.addEventListener('lostpointercapture', releaseStick);
  }

  /* ==========================================================
     ЗАПУСК
     ========================================================== */

  resetPlayer();
  setup();
  resize();

  const watched = $('arena') || C.parentElement;

  if (typeof ResizeObserver !== 'undefined' && watched) {
    new ResizeObserver(resize).observe(watched);
  }

  // Окно слушаем всегда: при отсутствии #arena это единственный источник
  // ресайза, а при наличии — страховка от поворота экрана без смены размеров.
  addEventListener('resize', resize);

  requestAnimationFrame(loop);

  /* Отладочный доступ: используется автотестами и консолью. */
  window.ShadowAscendant = {
    version: VERSION,
    meta,
    state: S,
    player: P,
    keys: K,
    api: {
      start,
      pause,
      attack,
      raise,
      takeUpgrade,
      offerUpgrade,
      finish,
      spawn,
      spawnBoss: startBossPhase,
      resize,
      tick,
      draw,
      ui,
      save,
      toggleSound
    }
  };
})();
