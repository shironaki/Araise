// =========================================================
// COMBAT — враги, тени, игрок, бой, способности, уровни
// =========================================================
(() => {
  const G = window.ShadowAscendant;
  const { S, P, meta, W, H, dist, clamp, fx, $ } = G;
  const { enemyTypes, shadowTypes, bossCfg, randomEnemyType } = G;

  // =========================================================
  // ВРАГИ
  // =========================================================

  G.spawn = (type = randomEnemyType(), boss = false, elite = false) => {
    const a = Math.random() * Math.PI * 2;
    const distance = G.rand(330, 420);

    const cfg = boss
      ? bossCfg(meta.portal)
      : enemyTypes[type];

    // Сложность растёт с зоной: HP, скорость, урон.
    const zone = Math.max(0, meta.portal - 1);
    const hpScale = boss
      ? 1
      : (1 + zone * 0.18) * (elite ? 2.1 + meta.portal * 0.15 : 1);
    const dmgScale = 1 + zone * 0.08;
    const spdScale = 1 + zone * 0.05;

    S.enemies.push({
      x: clamp(P.x + Math.cos(a) * distance, 30, W - 30),
      y: clamp(P.y + Math.sin(a) * distance, 30, H - 30),
      r: cfg.radius,
      hp: cfg.hp * hpScale,
      max: cfg.hp * hpScale,
      speed: cfg.speed * spdScale,
      damage: cfg.damage * dmgScale,
      xp: cfg.xp,
      type: boss ? 'boss' : type,
      shadowDamage: cfg.shadowDamage,
      shadowSpeed: cfg.shadowSpeed,
      hit: 0,
      boss,
      elite
    });
  };

  // =========================================================
  // ТЕНИ
  // =========================================================

  G.createShadow = (type, x, y) => {
    const cfg = shadowTypes[type] || shadowTypes.soldier;

    return {
      type,
      x,
      y,
      r: cfg.radius,
      hp: 60 + meta.portal * 15,
      max: 60 + meta.portal * 15,
      damage: cfg.damage + meta.portal * 2,
      speed: cfg.speed,
      attackSpeed: cfg.attackSpeed,
      cd: Math.random() * 0.4,
      pulse: Math.random() * Math.PI * 2
    };
  };

  G.summonShadow = (corpse) => {
    if (S.army.length >= G.capacity()) {
      fx(corpse.x, corpse.y, '#ff557d', 12);
      return;
    }

    if (P.mana < G.RAISE_COST) {
      fx(corpse.x, corpse.y, '#3ec1e8', 10);
      return;
    }

    P.mana -= G.RAISE_COST;
    S.army.push(G.createShadow(corpse.type, corpse.x, corpse.y));
    fx(corpse.x, corpse.y, '#8968ff', 24);
    G.runeCircle(corpse.x, corpse.y, '#8968ff', 30, 0.6);
    G.ui();
  };

  G.raise = () => {
    if (!S.go || S.pause || S.choice || S.cleared) {
      return;
    }

    if (S.army.length >= G.capacity()) {
      fx(P.x, P.y, '#ff557d', 12);
      return;
    }

    const corpse =
      S.corpses
        .filter(c => dist(P, c) < 92)
        .sort((a, b) => dist(P, a) - dist(P, b))[0];

    if (!corpse) {
      return;
    }

    S.corpses.splice(S.corpses.indexOf(corpse), 1);
    G.summonShadow(corpse);
  };

  // Тень погибла → возвращается в хранилище.
  G.killShadow = (shadow) => {
    const index = S.army.indexOf(shadow);

    if (index !== -1) {
      S.army.splice(index, 1);
    }

    meta.shadows.push(shadow.type);
    meta.vault = meta.shadows.length;
    G.save();

    fx(shadow.x, shadow.y, '#ff557d', 18);
    G.burst(shadow.x, shadow.y, '#ff557d', 14, 220);
    G.ui();
  };

  // =========================================================
  // УПРАВЛЕНИЕ ТЕНЯМИ
  // =========================================================

  // Ближайшая к игроку тень (для возврата/отпуска).
  function nearestShadow() {
    return S.army
      .sort((a, b) => dist(P, a) - dist(P, b))[0];
  }

  // Призвать тень из хранилища (за ману).
  G.summonFromVault = () => {
    if (!S.go || S.pause || S.choice || S.cleared) {
      return;
    }

    if (S.army.length >= G.capacity()) {
      fx(P.x, P.y, '#ff557d', 12);
      return;
    }

    if (meta.shadows.length === 0) {
      fx(P.x, P.y, '#3ec1e8', 8);
      return;
    }

    if (P.mana < G.SUMMON_COST) {
      fx(P.x, P.y, '#3ec1e8', 8);
      return;
    }

    const type =
      typeof meta.shadows[0] === 'string'
        ? meta.shadows[0]
        : 'soldier';

    meta.shadows.shift();
    P.mana -= G.SUMMON_COST;

    S.army.push(
      G.createShadow(type, P.x - 35 - S.army.length * 16, P.y)
    );

    G.runeCircle(P.x, P.y, '#8968ff', 34, 0.6);
    fx(P.x, P.y, '#8968ff', 24);
    G.ui();
  };

  // Убрать ближайшую тень обратно в хранилище.
  G.returnShadow = () => {
    if (!S.go || S.pause || S.choice || S.cleared) {
      return;
    }

    const shadow = nearestShadow();

    if (!shadow) {
      return;
    }

    S.army.splice(S.army.indexOf(shadow), 1);
    meta.shadows.push(shadow.type);
    meta.vault = meta.shadows.length;
    G.save();

    fx(shadow.x, shadow.y, '#8968ff', 16);
    G.ui();
  };

  // Отпустить ближайшую тень навсегда (освобождает место).
  G.releaseShadow = () => {
    if (!S.go || S.pause || S.choice || S.cleared) {
      return;
    }

    const shadow = nearestShadow();

    if (!shadow) {
      return;
    }

    S.army.splice(S.army.indexOf(shadow), 1);

    fx(shadow.x, shadow.y, '#ff557d', 20);
    G.ui();
  };

  // =========================================================
  // ИГРОК: АТАКА
  // =========================================================

  G.attack = () => {
    if (!S.go || S.pause || S.choice || S.cleared || P.cd > 0) {
      return;
    }

    P.cd = 0.35;
    P.flash = 0.16;

    for (const enemy of S.enemies) {
      const angle = Math.atan2(enemy.y - P.y, enemy.x - P.x);
      const difference = Math.abs(
        Math.atan2(
          Math.sin(angle - P.face),
          Math.cos(angle - P.face)
        )
      );

      if (dist(P, enemy) < P.attackRange && difference < 1.35) {
        enemy.hp -= P.dmg;
        enemy.hit = 0.15;
        fx(enemy.x, enemy.y, '#decfff', 5);
      }
    }

    // След удара клинка.
    G.arc(P.x, P.y, P.face, '#c9b8ff', 54, 0.2);
  };

  // =========================================================
  // ИГРОК: СПОСОБНОСТЬ «ВОЛНА ТЬМЫ»
  // =========================================================

  G.power = () => {
    if (!S.go || S.pause || S.choice || S.cleared || P.pcd > 0) {
      return;
    }

    if (P.mana < G.POWER_COST) {
      fx(P.x, P.y, '#3ec1e8', 8);
      return;
    }

    P.mana -= G.POWER_COST;
    P.pcd = 1.2;

    // Удар по всем врагам в радиусе.
    const radius = 150;

    for (const enemy of S.enemies) {
      if (dist(P, enemy) < radius) {
        enemy.hp -= P.dmg * 1.6;
        enemy.hit = 0.2;
      }
    }

    // Визуальная волна.
    fx(P.x, P.y, '#3ec1e8', 40);
    G.ring(P.x, P.y, '#3ec1e8', 20, 340, 0.5);
    G.burst(P.x, P.y, '#3ec1e8', 22, 260);

    G.ui();
  };

  // =========================================================
  // УРОВНИ И УЛУЧШЕНИЯ
  // =========================================================

  // Применить улучшение по ключу (единая точка для levelUp и испытаний).
  G.applyUpgrade = (key, value) => {
    if (key === 'dmg') P.dmg += value;
    else if (key === 'maxhp') {
      P.max += value;
      P.hp = P.max;
    } else if (key === 'spd') P.spd += value;
    else if (key === 'range') P.attackRange += value;
    else if (key === 'mana') {
      P.maxMana += value;
      P.mana = P.maxMana;
    } else if (key === 'commander') {
      meta.commander += value;
      G.save();
    }
  };

  G.levelUp = (fromReward = false) => {
    S.choice = true;

    // Повышение уровня восстанавливает HP и ману (как в Solo Leveling).
    P.hp = P.max;
    P.mana = P.maxMana;

    $('upgrade').classList.remove('hidden');
    $('choices').innerHTML = '';

    const available =
      [...G.upgrades]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    for (const upgrade of available) {
      const [title, desc, key, value] = upgrade;

      const button = document.createElement('button');
      button.className = 'choice';
      button.innerHTML = `<b>${title}</b><span>${desc}</span>`;

      button.onclick = () => {
        G.applyUpgrade(key, value);

        // ISSUE-001: несколько уровней за одно убийство —
        // показываем выбор повторно, пока очередь не опустеет.
        S.pendingLevels = Math.max(0, (S.pendingLevels || 0) - 1);

        if (S.pendingLevels > 0 && !fromReward) {
          $('choices').innerHTML = '';
          G.levelUp(false);
          return;
        }

        S.choice = false;
        $('upgrade').classList.add('hidden');
        G.ui();

        if (fromReward) {
          // Комната награды: переход открывается сразу.
          $('cleared').classList.remove('hidden');
        } else if (S.enemies.length === 0 && !S.cleared) {
          // Левел-ап с последнего врага: комната фактически очищена —
          // открываем переход, только когда игрок выбрал усиление.
          G.roomCleared();
        }
      };

      $('choices').append(button);
    }
  };

  G.gainXP = (amount) => {
    P.xp += amount;

    // Считаем все полученные уровни и ставим их в очередь,
    // чтобы каждый уровень дал свой выбор усиления (ISSUE-001).
    let levels = 0;

    while (P.xp >= P.next) {
      P.xp -= P.next;
      P.lvl++;
      P.next = Math.round(P.next * 1.35);
      levels++;
    }

    if (levels > 0) {
      S.pendingLevels = (S.pendingLevels || 0) + levels;

      if (!S.choice) {
        G.levelUp();
      }
    }

    G.ui();
  };

  // =========================================================
  // СМЕРТЬ ВРАГА
  // =========================================================

  G.killEnemy = (enemy) => {
    const index = S.enemies.indexOf(enemy);
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

    S.kills += enemy.boss ? 4 : 1;

    // Души теней — валюта забега.
    S.souls += enemy.boss
      ? G.soulValues.boss
      : (G.soulValues[enemy.type] || 3);

    G.gainXP(enemy.boss ? 55 : enemy.xp);

    fx(
      enemy.x,
      enemy.y,
      enemy.boss ? '#ff9d45' : '#ef4d8d',
      enemy.boss ? 24 : 12
    );
    G.burst(
      enemy.x,
      enemy.y,
      enemy.boss ? '#ff9d45' : '#ef4d8d',
      enemy.boss ? 24 : 12,
      240
    );
  };

  // =========================================================
  // БОЕВАЯ ЛОГИКА КАДРА — AI врагов и теней, смерть врагов
  // Единый модуль боя: вызывается из main.js каждый кадр.
  // =========================================================

  G.updateCombatAI = (dt) => {
    // -------------------------
    // ВРАГИ: выбирают ближайшую цель — игрок или тень.
    // -------------------------

    for (const enemy of S.enemies) {
      const candidates = [P, ...S.army.filter(s => s.hp > 0)];
      const target =
        candidates.sort((a, b) =>
          dist(enemy, a) - dist(enemy, b)
        )[0];

      if (!target) {
        continue;
      }

      const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      const distance = dist(enemy, target);

      if (distance > 30) {
        enemy.x += Math.cos(angle) * enemy.speed * dt;
        enemy.y += Math.sin(angle) * enemy.speed * dt;
      } else {
        // Урон по цели: игроку — напрямую, тени — по HP тени.
        if (target === P) {
          P.hp -= enemy.damage * dt;
        } else {
          target.hp -= enemy.damage * dt;

          // Тень погибла → в хранилище.
          if (target.hp <= 0) {
            G.killShadow(target);
          }
        }
      }

      enemy.hit -= dt;
    }

    // -------------------------
    // РАСТАЛКИВАНИЕ ВРАГОВ (BUG-008) — не стоять друг на друге.
    // -------------------------

    for (let i = 0; i < S.enemies.length; i++) {
      const a = S.enemies[i];

      for (let j = i + 1; j < S.enemies.length; j++) {
        const b = S.enemies[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r;

        if (d < min) {
          let nx = dx / d;
          let ny = dy / d;

          if (d < 0.01) {
            // Точное наложение — расталкиваем в случайном направлении.
            const ra = Math.random() * Math.PI * 2;
            nx = Math.cos(ra);
            ny = Math.sin(ra);
          }

          const push = (min - d) / 2;

          a.x = clamp(a.x - nx * push, a.r, W - a.r);
          a.y = clamp(a.y - ny * push, a.r, H - a.r);
          b.x = clamp(b.x + nx * push, b.r, W - b.r);
          b.y = clamp(b.y + ny * push, b.r, H - b.r);
        }
      }
    }

    // -------------------------
    // АРМИЯ ТЕНЕЙ
    // -------------------------

    for (const shadow of S.army) {
      shadow.pulse += dt;

      const targets = S.enemies.filter(e => !e.dead);
      const target =
        targets.sort((a, b) =>
          dist(shadow, a) - dist(shadow, b)
        )[0];

      if (!target) {
        const d = dist(shadow, P);

        if (d > 80) {
          const angle = Math.atan2(P.y - shadow.y, P.x - shadow.x);
          shadow.x += Math.cos(angle) * shadow.speed * dt;
          shadow.y += Math.sin(angle) * shadow.speed * dt;
        }

        continue;
      }

      const distance = dist(shadow, target);
      const angle = Math.atan2(target.y - shadow.y, target.x - shadow.x);

      if (distance > 30) {
        shadow.x += Math.cos(angle) * shadow.speed * dt;
        shadow.y += Math.sin(angle) * shadow.speed * dt;
      } else if (shadow.cd <= 0) {
        target.hp -= shadow.damage;
        shadow.cd = shadow.attackSpeed;
        fx(target.x, target.y, '#785cff', 3);
      }

      shadow.cd -= dt;
    }

    // -------------------------
    // СМЕРТЬ ВРАГОВ
    // -------------------------

    const dead = S.enemies.filter(e => e.hp <= 0);

    for (const enemy of dead) {
      G.killEnemy(enemy);
    }
  };
})();
