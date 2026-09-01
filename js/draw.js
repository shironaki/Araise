// =========================================================
// DRAW — отрисовка на canvas
// Стиль: 2D anime dark fantasy (Solo Leveling vibe) —
// некромант с армией теней, top-down вид как Soul Knight.
// Cel-shading: базовый тон + полутень + rim-свет, чёткие силуэты.
// =========================================================
(() => {
  const G = window.ShadowAscendant;
  const { S, P, W, H, ctx: X, circle, clamp } = G;
  const { enemyTypes, shadowTypes } = G;

  const TAU = Math.PI * 2;

  // ---------- Цветовые хелперы (cel-shading) ----------
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // amt > 0 — осветлить к белому; amt < 0 — затемнить к чёрному.
  function tone(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const f = c => amt >= 0
      ? Math.round(c + (255 - c) * amt)
      : Math.round(c * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  function radial(x, y, r, c0, c1) {
    const g = X.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    X.fillStyle = g;
    X.beginPath();
    X.arc(x, y, r, 0, TAU);
    X.fill();
  }

  // =========================================================
  // ЧЕЛОВЕКОПОДОБНЫЙ ПЕРСОНАЖ (top-down, cel-shading)
  // =========================================================
  // opts:
  //   r      — базовый радиус
  //   dir    — направление взгляда (радианы)
  //   body   — цвет плаща/тела
  //   coat   — цвет плечевого пояса
  //   skin   — цвет головы/кистей
  //   hair   — цвет волос (null = без волос)
  //   eye    — цвет свечения глаз
  //   weapon — тип оружия: 'sword' | 'none'
  //   glow   — цвет ауры (null = нет)
  function humanoid(x, y, r, dir, o) {
    // Тень под ногами (не поворачивается).
    X.fillStyle = 'rgba(0,0,0,0.45)';
    X.beginPath();
    X.ellipse(x, y + r * 0.15, r * 1.15, r * 0.55, 0, 0, TAU);
    X.fill();

    X.save();
    X.translate(x, y);
    X.rotate(dir);

    // Аура (свечение вокруг).
    if (o.glow) {
      X.shadowBlur = 22;
      X.shadowColor = o.glow;
    }

    // Плащ — развевается позади (темнее тела).
    X.fillStyle = o.body;
    X.beginPath();
    X.ellipse(-r * 0.45, 0, r * 0.85, r * 0.95, 0, 0, TAU);
    X.fill();

    // Плечевой пояс (широкий).
    X.fillStyle = o.coat;
    X.beginPath();
    X.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0, TAU);
    X.fill();

    // Cel-полутень снизу-сзади.
    X.fillStyle = 'rgba(0,0,0,0.30)';
    X.beginPath();
    X.ellipse(-r * 0.35, r * 0.25, r * 1.05, r * 0.5, 0, 0, TAU);
    X.fill();

    X.shadowBlur = 0;

    // Контур тела.
    X.strokeStyle = o.outline || '#00000088';
    X.lineWidth = 1.5;
    X.beginPath();
    X.ellipse(0, 0, r * 1.25, r * 0.85, 0, 0, TAU);
    X.stroke();

    // Руки — два овала вперёд (рукава темнее пояса).
    X.fillStyle = tone(o.coat, -0.25);
    X.beginPath();
    X.ellipse(r * 0.55, -r * 0.55, r * 0.34, r * 0.22, 0, 0, TAU);
    X.fill();
    X.beginPath();
    X.ellipse(r * 0.55, r * 0.55, r * 0.34, r * 0.22, 0, 0, TAU);
    X.fill();

    // Кисти рук.
    X.fillStyle = o.skin;
    X.beginPath();
    X.arc(r * 0.8, -r * 0.55, r * 0.14, 0, TAU);
    X.fill();
    X.beginPath();
    X.arc(r * 0.8, r * 0.55, r * 0.14, 0, TAU);
    X.fill();

    // Оружие — клинок вперёд.
    if (o.weapon === 'sword') {
      X.fillStyle = o.weaponColor || '#e8e1ff';
      X.strokeStyle = '#00000066';
      X.lineWidth = 1;
      // Лезвие (вытянутая линза).
      X.beginPath();
      X.moveTo(r * 0.5, -r * 0.12);
      X.quadraticCurveTo(r * 1.9, 0, r * 0.5, r * 0.12);
      X.closePath();
      X.fill();
      X.stroke();
    }

    // Голова (круг).
    X.fillStyle = o.skin;
    X.beginPath();
    X.arc(r * 0.55, 0, r * 0.48, 0, TAU);
    X.fill();

    // Аниме-волосы: пряди поверх головы.
    if (o.hair) {
      X.fillStyle = o.hair;
      X.beginPath();
      X.arc(r * 0.55, 0, r * 0.48, Math.PI * 0.85, Math.PI * 2.15);
      X.fill();

      // Пряди-шипы.
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * (0.95 + i * 0.35);
        X.beginPath();
        X.moveTo(
          r * 0.55 + Math.cos(a) * r * 0.42,
          Math.sin(a) * r * 0.42
        );
        X.lineTo(
          r * 0.55 + Math.cos(a + 0.2) * r * 0.62,
          Math.sin(a + 0.2) * r * 0.62
        );
        X.lineTo(
          r * 0.55 + Math.cos(a + 0.4) * r * 0.42,
          Math.sin(a + 0.4) * r * 0.42
        );
        X.closePath();
        X.fill();
      }
    }

    // Контур головы.
    X.strokeStyle = o.outline || '#00000066';
    X.lineWidth = 1;
    X.beginPath();
    X.arc(r * 0.55, 0, r * 0.48, 0, TAU);
    X.stroke();

    // Светящиеся глаза (два, на передней части головы).
    X.fillStyle = o.eye;
    X.shadowBlur = 8;
    X.shadowColor = o.eye;
    const ex = r * 0.78;
    const ey = r * 0.2;
    X.beginPath();
    X.arc(ex, -ey, r * 0.12, 0, TAU);
    X.arc(ex, ey, r * 0.12, 0, TAU);
    X.fill();
    X.shadowBlur = 0;

    // Rim-свет: яркая дуга по переднему краю.
    X.strokeStyle = tone(o.coat, 0.45);
    X.lineWidth = 1.6;
    X.globalAlpha = 0.8;
    X.beginPath();
    X.ellipse(0, 0, r * 1.22, r * 0.82, 0, -0.9, 0.9);
    X.stroke();
    X.globalAlpha = 1;

    X.restore();
  }

  // =========================================================
  // ФОН (тема зоны + тайлы + искры; можно заменить сгенерированным bg-N.png)
  // =========================================================
  function drawBackground() {
    const theme = G.zoneTheme();

    // Сгенерированный фон зоны (assets/bg-N.png), если есть.
    const zoneIdx = (G.meta.portal - 1) % 4 + 1;
    const bg = G.bgImages[zoneIdx];

    if (bg && bg.width > 0) {
      const scale = Math.max(W / bg.width, H / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      X.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const gradient = X.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 700);
      gradient.addColorStop(0, theme.bg[0]);
      gradient.addColorStop(1, theme.bg[1]);
      X.fillStyle = gradient;
      X.fillRect(0, 0, W, H);
    }

    // Плитка пола — поверх фона, чтобы игровое поле читалось.
    X.strokeStyle = theme.tile;
    X.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      X.beginPath(); X.moveTo(x, 0); X.lineTo(x, H); X.stroke();
    }
    for (let y = 0; y < H; y += 48) {
      X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke();
    }

    // Мерцающие искры портала (цвет темы зоны).
    for (let i = 0; i < 20; i++) {
      const px = (i * 137 + 40) % W;
      const py = (i * 211 + 20) % H;
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(S.last * 0.001 + i));
      X.globalAlpha = twinkle * 0.4;
      X.fillStyle = theme.glow;
      X.beginPath();
      X.arc(px, py, 1.5, 0, TAU);
      X.fill();
    }
    X.globalAlpha = 1;
  }

  // =========================================================
  // ТРУПЫ
  // =========================================================
  function drawCorpses() {
    for (const corpse of S.corpses) {
      const cfg = shadowTypes[corpse.type] || shadowTypes.soldier;
      radial(corpse.x, corpse.y, corpse.r * 0.85, '#1a0f1e', '#0d0812');

      const pulse = 1 + 0.12 * Math.sin(S.last * 0.006);
      X.strokeStyle = cfg.color + '99';
      X.lineWidth = 2;
      X.beginPath();
      X.arc(corpse.x, corpse.y, (corpse.r + 6) * pulse, 0, TAU);
      X.stroke();
      X.lineWidth = 1;
    }
  }

  // =========================================================
  // ТЕНИ (АРМИЯ)
  // =========================================================
  function drawShadows() {
    for (const shadow of S.army) {
      const cfg = shadowTypes[shadow.type] || shadowTypes.soldier;

      let facing = 0;
      const nearest =
        S.enemies.length > 0
          ? S.enemies.slice().sort((a, b) =>
              G.dist(shadow, a) - G.dist(shadow, b))[0]
          : P;
      facing = Math.atan2(nearest.y - shadow.y, nearest.x - shadow.x);

      // Тени — живые существа из тьмы: тёмный силуэт + светящиеся глаза.
      humanoid(shadow.x, shadow.y, shadow.r, facing, {
        body: '#0b0716',
        coat: '#16102a',
        skin: '#120c20',
        hair: null,
        eye: cfg.color,
        weapon: 'sword',
        weaponColor: '#2c2442',
        glow: cfg.color,
        outline: '#000000cc'
      });

      // HP-полоска.
      if (shadow.hp < shadow.max) {
        X.fillStyle = '#241421';
        X.fillRect(shadow.x - shadow.r, shadow.y - shadow.r - 12, shadow.r * 2, 4);
        X.fillStyle = cfg.color;
        X.fillRect(
          shadow.x - shadow.r,
          shadow.y - shadow.r - 12,
          shadow.r * 2 * clamp(shadow.hp / shadow.max, 0, 1),
          4
        );
      }
    }
  }

  // =========================================================
  // ВРАГИ — модели по типам
  // =========================================================

  // Базовый монстр: тело + ядро-глаз + когти (soldier / runner / brute).
  function drawMonster(enemy, cfg, facing) {
    X.save();
    X.translate(enemy.x, enemy.y);
    X.rotate(facing);

    X.fillStyle = 'rgba(0,0,0,0.4)';
    X.beginPath();
    X.ellipse(0, enemy.r * 0.15, enemy.r * 1.1, enemy.r * 0.5, 0, 0, TAU);
    X.fill();

    const color = enemy.hit > 0 ? '#ffffff' : cfg.color;
    radial(0, 0, enemy.r, color, cfg.core);

    X.strokeStyle = '#00000088';
    X.lineWidth = 1.5;
    X.beginPath();
    X.arc(0, 0, enemy.r, 0, TAU);
    X.stroke();

    // Cel-полутень.
    X.fillStyle = 'rgba(0,0,0,0.25)';
    X.beginPath();
    X.ellipse(-enemy.r * 0.3, enemy.r * 0.3, enemy.r * 0.8, enemy.r * 0.45, 0, 0, TAU);
    X.fill();

    // Когти/шипы спереди.
    X.fillStyle = cfg.core;
    const claws = enemy.type === 'brute' ? 4 : 3;
    for (let i = 0; i < claws; i++) {
      const off = (i - (claws - 1) / 2) * enemy.r * 0.4;
      X.beginPath();
      X.arc(enemy.r * 0.85, off, enemy.r * 0.2, 0, TAU);
      X.fill();
    }

    // Рога для брута.
    if (enemy.type === 'brute') {
      X.fillStyle = tone(cfg.color, -0.3);
      for (const s of [-1, 1]) {
        X.beginPath();
        X.moveTo(s * enemy.r * 0.15, -enemy.r * 0.55);
        X.lineTo(s * enemy.r * 0.55, -enemy.r * 1.15);
        X.lineTo(s * enemy.r * 0.55, -enemy.r * 0.35);
        X.closePath();
        X.fill();
      }
    }

    // Ядро-глаз.
    X.fillStyle = enemy.elite ? '#ffe3f1' : '#ffd6e6';
    X.shadowBlur = 8;
    X.shadowColor = color;
    X.beginPath();
    X.arc(0, 0, enemy.r * 0.38, 0, TAU);
    X.fill();
    X.shadowBlur = 0;

    // Кольцо элиты.
    if (enemy.elite) {
      X.strokeStyle = '#ffd1e8';
      X.lineWidth = 2;
      X.beginPath();
      X.arc(0, 0, enemy.r + 6, 0, TAU);
      X.stroke();
      X.lineWidth = 1;
    }

    X.restore();
  }

  // Бронированный рыцарь (warden): тяжёлая броня + меч, холодное свечение.
  function drawArmored(enemy, cfg, facing) {
    humanoid(enemy.x, enemy.y, enemy.r, facing, {
      body: tone(cfg.core, -0.2),
      coat: cfg.color,
      skin: cfg.core,
      hair: null,
      eye: '#ffffff',
      weapon: 'sword',
      weaponColor: tone(cfg.color, 0.5),
      glow: cfg.color,
      outline: '#000000aa'
    });
  }

  // Маг/жнец/оракул: мантия, скрытое лицо, пламя над капюшоном.
  function drawHooded(enemy, cfg, facing) {
    X.save();
    X.translate(enemy.x, enemy.y);
    X.rotate(facing);

    X.fillStyle = 'rgba(0,0,0,0.4)';
    X.beginPath();
    X.ellipse(0, enemy.r * 0.15, enemy.r * 1.1, enemy.r * 0.5, 0, 0, TAU);
    X.fill();

    radial(0, 0, enemy.r, enemy.hit > 0 ? '#ffffff' : cfg.color, tone(cfg.core, -0.3));

    // Капюшон — тёмный овал.
    X.fillStyle = '#0b0612';
    X.beginPath();
    X.ellipse(0, -enemy.r * 0.1, enemy.r * 0.7, enemy.r * 0.5, 0, 0, TAU);
    X.fill();

    // Светящиеся глаза из-под капюшона.
    X.fillStyle = cfg.color;
    X.shadowBlur = 8;
    X.shadowColor = cfg.color;
    X.beginPath();
    X.arc(enemy.r * 0.2, -enemy.r * 0.1, enemy.r * 0.12, 0, TAU);
    X.arc(enemy.r * 0.2, enemy.r * 0.14, enemy.r * 0.12, 0, TAU);
    X.fill();
    X.shadowBlur = 0;

    // Пламя над капюшоном.
    X.fillStyle = cfg.color;
    X.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) {
      const a = S.last * 0.01 + i * 2.1;
      X.beginPath();
      X.arc(
        Math.cos(a) * enemy.r * 0.5,
        -enemy.r * 0.9 + Math.sin(a) * enemy.r * 0.15,
        enemy.r * 0.16,
        0,
        TAU
      );
      X.fill();
    }
    X.globalAlpha = 1;

    X.restore();
  }

  // Босс — Хранитель Врат: демон с шипами и большими рогами.
  function drawBoss(enemy) {
    X.save();
    X.translate(enemy.x, enemy.y);
    const facing = Math.atan2(P.y - enemy.y, P.x - enemy.x);
    X.rotate(facing);

    X.fillStyle = 'rgba(0,0,0,0.45)';
    X.beginPath();
    X.ellipse(0, enemy.r * 0.2, enemy.r * 1.3, enemy.r * 0.6, 0, 0, TAU);
    X.fill();

    X.shadowBlur = 30;
    X.shadowColor = '#ff9d45';
    radial(0, 0, enemy.r, '#ffb05e', '#7a3a14');
    X.shadowBlur = 0;

    // Шипы-рога по кругу.
    X.fillStyle = '#ffb05e';
    X.strokeStyle = '#00000066';
    X.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      X.beginPath();
      X.arc(Math.cos(a) * enemy.r * 1.2, Math.sin(a) * enemy.r * 1.2, 5, 0, TAU);
      X.fill();
    }

    // Большие рога спереди.
    X.fillStyle = '#8a4a1e';
    for (const s of [-1, 1]) {
      X.beginPath();
      X.moveTo(s * enemy.r * 0.3, -enemy.r * 0.4);
      X.quadraticCurveTo(s * enemy.r * 1.1, -enemy.r * 1.2, s * enemy.r * 0.7, -enemy.r * 1.5);
      X.lineTo(s * enemy.r * 0.6, -enemy.r * 0.8);
      X.closePath();
      X.fill();
    }

    // Глаза.
    X.fillStyle = '#ffdfae';
    X.shadowBlur = 10;
    X.shadowColor = '#ff9d45';
    X.beginPath();
    X.arc(enemy.r * 0.4, -enemy.r * 0.3, 4, 0, TAU);
    X.arc(enemy.r * 0.4, enemy.r * 0.3, 4, 0, TAU);
    X.fill();
    X.shadowBlur = 0;

    X.restore();
  }

  function drawEnemies() {
    for (const enemy of S.enemies) {
      const cfg = enemy.boss
        ? { name: 'ХРАНИТЕЛЬ ВРАТ', color: '#e98d39', core: '#4a2614' }
        : enemyTypes[enemy.type];
      const facing = Math.atan2(P.y - enemy.y, P.x - enemy.x);

      if (enemy.boss) {
        drawBoss(enemy);
      } else if (enemy.type === 'warden') {
        drawArmored(enemy, cfg, facing);
      } else if (enemy.type === 'caster' || enemy.type === 'reaper' || enemy.type === 'oracle') {
        drawHooded(enemy, cfg, facing);
      } else {
        drawMonster(enemy, cfg, facing);
      }

      // HP-полоска.
      X.fillStyle = '#241421';
      X.fillRect(enemy.x - enemy.r, enemy.y - enemy.r - 12, enemy.r * 2, 4);
      X.fillStyle = enemy.boss ? '#ffb05e' : '#ff668d';
      X.fillRect(
        enemy.x - enemy.r,
        enemy.y - enemy.r - 12,
        enemy.r * 2 * clamp(enemy.hp / enemy.max, 0, 1),
        4
      );
    }
  }

  // =========================================================
  // ИГРОК (НЕКРОМАНТ) + АУРА ТЕНЕЙ
  // =========================================================
  function drawPlayer() {
    humanoid(P.x, P.y, P.r, P.face, {
      body: '#131022',
      coat: '#241c3d',
      skin: '#d9c9b0',
      hair: '#0e0e16',
      eye: '#9b6dff',
      weapon: 'sword',
      weaponColor: '#e8e1ff',
      glow: '#7c5cff',
      outline: '#00000088'
    });

    // Удар — фиолетовая дуга.
    if (P.flash > 0) {
      X.save();
      X.translate(P.x, P.y);
      X.rotate(P.face);
      X.strokeStyle = '#c9b8ff';
      X.lineWidth = 7;
      X.beginPath();
      X.arc(0, 0, P.r + 14, -0.9, 0.9);
      X.stroke();
      X.lineWidth = 1;
      X.restore();
    }

    // Кулдаун способности — кольцо.
    if (P.pcd > 0) {
      X.save();
      X.translate(P.x, P.y);
      X.strokeStyle = '#3ec1e8';
      X.lineWidth = 3;
      X.beginPath();
      X.arc(0, 0, P.r + 10, 0, TAU * clamp(1 - P.pcd / 1.2, 0, 1));
      X.stroke();
      X.lineWidth = 1;
      X.restore();
    }
  }

  // Энергия теней вокруг героя: дым/пламя/частицы (анимировано временем).
  function heroAura() {
    const t = S.last * 0.001;

    X.save();
    X.translate(P.x, P.y);

    for (let i = 0; i < 6; i++) {
      const a = t * 1.6 + (i / 6) * TAU;
      const d = P.r + 16 + Math.sin(t * 2 + i) * 6;
      const px = Math.cos(a) * d;
      const py = Math.sin(a) * d * 0.8;
      const size = 3 + Math.sin(t * 3 + i * 2) * 1.5;

      X.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i);
      X.fillStyle = '#7c5cff';
      X.beginPath();
      X.arc(px, py, size, 0, TAU);
      X.fill();
    }

    X.globalAlpha = 1;
    X.restore();
  }

  // =========================================================
  // ПОРТАЛ-ОБЪЕКТ (декор; механика входа — оверлей «ДАЛЬШЕ»)
  // =========================================================
  function drawPortal() {
    const roomType = G.zoneChain[S.roomIndex];
    const show = S.cleared || roomType === 'portal' || roomType === 'boss';
    if (!show) {
      return;
    }

    const pos = G.portalPos();
    const x = pos.x;
    const y = pos.y;
    const r = 44;
    const pulse = 1 + 0.08 * Math.sin(S.last * 0.004);

    // Тёмная арка.
    X.fillStyle = '#0a0a14';
    X.strokeStyle = '#2c2454';
    X.lineWidth = 4;
    X.beginPath();
    X.arc(x, y, r * pulse, 0, TAU);
    X.fill();
    X.stroke();

    // Энергетическое ядро.
    X.shadowBlur = 26;
    X.shadowColor = '#8970ff';
    radial(x, y, r * 0.75 * pulse, '#b9a5ff', '#241a4a');
    X.shadowBlur = 0;

    // Внутреннее кольцо.
    X.strokeStyle = '#b9a5ff';
    X.lineWidth = 2;
    X.beginPath();
    X.arc(x, y, r * 0.55, 0, TAU);
    X.stroke();

    // Частицы вокруг.
    for (let i = 0; i < 5; i++) {
      const a = S.last * 0.002 + (i / 5) * TAU;
      X.globalAlpha = 0.6;
      X.fillStyle = '#b9a5ff';
      X.beginPath();
      X.arc(
        x + Math.cos(a) * r * 1.2,
        y + Math.sin(a) * r * 1.2,
        2.4,
        0,
        TAU
      );
      X.fill();
    }
    X.globalAlpha = 1;
  }

  // =========================================================
  // ЭФФЕКТЫ (VFX) — искры, дуги, кольца, руны
  // =========================================================
  function drawParticles() {
    for (const p of S.fx) {
      const alpha = clamp(p.t * 2.5, 0, 1);

      if (p.kind === 'ring') {
        X.globalAlpha = alpha;
        X.strokeStyle = p.color;
        X.lineWidth = 3 * alpha;
        X.beginPath();
        X.arc(p.x, p.y, p.r, 0, TAU);
        X.stroke();
      } else if (p.kind === 'arc') {
        X.globalAlpha = alpha;
        X.strokeStyle = p.color;
        X.lineWidth = 6 * alpha;
        X.beginPath();
        X.arc(p.x, p.y, p.r, p.dir - 0.9, p.dir + 0.9);
        X.stroke();
      } else if (p.kind === 'rune') {
        X.save();
        X.translate(p.x, p.y);
        X.rotate(p.rot + (1 - p.t) * 3);
        X.globalAlpha = alpha;
        X.strokeStyle = p.color;
        X.lineWidth = 1.6;
        X.beginPath();
        X.arc(0, 0, p.r, 0, TAU);
        X.stroke();
        X.beginPath();
        X.arc(0, 0, p.r * 0.62, 0, TAU);
        X.stroke();
        // Руны-штрихи.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          X.beginPath();
          X.moveTo(Math.cos(a) * p.r * 0.62, Math.sin(a) * p.r * 0.62);
          X.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
          X.stroke();
        }
        X.restore();
      } else {
        // Обычная частица-искра.
        X.globalAlpha = alpha;
        X.fillStyle = p.color;
        X.beginPath();
        X.arc(p.x, p.y, 2.2, 0, TAU);
        X.fill();
      }
    }
    X.globalAlpha = 1;
  }

  // =========================================================
  // КОМПОЗИЦИЯ
  // =========================================================
  G.draw = () => {
    drawBackground();
    drawCorpses();
    drawShadows();
    drawEnemies();
    drawPlayer();
    heroAura();
    drawPortal();
    drawParticles();
  };

  // =========================================================
  // АССЕТЫ: фоны зон из assets/bg-N.png (если есть).
  // Пока файлов нет — работает процедурный фон темы.
  // =========================================================
  G.bgImages = {};

  for (let i = 1; i <= 4; i++) {
    const img = new Image();
    img.onload = () => {
      G.bgImages[i] = img;
    };
    img.src = `assets/bg-${i}.png`;
  }
})();