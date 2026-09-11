/* ============================================================
   Баланс: два автоигрока прогоняют порталы подряд.
     novice — идёт напролом, берёт первое усиление;
     good   — держит дистанцию, отступает и выбирает усиления.
   Запуск: npm run balance
   ============================================================ */
import { createEnv } from './dom-stub.mjs';

const PRIORITY = ['vitality', 'blade', 'commander', 'wrath', 'regen', 'lifesteal', 'haste', 'reach', 'step'];

export function simulate({ seed = 42, maxSeconds = 400, save = null, skill = 'good' } = {}) {
  const env = createEnv({
    seed,
    storage: save ? { 'shadow-ascendant': JSON.stringify(save) } : undefined
  });

  const { game, elements, frame, key, errors } = env;

  elements.get('play').click();

  const dt = 1 / 60;
  const steps = Math.round(maxSeconds / dt);
  const stats = { upgradePicks: 0, maxEnemies: 0, maxArmy: 0, bossSeen: false };
  let lastHp = 0;

  for (let i = 0; i < steps; i++) {
    const s = game.state;
    const p = game.player;

    if (!s.go) break;

    if (s.choice) {
      if (skill === 'good') {
        let best = 0;
        let bestRank = 99;
        s.options.forEach((o, idx) => {
          const rank = PRIORITY.indexOf(o.id);
          if (rank < bestRank) { bestRank = rank; best = idx; }
        });
        elements.get('choices').children[best].click();
      } else {
        elements.get('choices').children[0].click();
      }
      stats.upgradePicks++;
      frame(dt * 1000);
      continue;
    }

    const W = 960;
    const H = 600;
    const enemies = s.enemies.filter((e) => e.hp > 0);

    let target = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; target = e; }
    }

    const hpRatio = p.hp / p.maxHp;
    const inDanger = enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 34);

    let dx = 0;
    let dy = 0;
    const range = p.attackRange;

    if (target) {
      let ax = target.x - p.x;
      let ay = target.y - p.y;
      const len = Math.hypot(ax, ay) || 1;
      ax /= len; ay /= len;

      const flee = hpRatio < 0.45 && inDanger;
      if (flee) { dx = -ax; dy = -ay; }
      else if (bestD > range * 0.85) { dx = ax; dy = ay; }
      else if (bestD < range * 0.68) { dx = -ax * 0.6 - ay; dy = -ay * 0.6 + ax; }
      else { dx = -ay; dy = ax; }
    } else {
      let corpse = null;
      let cd = Infinity;
      for (const c of s.corpses) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < cd) { cd = d; corpse = c; }
      }
      if (corpse && cd > 30) {
        dx = corpse.x - p.x; dy = corpse.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
      }
    }

    // мягкие границы арены
    const margin = 70;
    if (p.x < margin) dx += (margin - p.x) / margin;
    if (p.x > W - margin) dx -= (p.x - (W - margin)) / margin;
    if (p.y < margin) dy += (margin - p.y) / margin;
    if (p.y > H - margin) dy -= (p.y - (H - margin)) / margin;

    const want = { w: dy < -0.25, s: dy > 0.25, a: dx < -0.25, d: dx > 0.25 };
    for (const k of ['w', 'a', 's', 'd']) {
      if (want[k] !== !!game.keys[k]) key('keydown', k, 'Key' + k.toUpperCase());
    }

    if (target && bestD < range + target.r && (hpRatio > 0.3 || !inDanger)) game.api.attack();

    // подбираем трупы в радиусе подъёма
    if (s.corpses.length < 12) game.api.raise();

    frame(dt * 1000);
    stats.maxEnemies = Math.max(stats.maxEnemies, s.enemies.length);
    stats.maxArmy = Math.max(stats.maxArmy, s.army.length);
    if (s.boss) stats.bossSeen = true;
  }

  return {
    errors: errors.map((e) => e.message),
    time: env.time / 1000,
    won: elements.get('endtitle').textContent === 'ВРАТА ОЧИЩЕНЫ',
    portal: game.meta.portal,
    kills: game.state.kills,
    goal: game.state.goal,
    level: game.player.lvl,
    hp: game.player.hp,
    phase: game.state.phase,
    maxEnemies: stats.maxEnemies,
    maxArmy: stats.maxArmy,
    army: game.state.army.length,
    vault: game.meta.shadows.length,
    upgrades: stats.upgradePicks,
    endTitle: elements.get('endtitle').textContent,
    objective: elements.get('objective').textContent
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const skill of ['novice', 'good']) {
    console.log(`\n--- профиль: ${skill} ---`);
    let wins = 0;
    for (const portal of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const vault = Array.from({ length: Math.min(8, (portal - 1) * 2) }, (_, i) => ['soldier', 'runner', 'brute'][i % 3]);
      const save = { portal, shadows: vault, clears: portal - 1, kills: 0, best: portal };
      const r = simulate({ seed: portal * 7919, save, maxSeconds: 400, skill });
      if (r.won) wins++;
      console.log(
        `портал ${portal}: ${r.won ? 'ПОБЕДА' : (r.phase === 'over' ? 'поражение' : 'таймаут')}`,
        `| ${r.time.toFixed(0)}с`,
        `| убийств ${r.kills}/${r.goal}`,
        `| ур.${r.level}`,
        `| теней ${r.army}`,
        `| HP ${r.hp.toFixed(0)}`,
        `| усил.${r.upgrades}`,
        `| врагов макс ${r.maxEnemies}`,
        `| ошибок ${r.errors.length}`
      );
    }
    console.log(`итого побед: ${wins}/8`);
  }
}
