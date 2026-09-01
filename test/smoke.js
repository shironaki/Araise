// =========================================================
// SMOKE-TEST ЛОГИКИ Shadow Ascendant
// Запуск: node test/smoke.js
// Мокирует DOM/Canvas/localStorage и прогоняет модули игры.
// =========================================================

const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---------- Мини-фреймворк проверок ----------
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passed++;
    console.log('  \u2713', name);
  } else {
    failed++;
    failures.push(name);
    console.error('  \u2717', name);
  }
}

function section(title) {
  console.log('\n' + title);
}

// ---------- Моки ----------
function makeClassList() {
  const set = new Set();
  return {
    contains: c => set.has(c),
    add(...cs) { cs.forEach(c => set.add(c)); },
    remove(...cs) { cs.forEach(c => set.delete(c)); },
    toggle(c, force) {
      if (force === undefined) {
        if (set.has(c)) set.delete(c);
        else set.add(c);
      } else if (force) set.add(c);
      else set.delete(c);
      return set.has(c);
    }
  };
}

function makeElement(id) {
  return {
    id,
    textContent: '',
    innerHTML: '',
    style: { width: '' },
    classList: makeClassList(),
    append() {},
    appendChild() {},
    addEventListener() {},
    setPointerCapture() {},
    querySelector: () => makeElement('sub'),
    firstChild: { style: { transform: '' } },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
  };
}

const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
      return () => ({ addColorStop() {} });
    }
    return () => {};
  },
  set() { return true; }
});

const createdButtons = [];
const elements = {};

global.window = global;
global.document = {
  getElementById: id => elements[id] || (elements[id] = makeElement(id)),
  querySelector: () => ({ width: 960, height: 600, getContext: () => ctx }),
  createElement: () => {
    const el = makeElement('created');
    createdButtons.push(el);
    return el;
  }
};
global.localStorage = (() => {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
})();
global.requestAnimationFrame = () => 0;
global.addEventListener = () => {};
global.confirm = () => true;
global.Image = class {
  constructor() {
    this.width = 0;
    this.height = 0;
  }
};

// ---------- Загрузка модулей игры ----------
function loadModules() {
  for (const f of ['config.js', 'state.js', 'utils.js', 'combat.js', 'rooms.js', 'ui.js']) {
    delete require.cache[path.join(ROOT, 'js', f)];
    require(path.join(ROOT, 'js', f));
  }
}

function reloadState(json) {
  localStorage.setItem('shadow-ascendant', JSON.stringify(json));
  loadModules(); // модули заново захватывают свежие S/P/meta
}

loadModules();

const G = window.ShadowAscendant;
let S = G.S;
let P = G.P;
let meta = G.meta;

function fresh() {
  S = G.S;
  P = G.P;
  meta = G.meta;
}

// ---------- ТЕСТЫ ----------
console.log('Smoke-тест Shadow Ascendant (модули: config/state/utils/combat/rooms/ui)');

section('Хранилище и вместимость');
check('BASE_CAPACITY = 8', G.capacity() === 8);
meta.commander = 2;
check('capacity = 8 + commander = 10', G.capacity() === 10);
meta.commander = 0;

section('Миграция старого сохранения');
reloadState({ portal: 1, vault: 20, shadows: [], commander: 0 });
fresh();
check('восстановлено не больше вместимости', G.meta.shadows.length === 8);
check('vault синхронизирован с фактом', G.meta.vault === 8);
reloadState({ portal: 1, vault: 3, shadows: [], commander: 0 });
fresh();
check('миграция частичная', G.meta.shadows.length === 3 && G.meta.vault === 3);
reloadState({ portal: 1, vault: 0, shadows: [], commander: 0 });
fresh();

section('Забег и комнаты');
check('цепочка зоны — 11 комнат', G.zoneChain.length === 11);
check('последняя комната — босс', G.zoneChain[10] === 'boss');

G.start();
check('забег стартовал', S.go === true);
check('бой: враги появились', S.enemies.length === 4);
check('цель: ЗОНА 1 · БОЕВАЯ КОМНАТА', elements.objective.textContent.includes('ЗОНА 1'));

section('Убийство врагов и очистка комнаты');
createdButtons.length = 0;
for (const e of [...S.enemies]) e.hp = 0;
G.updateCombatAI(0.016);
// 4 солдата × 16 xp = 64 ≥ 50 → левел-ап: выбираем усиление.
check('левел-ап открыт после убийств', S.choice === true);
check('выбор усиления создан (3 кнопки)', createdButtons.length === 3);
if (createdButtons[0]) createdButtons[0].onclick();
check('комната очищена после выбора', S.cleared === true);
check('врагов нет', S.enemies.length === 0);
check('оверлей выбора скрыт', elements.upgrade.classList.contains('hidden') === true);
check('портал открыт (portalEntry)', S.portalEntry === true);
check('оверлей «ДАЛЬШЕ» не показан', elements.cleared.classList.contains('hidden') === true);

// Вход в портал: подводим игрока к порталу.
const pp = G.portalPos();
P.x = pp.x;
P.y = pp.y;
G.tryPortalEntry();
check('вход в портал → следующая комната', S.roomIndex === 1);
check('вторая комната — снова бой', S.enemies.length > 0);

section('Командир теней (улучшение)');
const cmdrBefore = meta.commander;
createdButtons.length = 0;
// Детерминированный выбор: подменяем список усилений только КОМАНДИРОМ,
// чтобы случайная выборка не пропускала его.
const realUpgrades = G.upgrades;
G.upgrades = [['КОМАНДИР ТЕНЕЙ', 'Максимум армии +1', 'commander', 1]];
G.levelUp();
G.upgrades = realUpgrades;
const cmdrBtn = createdButtons.find(b => (b.innerHTML || '').includes('КОМАНДИР'));
check('КОМАНДИР ТЕНЕЙ доступен в выборе', Boolean(cmdrBtn));
if (cmdrBtn) {
  cmdrBtn.onclick();
  check('commander +1', meta.commander === cmdrBefore + 1);
  check('вместимость выросла', G.capacity() === 8 + meta.commander);
  check('выбор закрыт', S.choice === false);
}

section('Управление тенями');
meta.shadows = ['soldier'];
const armyBefore = S.army.length;
P.mana = 5;
G.summonFromVault();
check('нет маны — призыв не работает', S.army.length === armyBefore && P.mana === 5);
P.mana = 20;
G.summonFromVault();
check('призыв стоит 10 маны', S.army.length === armyBefore + 1 && P.mana === 10);
check('тень убыла из хранилища', meta.shadows.length === 0);

const vaultBefore = meta.shadows.length;
const sh = G.createShadow('soldier', 100, 100);
S.army.push(sh);
G.killShadow(sh);
check('гибель тени → возврат в хранилище', meta.shadows.length === vaultBefore + 1 && !S.army.includes(sh));

section('Способности игрока');
G.start();
P.mana = 30;
const e = S.enemies[0];
e.x = P.x + 50;
e.y = P.y;
const hpBeforePower = e.hp;
G.power();
check('волна тьмы наносит урон', e.hp < hpBeforePower);
check('волна тьмы стоит 30 маны', P.mana === 0);

G.start();
const e2 = S.enemies[0];
e2.x = P.x + 60;
e2.y = P.y;
P.face = 0;
P.cd = 0;
const hpBeforeAttack = e2.hp;
G.attack();
check('удар наносит урон в радиусе', e2.hp < hpBeforeAttack);
check('удар ставит кулдаун', P.cd > 0);

section('AI: враги и тени');
G.start();
const e3 = S.enemies[0];
const d0 = Math.hypot(e3.x - P.x, e3.y - P.y);
G.updateCombatAI(0.1);
const d1 = Math.hypot(e3.x - P.x, e3.y - P.y);
check('враг движется к игроку', d1 < d0);

G.start();
const e4 = S.enemies[0];
e4.x = P.x + 20;
e4.y = P.y;
const hpBefore = P.hp;
G.updateCombatAI(0.1);
check('враг наносит урон игроку', P.hp < hpBefore);

G.start();
const e5 = S.enemies[0];
const shadow = G.createShadow('soldier', e5.x + 10, e5.y);
shadow.cd = 0;
S.army.push(shadow);
const shpBefore = e5.hp;
let guard = 0;
while (guard++ < 30 && e5.hp === shpBefore) {
  G.updateCombatAI(0.05);
}
check('тень атакует врага', e5.hp < shpBefore);

section('Поражение и победа');
G.start();
const vBeforeLose = meta.shadows.length;
S.army.push(G.createShadow('soldier', P.x - 30, P.y));
G.finish(false);
check('поражение: забег остановлен', S.go === false);
check('поражение: тени НЕ возвращаются в хранилище', meta.shadows.length === vBeforeLose);

G.start();
const vBeforeWin = meta.shadows.length;
S.army.push(G.createShadow('soldier', P.x - 30, P.y));
const portalBefore = meta.portal;
G.finish(true);
check('победа: portal++', meta.portal === portalBefore + 1);
check('победа: тени возвращаются в хранилище', meta.shadows.length === vBeforeWin + 1);

section('Босс завершает зону');
reloadState({ portal: 1, vault: 0, shadows: [], commander: 0 });
fresh();
G.start();
S.enemies = []; // прыгаем сразу в комнату босса, старых врагов нет
S.corpses = [];
S.roomIndex = 10; // boss (цепочка: ... portal, story, boss)
G.startRoom();
check('босс появился', S.enemies.some(en => en.boss === true));
const portalB = meta.portal;
createdButtons.length = 0;
for (const en of [...S.enemies]) en.hp = 0;
G.updateCombatAI(0.016);
if (S.choice && createdButtons[0]) {
  createdButtons[0].onclick();
}
check('зона пройдена — забег завершён победой', S.go === false);
check('портал увеличен после босса', meta.portal === portalB + 1);

section('ISSUE-001: несколько уровней — несколько выборов');
G.start();
createdButtons.length = 0;
P.lvl = 1;
P.next = 50;
G.gainXP(120); // 50 → lvl 2 (next 68), 70-68=2 → lvl 3
check('два уровня в очереди', S.pendingLevels === 2 && S.choice === true);
createdButtons[0].onclick();
check('после первого выбора очередь = 1, выбор открыт снова',
  S.pendingLevels === 1 && S.choice === true);
const secondPick = createdButtons.slice(-3)[0];
secondPick.onclick();
check('после второго выбора очередь пуста и выбор закрыт',
  S.pendingLevels === 0 && S.choice === false);
check('достигнут 3 уровень', P.lvl === 3);

section('Событие: выбор с последствиями');
reloadState({ portal: 1, vault: 0, shadows: [], commander: 0 });
fresh();
G.start();
S.roomIndex = 2; // event
createdButtons.length = 0;
G.startRoom();
check('событие открыло выбор', S.choice === true && elements.upgrade.classList.contains('hidden') === false);
const dmgBefore = P.dmg;
const hpBeforeEvent = P.hp;
const sacrificeBtn = createdButtons.find(b => (b.innerHTML || '').includes('ЖЕРТВУ'));
check('кнопка жертвы есть', Boolean(sacrificeBtn));
if (sacrificeBtn) sacrificeBtn.onclick();
check('жертва: урон +8', P.dmg === dmgBefore + 8);
check('жертва: HP уменьшено, не ниже 1', P.hp < hpBeforeEvent && P.hp >= 1);
check('выбор закрыт, переход открыт', S.choice === false && S.cleared === true);

section('Комната восстановления');
G.start();
P.hp = 10;
P.mana = 3;
S.roomIndex = 3; // recovery
G.startRoom();
check('восстановление: HP и мана полные', P.hp === P.max && P.mana === P.maxMana);
check('переход открыт', S.cleared === true);

section('Испытание: элитный бой + награда');
reloadState({ portal: 1, vault: 0, shadows: [], commander: 0 });
fresh();
G.start();
S.enemies = []; // прыгаем сразу в испытание
S.corpses = [];
S.roomIndex = 7; // trial (цепочка: fight, elite, event, recovery, shop, reward, fight, trial, portal, story, boss)
G.startRoom();
check('испытание: элитные враги', S.enemies.length > 0 && S.enemies.every(e => e.elite === true));
createdButtons.length = 0;
for (const e of [...S.enemies]) e.hp = 0;
G.updateCombatAI(0.016);
if (S.choice && createdButtons[0]) {
  createdButtons[0].onclick();
}
check('испытание пройдено: переход открыт', S.cleared === true);
check('испытание: показана награда', elements.cltitle.textContent === 'НАГРАДА');

section('Магазин: покупки за души');
reloadState({ portal: 1, vault: 0, shadows: [], commander: 0 });
fresh();
G.start();
S.enemies = [];
S.corpses = [];
S.souls = 60;
S.roomIndex = 4; // shop
createdButtons.length = 0;
G.startRoom();
check('магазин открыт', S.choice === true && elements.upgrade.classList.contains('hidden') === false);
const dmgBeforeShop = P.dmg;
const buyBtn = createdButtons.find(b => (b.innerHTML || '').includes('КЛИНОК ТЕНИ'));
check('товар «КЛИНОК ТЕНИ» есть', Boolean(buyBtn));
if (buyBtn) buyBtn.onclick();
check('куплено: урон +10', P.dmg === dmgBeforeShop + 10);
check('списано 25 душ', S.souls === 35);
const leaveBtn = createdButtons.find(b => (b.innerHTML || '').includes('ПОКИНУТЬ'));
if (leaveBtn) leaveBtn.onclick();
check('магазин закрыт, переход открыт', S.choice === false && S.cleared === true);

section('Сюжетная комната');
G.start();
S.roomIndex = 9; // story
G.startRoom();
check('сюжет открыт', S.cleared === true);
check('текст сюжета показан', elements.cltitle.textContent === G.storyLines[0].title);

section('Души за убийства');
G.start();
S.souls = 0;
const eK = S.enemies[0];
eK.hp = 0;
G.updateCombatAI(0.016);
check('души начислены за врага', S.souls === G.soulValues[eK.type]);

section('Расталкивание врагов (BUG-008)');
G.start();
S.enemies = [];
G.spawn('soldier', false, false);
G.spawn('soldier', false, false);
const a = S.enemies[0];
const b = S.enemies[1];
a.x = 100;
a.y = 100;
b.x = 103; // лёгкий сдвиг, чтобы было направление расталкивания
b.y = 100;
G.updateCombatAI(0.016);
check('враги расталкиваются', Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1);

section('Утилиты');
check('clamp работает', G.clamp(-5, 0, 10) === 0 && G.clamp(15, 0, 10) === 10);
check('rand в диапазоне', G.rand(5, 7) >= 5 && G.rand(5, 7) <= 7);

// ---------- Итог ----------
console.log('\n========================================');
console.log(`ИТОГ: ${passed} прошло, ${failed} упало`);
if (failed > 0) {
  console.log('Упавшие проверки:');
  for (const f of failures) console.log('  -', f);
  process.exit(1);
}
console.log('Все зелёные.');
