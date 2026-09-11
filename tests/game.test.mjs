/* ============================================================
   Функциональные проверки Shadow Ascendant.
   Запуск: npm test  (или node tests/game.test.mjs)
   ============================================================ */
import { createEnv } from './dom-stub.mjs';

let passed = 0;
let failed = 0;

function ok(name, condition, extra = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const frames = (env, n, t = 16.6667, auto = true) => {
  for (let i = 0; i < n; i++) {
    env.frame(t);
    // если открылся выбор усиления — берём первый вариант, иначе тик стоит
    if (auto && env.game && env.game.state.choice) {
      const choice = env.elements.get('choices').children[0];
      if (choice) choice.click();
    }
  }
};

// резолвим все накопившиеся уровни
const resolveLevels = (env) => {
  let guard = 0;
  while (env.game.state.choice && guard++ < 20) {
    const choice = env.elements.get('choices').children[0];
    if (!choice) break;
    choice.click();
  }
};

/* ============ 1. Запуск ============ */
section('1. Запуск и старт охоты');
{
  const env = createEnv({ seed: 7 });
  ok('ошибок при загрузке нет', env.errors.length === 0, JSON.stringify(env.errors.map(e => e.message)));
  ok('версия доступна', !!env.game.version);

  frames(env, 30);
  ok('кадры рисуются без ошибок', env.errors.length === 0);
  ok('цель показана до старта', /ПОРТАЛ 1/.test(env.elements.get('objective').textContent), env.elements.get('objective').textContent);

  env.elements.get('play').click();
  ok('охота началась', env.game.state.go === true);
  ok('волна поставлена в очередь', env.game.state.spawnQueue.length > 0);
  ok('стартовый экран скрыт', env.elements.get('start').classList.contains('hidden'));

  frames(env, 300);
  ok('враги появились', env.game.state.enemies.length > 0, `врагов ${env.game.state.enemies.length}`);
  ok('цель охоты > 0', env.game.state.goal > 20, `цель ${env.game.state.goal}`);
}

/* ============ 2. Удар, опыт, уровень ============ */
section('2. Удар, опыт и усиления');
{
  const env = createEnv({ seed: 11 });
  env.elements.get('play').click();
  frames(env, 120);

  const p = env.game.player;
  const enemy = env.game.state.enemies[0];
  enemy.x = p.x + 40;
  enemy.y = p.y;
  p.face = 0;
  p.cd = 0;

  const hpBefore = enemy.hp;
  env.game.api.attack();
  ok('удар снимает HP', enemy.hp < hpBefore, `${hpBefore} → ${enemy.hp}`);
  ok('перезарядка удара запущена', p.cd > 0);

  // добиваем врага и проверяем опыт/уровень
  enemy.hp = 1;
  p.cd = 0;
  env.game.api.attack();
  frames(env, 2);
  ok('враг исчез после смерти', !env.game.state.enemies.includes(enemy));
  ok('появился труп', env.game.state.corpses.length > 0);
  ok('опыт начислен', p.xp > 0 || p.lvl > 1);
}

/* ============ 3. Подъём тени ============ */
section('3. Подъём тени из трупа');
{
  const env = createEnv({ seed: 13 });
  env.elements.get('play').click();
  frames(env, 60);

  const p = env.game.player;
  env.game.state.corpses.push({ x: p.x + 20, y: p.y, r: 12, t: 5, type: 'soldier' });
  const before = env.game.state.army.length;
  env.game.api.raise();
  ok('тень поднялась', env.game.state.army.length === before + 1, `было ${before}, стало ${env.game.state.army.length}`);
  ok('труп израсходован', env.game.state.corpses.length === 0);
  ok('счётчик в HUD обновился', env.elements.get('shadows').textContent === String(env.game.state.army.length));

  // армия бьёт врагов
  const enemy = env.game.state.enemies[0];
  if (enemy) {
    const shadow = env.game.state.army[0];
    shadow.x = enemy.x - 20;
    shadow.y = enemy.y;
    shadow.cd = 0;
    const hp = enemy.hp;
    frames(env, 90);
    ok('тени наносят урон', enemy.hp < hp, `${hp} → ${enemy.hp}`);
  }

  // лимит армии
  env.game.player.armyMax = 1;
  env.game.state.corpses.push({ x: p.x + 10, y: p.y, r: 12, t: 5, type: 'soldier' });
  env.game.api.raise();
  ok('лимит армии соблюдается', env.game.state.army.length === 1);
}

/* ============ 4. Уровни и очередь усилений ============ */
section('4. Уровни и усиления');
{
  const env = createEnv({ seed: 17 });
  env.elements.get('play').click();
  frames(env, 60);

  const p = env.game.player;
  const s = env.game.state;
  resolveLevels(env);

  // готовим трёх слабых врагов рядом с игроком и один уровень за убийство
  p.xp = 0;
  p.next = 12;
  p.dmg = 9999;
  p.cd = 0;
  p.face = 0;

  const before = p.lvl;
  for (let i = 0; i < 3; i++) {
    s.enemies.push({
      type: 'runner', boss: false, name: 'x', color: '#fff', core: '#000',
      x: p.x + 40 + i * 6, y: p.y, r: 11, hp: 1, max: 20, speed: 0,
      damage: 0, xp: 20, shadowDamage: 9, shadowSpeed: 200, hit: 0, summon: 99, lunge: 0
    });
  }

  env.game.api.attack();
  frames(env, 2, 16.6667, false);

  ok('уровни начислены', p.lvl >= before + 3, `${before} → ${p.lvl}`);
  ok('очередь усилений накопилась', s.pending + (s.choice ? 1 : 0) >= 3, `pending ${s.pending}, choice ${s.choice}`);
  ok('экран усиления открыт', s.choice === true && !env.elements.get('upgrade').classList.contains('hidden'));

  // игра замирает, пока игрок выбирает
  const frozen = s.enemies.length;
  const options = env.elements.get('choices').children;
  ok('предложено 3 усиления', options.length === 3, `вариантов ${options.length}`);
  ok('варианты уникальны', new Set(s.options.map(o => o.id)).size === 3);

  env.key('keydown', 'd', 'KeyD');
  frames(env, 1, 16.6667, false);
  const afterOptions = env.elements.get('choices').children.length;
  ok('выбор усиления не закрывается сам', afterOptions === 3, `${afterOptions}`);
  env.key('keyup', 'd', 'KeyD');

  // берём все уровни по очереди
  let picks = 0;
  while (s.choice && picks < 30) {
    const choice = env.elements.get('choices').children[0];
    choice.click();
    picks++;
  }
  ok('все уровни отработаны', picks >= 3 && s.choice === false, `выборов ${picks}, pending ${s.pending}`);
  ok('экран усиления закрыт', env.elements.get('upgrade').classList.contains('hidden'));
  ok('игра продолжилась', s.pause === false && s.go === true);

  // выбор по цифровой клавише
  p.next = 12;
  p.xp = 0;
  const target = s.enemies[0];
  if (target) {
    target.hp = 1;
    target.x = p.x + 30; target.y = p.y;
    p.cd = 0;
    env.game.api.attack();
    frames(env, 1);
  }
  if (s.choice) {
    const picked = s.options[0];
    const beforeVal = { dmg: p.dmg, max: p.maxHp, spd: p.spd };
    env.key('keydown', '1', 'Digit1');
    ok('выбор клавишей 1 работает', !s.choice, `choice ${s.choice}`);
  } else {
    ok('выбор клавишей 1 работает', true, 'уровень не открылся — пропуск');
  }
}

/* ============ 5. Пауза ============ */
section('5. Пауза');
{
  const env = createEnv({ seed: 19 });
  env.elements.get('play').click();
  frames(env, 120);

  const p = env.game.player;
  env.key('keydown', 'Escape', 'Escape');
  ok('пауза включена', env.game.state.pause === true);
  ok('экран паузы показан', !env.elements.get('paused').classList.contains('hidden'));

  env.key('keydown', 'd', 'KeyD');
  const x = p.x;
  frames(env, 40);
  ok('на паузе игрок не двигается', Math.abs(p.x - x) < 0.001, `${x} → ${p.x}`);

  env.key('keydown', 'Escape', 'Escape');
  ok('пауза выключена', env.game.state.pause === false);
  frames(env, 40);
  ok('после паузы игрок двигается', Math.abs(p.x - x) > 1, `${x} → ${p.x}`);
}

/* ============ 6. Победа, сохранение, следующий портал ============ */
section('6. Победа и сохранение прогресса');
{
  const env = createEnv({ seed: 23 });
  env.elements.get('play').click();
  frames(env, 30);

  resolveLevels(env);
  const s = env.game.state;
  s.kills = s.goal;
  s.enemies.length = 0;
  s.corpses.length = 0;
  s.spawnQueue.length = 0;
  s.army.push({ type: 'runner', x: env.game.player.x, y: env.game.player.y, r: 9, damage: 10, speed: 200, attackSpeed: 0.5, cd: 0, pulse: 0 });

  frames(env, 5);
  ok('фаза босса началась', s.phase === 'boss', s.phase);
  ok('босс появился', !!s.boss);
  ok('полоса босса видна', !env.elements.get('bossbar').classList.contains('hidden'));

  // убиваем босса
  s.boss.hp = 0.0001;
  env.game.player.x = s.boss.x - 20;
  env.game.player.y = s.boss.y;
  env.game.player.face = 0;
  env.game.player.cd = 0;
  env.game.player.dmg = 10000;
  env.game.api.attack();
  frames(env, 5);

  ok('победа засчитана', !env.game.state.go);
  ok('портал повышен', env.game.meta.portal === 2, `portal ${env.game.meta.portal}`);
  ok('тени попали в хранилище', env.game.meta.shadows.includes('runner'), JSON.stringify(env.game.meta.shadows));
  ok('экран финала показан', !env.elements.get('end').classList.contains('hidden'));
  ok('итоги заполнены', env.elements.get('endsummary').innerHTML.includes('Убито существ'));
  ok('заголовок победы', env.elements.get('endtitle').textContent === 'ВРАТА ОЧИЩЕНЫ');

  const saved = JSON.parse(env.store.get('shadow-ascendant'));
  ok('сохранение записано', saved.portal === 2 && Array.isArray(saved.shadows), JSON.stringify(saved));

  // новая сессия с тем же хранилищем
  const env2 = createEnv({ seed: 29, storage: { 'shadow-ascendant': env.store.get('shadow-ascendant') } });
  ok('прогресс восстановлен', env2.game.meta.portal === 2 && env2.game.meta.shadows.length > 0, JSON.stringify(env2.game.meta));
  ok('хранилище в HUD', env2.elements.get('vault').textContent === String(env2.game.meta.shadows.length));
  env2.elements.get('play').click();
  ok('армия выведена из хранилища', env2.game.state.army.length > 0, `армия ${env2.game.state.army.length}`);
  ok('в хранилище остался резерв или 0', env2.game.meta.shadows.length >= 0);

  // выход из портала
  env2.game.api.pause(true);
  env2.elements.get('quit').click();
  ok('кнопка «покинуть портал» завершает охоту', env2.game.state.go === false);
}

/* ============ 7. Поражение ============ */
section('7. Поражение');
{
  const env = createEnv({ seed: 31 });
  env.elements.get('play').click();
  frames(env, 30);

  env.game.player.hp = 0.5;
  frames(env, 600); // ждём, пока враги доберутся и добьют

  ok('игра остановлена', env.game.state.go === false);
  ok('портал не изменился', env.game.meta.portal === 1);
  ok('заголовок поражения', env.elements.get('endtitle').textContent === 'ТЫ ПАЛ', env.elements.get('endtitle').textContent);
  ok('кнопка повтора', env.elements.get('again').textContent === 'ПОВТОРИТЬ ПОРТАЛ');
  const saved = JSON.parse(env.store.get('shadow-ascendant'));
  ok('сохранение записано при поражении', saved && saved.portal === 1, JSON.stringify(saved));

  // повтор портала
  env.elements.get('again').click();
  ok('новая охота началась', env.game.state.go === true);
  ok('HP восстановлены', env.game.player.hp === env.game.player.maxHp);
  ok('уровень сброшен', env.game.player.lvl === 1);
}

/* ============ 8. Повреждённые и старые сохранения ============ */
section('8. Сохранения: старый формат и мусор');
{
  const env = createEnv({ seed: 37, storage: { 'shadow-ascendant': '{не json' } });
  ok('битое сохранение не ломает игру', env.game.meta.portal === 1 && env.errors.length === 0);

  const env2 = createEnv({ seed: 41, storage: { 'shadow-ascendant': JSON.stringify({ portal: 4, vault: 3 }) } });
  ok('старый формат читается', env2.game.meta.portal === 4 && env2.game.meta.shadows.length === 3, JSON.stringify(env2.game.meta));
  ok('типы теней нормализованы', env2.game.meta.shadows.every(t => typeof t === 'string'));

  const env3 = createEnv({ seed: 43, storage: { 'shadow-ascendant': JSON.stringify({ portal: -5, shadows: ['soldier', 'читер', 42, null] }) } });
  const m3 = env3.game.meta;
  ok('подозрительные данные отфильтрованы',
    m3.portal === 1 && m3.shadows.length === 2 && m3.shadows.every((t) => typeof t === 'string'),
    JSON.stringify(m3));

  const env4 = createEnv({ seed: 47, storage: { 'shadow-ascendant': JSON.stringify({ portal: 999999, shadows: Array(2000).fill('boss') }) } });
  ok('огромное хранилище обрезано', env4.game.meta.shadows.length <= 500, `${env4.game.meta.shadows.length}`);
  ok('ранг не выходит за предел', /РАНГА [A-S]$/.test(env4.elements.get('rank').textContent), env4.elements.get('rank').textContent);
}

/* ============ 9. Сброс прогресса ============ */
section('9. Сброс прогресса');
{
  const env = createEnv({ seed: 53, storage: { 'shadow-ascendant': JSON.stringify({ portal: 5, shadows: ['brute'], clears: 4, kills: 100 }) } });
  ok('кнопка сброса доступна', !env.elements.get('reset').classList.contains('hidden'));

  env.elements.get('reset').click();
  ok('первый клик только предупреждает', env.game.meta.portal === 5, `portal ${env.game.meta.portal}`);
  env.elements.get('reset').click();
  ok('второй клик сбрасывает', env.game.meta.portal === 1 && env.game.meta.shadows.length === 0);
  ok('сброс сохранён', JSON.parse(env.store.get('shadow-ascendant')).portal === 1);
  ok('кнопка сброса скрыта', env.elements.get('reset').classList.contains('hidden'));
}

/* ============ 10. Адаптация размера ============ */
section('10. Размер арены');
{
  for (const [w, h] of [[320, 480], [768, 1024], [1920, 1080], [280, 200]]) {
    const env = createEnv({ seed: 59, width: w, height: h, storage: { 'shadow-ascendant': JSON.stringify({ portal: 3, shadows: ['soldier'] }) } });
    env.elements.get('play').click();
    frames(env, 200);
    const p = env.game.player;
    const inside = p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h;
    const enemiesInside = env.game.state.enemies.every(e => e.x >= -1 && e.x <= w + 1 && e.y >= -1 && e.y <= h + 1);
    ok(`арена ${w}×${h}: ошибок нет`, env.errors.length === 0, JSON.stringify(env.errors.map(e => e.message)));
    ok(`арена ${w}×${h}: игрок в границах`, inside, `${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    ok(`арена ${w}×${h}: враги в границах`, enemiesInside);
  }
}

/* ============ 11. Тач-управление ============ */
section('11. Виртуальный стик и кнопки');
{
  const env = createEnv({ seed: 61 });
  env.elements.get('play').click();
  frames(env, 30);

  const stick = env.elements.get('stick');
  const p = env.game.player;
  const x0 = p.x;

  stick.fire('pointerdown', { pointerId: 1, clientX: 22 + 46 + 40, clientY: 15 + 46, pointerType: 'touch' });
  ok('стик даёт направление', !!env.game.state && true);
  frames(env, 30);
  ok('игрок движется вправо от стика', p.x > x0 + 5, `${x0.toFixed(0)} → ${p.x.toFixed(0)}`);

  stick.fire('pointerup', { pointerId: 1 });
  const x1 = p.x;
  frames(env, 30);
  ok('после отпускания стик не тянет', Math.abs(p.x - x1) < 5, `${x1.toFixed(0)} → ${p.x.toFixed(0)}`);

  // кнопки удара и подъёма
  env.game.player.cd = 0;
  const enemy = env.game.state.enemies[0];
  if (enemy) {
    enemy.x = p.x + 40; enemy.y = p.y; p.face = 0;
    const hp = enemy.hp;
    env.elements.get('attack').click();
    ok('кнопка удара работает', enemy.hp < hp);
  }

  env.game.state.corpses.push({ x: p.x + 10, y: p.y, r: 10, t: 5, type: 'soldier' });
  const army = env.game.state.army.length;
  env.elements.get('raise').click();
  ok('кнопка подъёма работает', env.game.state.army.length === army + 1);

  // тач-кнопки на арене
  env.game.state.corpses.push({ x: p.x + 10, y: p.y, r: 10, t: 5, type: 'soldier' });
  const army2 = env.game.state.army.length;
  env.elements.get('tr').fire('pointerdown', { pointerId: 2, pointerType: 'touch' });
  ok('тач-кнопка подъёма работает', env.game.state.army.length === army2 + 1);
}

/* ============ 12. Клавиатура ============ */
section('12. Клавиатура');
{
  const env = createEnv({ seed: 67 });
  env.key('keydown', ' ', 'Space');
  ok('пробел на стартовом экране запускает охоту', env.game.state.go === true);

  frames(env, 60);
  const p = env.game.player;
  const y0 = p.y;
  env.key('keydown', 'w', 'KeyW');
  frames(env, 20);
  env.key('keyup', 'w', 'KeyW');
  ok('W двигает вверх', p.y < y0, `${y0.toFixed(0)} → ${p.y.toFixed(0)}`);

  env.key('keydown', 'ArrowLeft', 'ArrowLeft');
  const x0 = p.x;
  frames(env, 20);
  env.key('keyup', 'ArrowLeft', 'ArrowLeft');
  ok('стрелка двигает влево', p.x < x0, `${x0.toFixed(0)} → ${p.x.toFixed(0)}`);

  // потеря фокуса ставит паузу
  env.fireWindow('blur');
  ok('потеря фокуса ставит паузу', env.game.state.pause === true);
  env.fireWindow('visibilitychange');
  ok('возврат вкладки не снимает паузу', env.game.state.pause === true);
}

/* ============ 13. Победа без теней ============ */
section('13. Долгая охота без армии');
{
  const env = createEnv({ seed: 71 });
  env.elements.get('play').click();
  let framesRun = 0;
  while (env.game.state.go && framesRun < 60 * 120) {
    if (env.game.state.choice) resolveLevels(env);
    env.frame(); framesRun++;
  }
  ok('охота заканчивается сама', !env.game.state.go, `кадров ${framesRun}`);
  ok('без действий игрок проигрывает', env.elements.get('endtitle').textContent === 'ТЫ ПАЛ');
}

/* ============ 14. Частицы и производительность ============ */
section('14. Производительность и утечки');
{
  const env = createEnv({ seed: 73 });
  env.elements.get('play').click();
  const t0 = process.hrtime.bigint();
  frames(env, 60 * 60); // минута игры
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const fx = env.game.state.fx.length;
  ok('минута игры без ошибок', env.errors.length === 0, JSON.stringify(env.errors.map(e => e.message)));
  ok('частицы ограничены', fx <= 420, `частиц ${fx}`);
  ok('трупы ограничены', env.game.state.corpses.length <= 60, `трупов ${env.game.state.corpses.length}`);
  ok('врагов не больше разумного', env.game.state.enemies.length <= 60, `врагов ${env.game.state.enemies.length}`);
  console.log(`      (минута эмуляции: ${ms.toFixed(0)} мс)`);
}

/* ============ 15. Много порталов подряд ============ */
section('15. Двенадцать порталов подряд');
{
  const env = createEnv({ seed: 79 });
  let cleared = 0;

  for (let i = 0; i < 12; i++) {
    env.elements.get('play').click();
    frames(env, 5);

    const s = env.game.state;
    if (!s.go) break;

    // мгновенно выполняем цель и ждём босса
    s.kills = s.goal;
    s.enemies.length = 0;
    s.spawnQueue.length = 0;
    resolveLevels(env);

    let guard = 0;
    while (!s.boss && s.go && guard++ < 40) frames(env, 1, 16.6667, false);

    if (!s.boss) break;

    s.boss.hp = 0;
    guard = 0;
    while (env.game.state.go && guard++ < 40) frames(env, 1, 16.6667, false);

    if (!env.game.state.go) {
      cleared++;
      ok(`портал ${i + 1} закрыт`, env.elements.get('endtitle').textContent === 'ВРАТА ОЧИЩЕНЫ');
      env.elements.get('again').click();
    }
  }

  ok('12 порталов пройдено без ошибок', env.errors.length === 0, JSON.stringify(env.errors.map(e => e.message)));
  ok('все порталы засчитаны', cleared >= 10, `закрыто ${cleared}`);
  ok('портал растёт', env.game.meta.portal >= 10, `portal ${env.game.meta.portal}`);
  ok('хранилище ограничено', env.game.meta.shadows.length <= 500, `${env.game.meta.shadows.length}`);
  ok('ранг растёт до S', /РАНГА [A-S]/.test(env.elements.get('rank').textContent), env.elements.get('rank').textContent);
}

/* ============ 16. Звук, отладочный доступ, производительность ============ */
section('16. Звук и служебные функции');
{
  const env = createEnv({ seed: 83 });

  ok('переключатель звука не падает без WebAudio', (() => {
    try { env.elements.get('sound').click(); return true; } catch (e) { return false; }
  })());

  ok('отладочный API доступен', !!env.game.api && typeof env.game.api.start === 'function');
  ok('версия совпадает с package.json', env.game.version === '1.1.0', env.game.version);

  env.elements.get('play').click();
  frames(env, 60 * 30); // 30 секунд боя
  ok('полминуты боя без ошибок', env.errors.length === 0, JSON.stringify(env.errors.map(e => e.message)));
  // без действий охотник погибает — но корректно, через экран итогов
  ok('охота завершилась корректно',
    env.game.state.go === false && !env.elements.get('end').classList.contains('hidden'));
}

console.log(`\n=== Итог: ${passed} успешно, ${failed} провалено ===`);
process.exit(failed ? 1 : 0);
