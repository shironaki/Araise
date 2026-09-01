// =========================================================
// STATE — глобальное состояние игры и персонажа
// =========================================================
(() => {
  const G = window.ShadowAscendant;

  // ---------- Постоянная прогрессия (между забегами) ----------
  const saved = JSON.parse(
    localStorage.getItem('shadow-ascendant') ||
    '{"portal":1,"vault":0,"shadows":[],"commander":0}'
  );

  G.meta = {
    portal: saved.portal || 1,
    vault: saved.vault || 0,
    shadows: Array.isArray(saved.shadows) ? saved.shadows : [],
    commander: saved.commander || 0
  };

  // Вместимость хранилища: база + улучшения Командира.
  G.capacity = () =>
    G.BASE_CAPACITY + G.meta.commander;

  // Миграция старого формата сохранения:
  // если теней нет, но сохранено количество (vault) —
  // восстанавливаем их, но не больше вместимости.
  if (
    G.meta.shadows.length === 0 &&
    G.meta.vault > 0
  ) {
    for (let i = 0; i < G.meta.vault; i++) {
      if (G.meta.shadows.length >= G.capacity()) {
        break;
      }
      G.meta.shadows.push('soldier');
    }

    // Вместимость и факт не должны расходиться:
    // после миграции vault = реальное количество теней.
    G.meta.vault = G.meta.shadows.length;
  }

  G.save = () => {
    localStorage.setItem(
      'shadow-ascendant',
      JSON.stringify({
        portal: G.meta.portal,
        vault: G.meta.vault,
        shadows: G.meta.shadows,
        commander: G.meta.commander
      })
    );
  };

  G.rank = () =>
    G.ranks[Math.min(
      5,
      Math.floor((G.meta.portal - 1) / 2)
    )];

  G.portalName = () =>
    G.portalNames[(G.meta.portal - 1) % G.portalNames.length];

  // ---------- Состояние забега ----------
  G.S = {
    go: false,
    pause: false,
    choice: false,
    cleared: false,

    kills: 0,
    roomIndex: 0,

    // Очередь невыбранных уровней (ISSUE-001):
    // при нескольких уровнях за одно убийство выбор усиления
    // показывается повторно, пока очередь не опустеет.
    pendingLevels: 0,

    // Валюта забега: души теней.
    souls: 0,

    // Комната очищена боем — игрок входит в портал на канвасе.
    portalEntry: false,

    enemies: [],
    corpses: [],
    army: [],
    fx: [],

    last: 0
  };

  // ---------- Персонаж ----------
  G.P = {
    x: 480,
    y: 300,
    r: 17,

    hp: 100,
    max: 100,

    // Мана: ресурс для способностей.
    mana: 60,
    maxMana: 60,
    manaRegen: 10,

    lvl: 1,
    xp: 0,
    next: 50,

    dmg: 25,
    spd: 245,

    cd: 0,
    pcd: 0,
    flash: 0,
    face: 0,

    attackRange: 98
  };

  // ---------- Хелперы ----------
  G.roomName = (type) =>
    G.roomTypes[type]?.name || 'КОМНАТА';

  G.nextRoomType = (index) => {
    if (index >= G.zoneChain.length) {
      return null;
    }
    return G.zoneChain[index];
  };

  G.randomEnemyType = () => {
    const r = Math.random();
    const zone = G.meta.portal;

    // Каждая новая зона добавляет новых врагов.
    if (zone >= 4 && r < 0.12) {
      return 'oracle';
    }

    if (zone >= 3 && r < 0.24) {
      return 'reaper';
    }

    if (zone >= 2 && r < 0.36) {
      return 'warden';
    }

    if (zone >= 3 && r < 0.5) {
      return 'caster';
    }

    if (zone >= 2 && r < 0.62) {
      return 'brute';
    }

    if (r < 0.75) {
      return 'runner';
    }

    return 'soldier';
  };
})();
