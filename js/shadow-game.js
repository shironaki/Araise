(() => {
  const C = document.querySelector('#canvas');
  const X = C.getContext('2d');
  const W = C.width;
  const H = C.height;

  const $ = id => document.getElementById(id);
  const K = {};

  let stick = null;

  // =========================================================
  // CORE DATA
  // =========================================================

  const ranks = ['E', 'D', 'C', 'B', 'A', 'S'];

  const portalNames = [
    'РАЗЛОМ БЕЗМОЛВИЯ',
    'ЗАТОНУВШИЕ ВРАТА',
    'ЧЁРНЫЙ ЛАБИРИНТ',
    'ЦИТАДЕЛЬ ПЕПЛА'
  ];

  const saved = JSON.parse(
    localStorage.getItem('shadow-ascendant') ||
    '{"portal":1,"vault":0,"shadows":[]}'
  );

  const meta = {
    portal: saved.portal || 1,
    vault: saved.vault || 0,
    shadows: Array.isArray(saved.shadows) ? saved.shadows : []
  };

  // Старый формат сохранения совместим с новым.
  if (meta.shadows.length === 0 && meta.vault > 0) {
    for (let i = 0; i < meta.vault; i++) {
      meta.shadows.push('soldier');
    }
  }

  const S = {
    go: false,
    pause: false,
    choice: false,

    kills: 0,
    goal: 20,
    wave: 0,

    enemies: [],
    corpses: [],
    army: [],
    fx: [],

    last: 0,
    waveTimer: 0
  };

  const P = {
    x: 480,
    y: 300,
    r: 17,

    hp: 100,
    max: 100,

    lvl: 1,
    xp: 0,
    next: 50,

    dmg: 25,
    spd: 245,

    cd: 0,
    flash: 0,
    face: 0,

    attackRange: 98
  };

  // =========================================================
  // ENEMY TYPES
  // =========================================================

  const enemyTypes = {
    soldier: {
      name: 'ОХОТНИК',
      color: '#c13c67',
      core: '#35152e',
      hp: 30,
      speed: 58,
      radius: 14,
      damage: 7,
      xp: 16,
      shadowDamage: 12,
      shadowSpeed: 160
    },

    runner: {
      name: 'БЕГУН',
      color: '#d45b89',
      core: '#45182f',
      hp: 20,
      speed: 105,
      radius: 11,
      damage: 5,
      xp: 20,
      shadowDamage: 9,
      shadowSpeed: 205
    },

    brute: {
      name: 'БРУТ',
      color: '#b34758',
      core: '#391821',
      hp: 90,
      speed: 37,
      radius: 20,
      damage: 13,
      xp: 28,
      shadowDamage: 20,
      shadowSpeed: 120
    },

    caster: {
      name: 'ПРОКЛЯТЫЙ',
      color: '#824fc7',
      core: '#24163c',
      hp: 42,
      speed: 45,
      radius: 15,
      damage: 9,
      xp: 32,
      shadowDamage: 17,
      shadowSpeed: 145
    }
  };

  // =========================================================
  // UTILS
  // =========================================================

  const dist = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const clamp = (n, a, b) =>
    Math.max(a, Math.min(b, n));

  const save = () => {
    localStorage.setItem(
      'shadow-ascendant',
      JSON.stringify({
        portal: meta.portal,
        vault: meta.vault,
        shadows: meta.shadows
      })
    );
  };

  const rank = () =>
    ranks[Math.min(
      5,
      Math.floor((meta.portal - 1) / 2)
    )];

  const portalName = () =>
    portalNames[(meta.portal - 1) % portalNames.length];

  const randomEnemyType = () => {
    const r = Math.random();

    if (meta.portal >= 3 && r < 0.16) {
      return 'caster';
    }

    if (meta.portal >= 2 && r < 0.35) {
      return 'brute';
    }

    if (r < 0.55) {
      return 'runner';
    }

    return 'soldier';
  };

  // =========================================================
  // UI
  // =========================================================

  function ui() {
    $('level').textContent = `УР. ${P.lvl}`;

    $('hptext').textContent =
      `${Math.ceil(P.hp)} / ${P.max}`;

    $('hp').style.width =
      `${clamp(P.hp / P.max * 100, 0, 100)}%`;

    $('xp').style.width =
      `${clamp(P.xp / P.next * 100, 0, 100)}%`;

    $('shadows').textContent =
      S.army.length;

    $('vault').textContent =
      meta.shadows.length;

    $('objective').textContent =
      `ПОРТАЛ ${meta.portal}: ${S.kills} / ${S.goal} существ`;
  }

  // =========================================================
  // PARTICLES
  // =========================================================

  function fx(x, y, color, amount = 8) {
    while (amount--) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 35 + Math.random() * 110;

      S.fx.push({
        x,
        y,

        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,

        t: 0.5,
        color
      });
    }
  }

  // =========================================================
  // ENEMIES
  // =========================================================

  function spawn(type = randomEnemyType(), boss = false) {
    const a = Math.random() * Math.PI * 2;

    const distance = 330 + Math.random() * 90;

    const cfg = boss
      ? {
          name: 'ХРАНИТЕЛЬ ВРАТ',
          color: '#e98d39',
          core: '#4a2614',
          hp: 260 + meta.portal * 35,
          speed: 48 + meta.portal * 2,
          radius: 29,
          damage: 18,
          xp: 55,
          shadowDamage: 28,
          shadowSpeed: 115
        }
      : enemyTypes[type];

    const hpScale =
      boss
        ? 1
        : 1 + Math.max(0, meta.portal - 1) * 0.12;

    S.enemies.push({
      x: clamp(
        P.x + Math.cos(a) * distance,
        30,
        W - 30
      ),

      y: clamp(
        P.y + Math.sin(a) * distance,
        30,
        H - 30
      ),

      r: cfg.radius,

      hp: cfg.hp * hpScale,
      max: cfg.hp * hpScale,

      speed: cfg.speed,
      damage: cfg.damage,

      xp: cfg.xp,

      type: boss ? 'boss' : type,

      shadowDamage: cfg.shadowDamage,
      shadowSpeed: cfg.shadowSpeed,

      hit: 0,
      boss
    });
  }

  function wave() {
    S.wave++;

    const amount =
      3 +
      S.wave * 2 +
      Math.floor(meta.portal / 2);

    for (let i = 0; i < amount; i++) {
      setTimeout(() => {
        if (S.go && !S.pause) {
          spawn();
        }
      }, i * 310);
    }
  }

  // =========================================================
  // SHADOWS
  // =========================================================

  const shadowTypes = {
    soldier: {
      name: 'ВОИН ТЕНИ',
      color: '#7057db',
      damage: 12,
      speed: 160,
      attackSpeed: 0.58,
      radius: 11
    },

    runner: {
      name: 'ТЕНЬ-БЕГУН',
      color: '#4c8cff',
      damage: 9,
      speed: 205,
      attackSpeed: 0.42,
      radius: 9
    },

    brute: {
      name: 'ТЕНЬ-БРУТ',
      color: '#a54de0',
      damage: 20,
      speed: 120,
      attackSpeed: 0.75,
      radius: 15
    },

    caster: {
      name: 'ТЕНЬ-ПРОКЛЯТЫЙ',
      color: '#b15cff',
      damage: 17,
      speed: 145,
      attackSpeed: 0.68,
      radius: 11
    },

    boss: {
      name: 'ТЕНЬ ХРАНИТЕЛЯ',
      color: '#ff8b4c',
      damage: 28,
      speed: 115,
      attackSpeed: 0.9,
      radius: 17
    }
  };

  const MAX_ARMY = 8;

  function createShadow(type, x, y) {
    const cfg =
      shadowTypes[type] ||
      shadowTypes.soldier;

    return {
      type,

      x,
      y,

      r: cfg.radius,

      damage:
        cfg.damage +
        meta.portal * 2,

      speed: cfg.speed,

      attackSpeed: cfg.attackSpeed,

      cd: Math.random() * 0.4,

      pulse: Math.random() * Math.PI * 2
    };
  }

  function summonShadow(corpse) {
    if (S.army.length >= MAX_ARMY) {
      fx(corpse.x, corpse.y, '#ff557d', 12);
      return;
    }

    const shadow =
      createShadow(
        corpse.type,
        corpse.x,
        corpse.y
      );

    S.army.push(shadow);

    fx(
      corpse.x,
      corpse.y,
      '#8968ff',
      24
    );

    ui();
  }

  // =========================================================
  // GAME START / END
  // =========================================================

  function start() {
    Object.assign(S, {
      go: true,
      pause: false,
      choice: false,

      kills: 0,
      goal: 18 + meta.portal * 5,
      wave: 0,

      enemies: [],
      corpses: [],
      army: [],
      fx: [],

      waveTimer: 0
    });

    Object.assign(P, {
      x: W / 2,
      y: H / 2,

      hp: 100,
      max: 100,

      lvl: 1,
      xp: 0,
      next: 50,

      dmg: 25,
      spd: 245,

      cd: 0,
      flash: 0,
      face: 0
    });

    // Возвращаем часть постоянной армии.
    const initialArmy =
      Math.min(
        meta.shadows.length,
        MAX_ARMY
      );

    for (let i = 0; i < initialArmy; i++) {
      const type =
        typeof meta.shadows[i] === 'string'
          ? meta.shadows[i]
          : 'soldier';

      S.army.push(
        createShadow(
          type,
          P.x - 35 - i * 16,
          P.y
        )
      );
    }

    $('start').classList.add('hidden');
    $('end').classList.add('hidden');

    $('upgrade').classList.add('hidden');
    $('paused').classList.add('hidden');

    wave();
    ui();
  }

  function finish(win) {
    S.go = false;

    if (win) {
      // Победившая армия возвращается в хранилище.
      for (const shadow of S.army) {
        meta.shadows.push(shadow.type);
      }

      meta.portal++;

      // Сохраняем фактическую армию.
      meta.vault = meta.shadows.length;

      save();
    }

    $('endrank').textContent =
      win
        ? `ПОРТАЛ РАНГА ${rank()}`
        : 'ОХОТА ПРЕРВАНА';

    $('endtitle').textContent =
      win
        ? 'ВРАТА ОЧИЩЕНЫ'
        : 'ОХОТА ПРЕРВАНА';

    $('endtext').textContent =
      win
        ? `Тени вернулись в хранилище: +${S.army.length}. Следующий портал будет опаснее.`
        : `Достигнут ${P.lvl} уровень. Сохранено теней: ${meta.shadows.length}.`;

    $('again').textContent =
      win
        ? 'СЛЕДУЮЩИЙ ПОРТАЛ'
        : 'ПОВТОРИТЬ ПОРТАЛ';

    $('end').classList.remove('hidden');

    ui();
  }

  // =========================================================
  // PAUSE
  // =========================================================

  function pause(on = !S.pause) {
    if (!S.go || S.choice) {
      return;
    }

    S.pause = on;

    $('paused')
      .classList
      .toggle('hidden', !on);

    $('pause').textContent =
      on ? '▶' : 'Ⅱ';
  }

  // =========================================================
  // ATTACK
  // =========================================================

  function attack() {
    if (
      !S.go ||
      S.pause ||
      S.choice ||
      P.cd > 0
    ) {
      return;
    }

    P.cd = 0.35;
    P.flash = 0.16;

    for (const enemy of S.enemies) {
      const angle =
        Math.atan2(
          enemy.y - P.y,
          enemy.x - P.x
        );

      const difference =
        Math.abs(
          Math.atan2(
            Math.sin(angle - P.face),
            Math.cos(angle - P.face)
          )
        );

      if (
        dist(P, enemy) < P.attackRange &&
        difference < 1.35
      ) {
        enemy.hp -= P.dmg;
        enemy.hit = 0.15;

        fx(
          enemy.x,
          enemy.y,
          '#decfff',
          5
        );
      }
    }
  }

  // =========================================================
  // RAISE
  // =========================================================

  function raise() {
    if (
      !S.go ||
      S.pause ||
      S.choice
    ) {
      return;
    }

    if (S.army.length >= MAX_ARMY) {
      fx(P.x, P.y, '#ff557d', 12);
      return;
    }

    const corpse =
      S.corpses
        .filter(c => dist(P, c) < 92)
        .sort((a, b) =>
          dist(P, a) - dist(P, b)
        )[0];

    if (!corpse) {
      return;
    }

    S.corpses.splice(
      S.corpses.indexOf(corpse),
      1
    );

    summonShadow(corpse);
  }

  // =========================================================
  // UPGRADES
  // =========================================================

  const upgrades = [
    [
      'КЛИНОК ТЕНИ',
      'Урон +14',
      () => P.dmg += 14
    ],

    [
      'ЖИВУЧЕСТЬ',
      'Макс. HP +35',
      () => {
        P.max += 35;
        P.hp = P.max;
      }
    ],

    [
      'ШАГ СКВОЗЬ ТЬМУ',
      'Скорость +45',
      () => P.spd += 45
    ],

    [
      'РАЗРЫВ',
      'Дальность атаки +18',
      () => P.attackRange += 18
    ],

    [
      'КОМАНДИР ТЕНЕЙ',
      'Максимум армии +1',
      () => {}
    ]
  ];

  function levelUp() {
    S.choice = true;

    $('upgrade')
      .classList
      .remove('hidden');

    $('choices').innerHTML = '';

    const available =
      [...upgrades]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    for (const upgrade of available) {
      const button =
        document.createElement('button');

      button.className = 'choice';

      button.innerHTML =
        `<b>${upgrade[0]}</b>
         <span>${upgrade[1]}</span>`;

      button.onclick = () => {
        upgrade[2]();

        if (upgrade[0] === 'КОМАНДИР ТЕНЕЙ') {
          // Ограничение растёт отдельно.
          // Храним его через свойство игры.
          window.shadowArmyBonus =
            (window.shadowArmyBonus || 0) + 1;
        }

        S.choice = false;

        $('upgrade')
          .classList
          .add('hidden');

        ui();
      };

      $('choices').append(button);
    }
  }

  function gainXP(amount) {
    P.xp += amount;

    while (P.xp >= P.next) {
      P.xp -= P.next;

      P.lvl++;

      P.next =
        Math.round(P.next * 1.35);

      levelUp();

      break;
    }

    ui();
  }

  // =========================================================
  // ENEMY DEATH
  // =========================================================

  function killEnemy(enemy) {
    const index =
      S.enemies.indexOf(enemy);

    if (index !== -1) {
      S.enemies.splice(index, 1);
    }

    S.corpses.push({
      x: enemy.x,
      y: enemy.y,

      r: enemy.r,

      t: 9,

      type: enemy.type
    });

    S.kills +=
      enemy.boss ? 4 : 1;

    gainXP(
      enemy.boss
        ? 55
        : enemy.xp
    );

    fx(
      enemy.x,
      enemy.y,
      enemy.boss
        ? '#ff9d45'
        : '#ef4d8d',
      enemy.boss ? 24 : 12
    );
  }

  // =========================================================
  // GAME TICK
  // =========================================================

  function tick(dt) {
    if (
      !S.go ||
      S.pause ||
      S.choice
    ) {
      return;
    }

    P.cd -= dt;
    P.flash -= dt;

    // -------------------------
    // PLAYER MOVEMENT
    // -------------------------

    let dx =
      (K.d || K.arrowright ? 1 : 0) -
      (K.a || K.arrowleft ? 1 : 0);

    let dy =
      (K.s || K.arrowdown ? 1 : 0) -
      (K.w || K.arrowup ? 1 : 0);

    if (stick) {
      dx = stick.x;
      dy = stick.y;
    }

    if (dx || dy) {
      const length =
        Math.hypot(dx, dy);

      P.x = clamp(
        P.x +
          dx / length *
          P.spd *
          dt,
        22,
        W - 22
      );

      P.y = clamp(
        P.y +
          dy / length *
          P.spd *
          dt,
        22,
        H - 22
      );

      P.face =
        Math.atan2(dy, dx);
    }

    // -------------------------
    // ENEMIES
    // -------------------------

    for (const enemy of S.enemies) {
      const angle =
        Math.atan2(
          P.y - enemy.y,
          P.x - enemy.x
        );

      const distance =
        dist(P, enemy);

      if (distance > 30) {
        enemy.x +=
          Math.cos(angle) *
          enemy.speed *
          dt;

        enemy.y +=
          Math.sin(angle) *
          enemy.speed *
          dt;
      } else {
        P.hp -=
          enemy.damage * dt;
      }

      enemy.hit -= dt;
    }

    // -------------------------
    // SHADOW ARMY
    // -------------------------

    for (const shadow of S.army) {
      shadow.pulse += dt;

      const targets =
        S.enemies
          .filter(e => !e.dead);

      const target =
        targets
          .sort((a, b) =>
            dist(shadow, a) -
            dist(shadow, b)
          )[0];

      if (!target) {
        // Возвращаем тень к игроку.
        const d = dist(shadow, P);

        if (d > 80) {
          const angle =
            Math.atan2(
              P.y - shadow.y,
              P.x - shadow.x
            );

          shadow.x +=
            Math.cos(angle) *
            shadow.speed *
            dt;

          shadow.y +=
            Math.sin(angle) *
            shadow.speed *
            dt;
        }

        continue;
      }

      const distance =
        dist(shadow, target);

      const angle =
        Math.atan2(
          target.y - shadow.y,
          target.x - shadow.x
        );

      if (distance > 30) {
        shadow.x +=
          Math.cos(angle) *
          shadow.speed *
          dt;

        shadow.y +=
          Math.sin(angle) *
          shadow.speed *
          dt;
      } else if (shadow.cd <= 0) {
        target.hp -= shadow.damage;

        shadow.cd =
          shadow.attackSpeed;

        fx(
          target.x,
          target.y,
          shadowTypes[shadow.type]?.color ||
            '#785cff',
          3
        );
      }

      shadow.cd -= dt;
    }

    // -------------------------
    // DEAD ENEMIES
    // -------------------------

    const dead =
      S.enemies.filter(e => e.hp <= 0);

    for (const enemy of dead) {
      killEnemy(enemy);
    }

    // -------------------------
    // CORPSES
    // -------------------------

    for (const corpse of S.corpses) {
      corpse.t -= dt;
    }

    S.corpses =
      S.corpses.filter(c =>
        c.t > 0
      );

    // -------------------------
    // PARTICLES
    // -------------------------

    for (const particle of S.fx) {
      particle.x +=
        particle.vx * dt;

      particle.y +=
        particle.vy * dt;

      particle.t -= dt;
    }

    S.fx =
      S.fx.filter(p =>
        p.t > 0
      );

    // -------------------------
    // DEFEAT
    // -------------------------

    if (P.hp <= 0) {
      P.hp = 0;
      finish(false);
      return;
    }

    // -------------------------
    // PORTAL OBJECTIVE
    // -------------------------

    if (S.kills >= S.goal) {
      const bossAlive =
        S.enemies.some(e => e.boss);

      if (!bossAlive) {
        spawn(
          'brute',
          true
        );
      } else if (
        S.enemies.length === 0
      ) {
        finish(true);
        return;
      }
    } else if (
      S.enemies.length === 0
    ) {
      wave();
    }

    ui();
  }

  // =========================================================
  // DRAWING
  // =========================================================

  function circle(object, color) {
    X.beginPath();

    X.arc(
      object.x,
      object.y,
      object.r,
      0,
      Math.PI * 2
    );

    X.fillStyle = color;
    X.fill();
  }

  function drawBackground() {
    const gradient =
      X.createRadialGradient(
        W / 2,
        H / 2,
        20,
        W / 2,
        H / 2,
        680
      );

    gradient.addColorStop(
      0,
      '#252650'
    );

    gradient.addColorStop(
      1,
      '#080b15'
    );

    X.fillStyle = gradient;
    X.fillRect(
      0,
      0,
      W,
      H
    );

    X.strokeStyle =
      '#6570ba18';

    for (
      let x = 0;
      x < W;
      x += 48
    ) {
      X.beginPath();
      X.moveTo(x, 0);
      X.lineTo(x, H);
      X.stroke();
    }

    for (
      let y = 0;
      y < H;
      y += 48
    ) {
      X.beginPath();
      X.moveTo(0, y);
      X.lineTo(W, y);
      X.stroke();
    }
  }

  function drawCorpses() {
    for (const corpse of S.corpses) {
      circle(
        corpse,
        '#351833'
      );

      X.strokeStyle =
        shadowTypes[corpse.type]?.color ||
        '#a66cfb';

      X.lineWidth = 2;

      X.beginPath();

      X.arc(
        corpse.x,
        corpse.y,
        corpse.r + 7,
        0,
        Math.PI * 2
      );

      X.stroke();

      X.lineWidth = 1;
    }
  }

  function drawShadows() {
    for (const shadow of S.army) {
      const cfg =
        shadowTypes[shadow.type] ||
        shadowTypes.soldier;

      X.shadowBlur = 18;
      X.shadowColor = cfg.color;

      circle(
        shadow,
        cfg.color
      );

      X.shadowBlur = 0;

      circle(
        {
          x: shadow.x + 4,
          y: shadow.y - 2,
          r: 3
        },
        '#ded5ff'
      );
    }
  }

  function drawEnemies() {
    for (const enemy of S.enemies) {
      const cfg =
        enemy.boss
          ? {
              color: '#e98d39',
              core: '#4a2614'
            }
          : enemyTypes[enemy.type];

      circle(
        enemy,
        enemy.hit > 0
          ? '#ffffff'
          : cfg.color
      );

      circle(
        {
          x: enemy.x,
          y: enemy.y,
          r: enemy.r * 0.5
        },
        cfg.core
      );

      // HP bar
      X.fillStyle =
        '#241421';

      X.fillRect(
        enemy.x - enemy.r,
        enemy.y - enemy.r - 9,
        enemy.r * 2,
        4
      );

      X.fillStyle =
        enemy.boss
          ? '#ffb05e'
          : '#ff668d';

      X.fillRect(
        enemy.x - enemy.r,
        enemy.y - enemy.r - 9,
        enemy.r * 2 *
          clamp(
            enemy.hp / enemy.max,
            0,
            1
          ),
        4
      );

      if (enemy.boss) {
        X.strokeStyle =
          '#ffb05e88';

        X.lineWidth = 2;

        X.beginPath();

        X.arc(
          enemy.x,
          enemy.y,
          enemy.r + 7,
          0,
          Math.PI * 2
        );

        X.stroke();

        X.lineWidth = 1;
      }
    }
  }

  function drawPlayer() {
    X.save();

    X.translate(
      P.x,
      P.y
    );

    X.rotate(P.face);

    X.shadowBlur = 20;
    X.shadowColor =
      '#9a7fff';

    circle(
      {
        x: 0,
        y: 0,
        r: P.r
      },
      '#8c70ee'
    );

    X.shadowBlur = 0;

    circle(
      {
        x: 7,
        y: 0,
        r: 6
      },
      '#e8e1ff'
    );

    if (P.flash > 0) {
      X.strokeStyle =
        '#ffffff';

      X.lineWidth = 7;

      X.beginPath();

      X.arc(
        0,
        0,
        58,
        -0.9,
        0.9
      );

      X.stroke();

      X.lineWidth = 1;
    }

    X.restore();
  }

  function drawParticles() {
    for (const particle of S.fx) {
      circle(
        {
          x: particle.x,
          y: particle.y,
          r: 2
        },
        particle.color
      );
    }
  }

  function draw() {
    drawBackground();
    drawCorpses();
    drawShadows();
    drawEnemies();
    drawPlayer();
    drawParticles();
  }

  // =========================================================
  // LOOP
  // =========================================================

  function loop(time) {
    const dt =
      Math.min(
        0.033,
        (time - S.last) / 1000 || 0
      );

    S.last = time;

    tick(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // =========================================================
  // SETUP
  // =========================================================

  function setup() {
    $('rank').textContent =
      `ВРАТА РАНГА ${rank()}`;

    $('portalname').textContent =
      portalName();

    ui();
  }

  setup();

  requestAnimationFrame(loop);

  // =========================================================
  // KEYBOARD
  // =========================================================

  addEventListener(
    'keydown',
    event => {
      const key =
        event.key.toLowerCase();

      K[key] = true;

      if (event.code === 'Space') {
        event.preventDefault();
        attack();
      }

      if (event.code === 'KeyE') {
        event.preventDefault();
        raise();
      }

      if (event.code === 'Escape') {
        event.preventDefault();
        pause();
      }
    }
  );

  addEventListener(
    'keyup',
    event => {
      K[event.key.toLowerCase()] = false;
    }
  );

  // =========================================================
  // BUTTONS
  // =========================================================

  $('play').onclick = start;

  $('again').onclick = () => {
    setup();
    start();
  };

  $('attack').onclick = attack;
  $('raise').onclick = raise;

  $('ta').onclick = attack;
  $('tr').onclick = raise;

  $('pause').onclick =
    () => pause();

  $('resume').onclick =
    () => pause(false);

  // =========================================================
  // TOUCH JOYSTICK
  // =========================================================

  const joystick =
    $('stick');

  function moveStick(event) {
    const rect =
      joystick.getBoundingClientRect();

    let dx =
      (
        event.clientX -
        rect.left -
        rect.width / 2
      ) /
      (rect.width / 2);

    let dy =
      (
        event.clientY -
        rect.top -
        rect.height / 2
      ) /
      (rect.height / 2);

    const length =
      Math.hypot(dx, dy);

    if (length > 1) {
      dx /= length;
      dy /= length;
    }

    stick = {
      x: dx,
      y: dy
    };

    joystick.firstChild.style.transform =
      `translate(${dx * 22}px, ${dy * 22}px)`;
  }

  joystick.onpointerdown =
    event => {
      joystick.setPointerCapture(
        event.pointerId
      );

      moveStick(event);
    };

  joystick.onpointermove =
    event => {
      if (event.buttons) {
        moveStick(event);
      }
    };

  joystick.onpointerup =
    () => {
      stick = null;

      joystick.firstChild.style.transform =
        'translate(0,0)';
    };
})();
