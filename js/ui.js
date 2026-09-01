// =========================================================
// UI — интерфейс, старт/финиш, пауза
// =========================================================
(() => {
  const G = window.ShadowAscendant;
  const { S, P, meta, rank, portalName, zoneChain, roomName, $, clamp } = G;

  // =========================================================
  // ОБНОВЛЕНИЕ HUD
  // =========================================================

  G.ui = () => {
    $('level').textContent = `УР. ${P.lvl}`;

    $('hptext').textContent =
      `${Math.ceil(P.hp)} / ${P.max}`;

    $('manatext').textContent =
      `${Math.ceil(P.mana)} / ${P.maxMana}`;

    $('hp').style.width =
      `${clamp(P.hp / P.max * 100, 0, 100)}%`;

    $('mp').style.width =
      `${clamp(P.mana / P.maxMana * 100, 0, 100)}%`;

    $('xp').style.width =
      `${clamp(P.xp / P.next * 100, 0, 100)}%`;

    $('shadows').textContent = S.army.length;

    $('vault').textContent =
      `${meta.shadows.length} / ${G.capacity()}`;

    $('souls').textContent = S.souls;

    $('objective').textContent =
      S.cleared && S.portalEntry
        ? `ЗОНА ${meta.portal} · ИДИ К ПОРТАЛУ`
        : `ЗОНА ${meta.portal} · ${roomName(zoneChain[S.roomIndex])} · врагов: ${S.enemies.length}`;
  };

  // =========================================================
  // СТАРТ ЗАБЕГА
  // =========================================================

  G.start = () => {
    Object.assign(S, {
      go: true,
      pause: false,
      choice: false,
      cleared: false,

      kills: 0,
      roomIndex: 0,
      pendingLevels: 0,
      souls: 0,
      portalEntry: false,

      enemies: [],
      corpses: [],
      army: [],
      fx: []
    });

    Object.assign(P, {
      x: G.W / 2,
      y: G.H / 2,

      hp: 100,
      max: 100,

      mana: 60,
      maxMana: 60,

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
    });

    // Тени НЕ призываются автоматически — игрок вызывает их
    // из хранилища отдельной кнопкой (summonFromVault, за ману).

    $('start').classList.add('hidden');
    $('end').classList.add('hidden');
    $('upgrade').classList.add('hidden');
    $('paused').classList.add('hidden');
    $('cleared').classList.add('hidden');

    G.startRoom();
    G.ui();
  };

  // =========================================================
  // ФИНИШ ЗАБЕГА
  // =========================================================

  G.finish = (win) => {
    S.go = false;

    if (win) {
      // Победившая армия возвращается в хранилище,
      // но не больше вместимости — лишние тени теряются.
      for (const shadow of S.army) {
        if (meta.shadows.length >= G.capacity()) {
          break;
        }
        meta.shadows.push(shadow.type);
      }

      meta.portal++;
      meta.vault = meta.shadows.length;
      G.save();
    }
    // При поражении тени теряются — в хранилище НЕ возвращаются.

    $('endrank').textContent =
      win
        ? `ЗОНА ${meta.portal} ОЧИЩЕНА`
        : 'ОХОТА ПРЕРВАНА';

    $('endtitle').textContent =
      win
        ? 'ВРАТА ОЧИЩЕНЫ'
        : 'ОХОТА ПРЕРВАНА';

    $('endtext').textContent =
      win
        ? `Тени вернулись в хранилище: +${S.army.length}. Следующая зона будет опаснее.`
        : `Достигнут ${P.lvl} уровень. Сохранено теней: ${meta.shadows.length}.`;

    $('again').textContent =
      win
        ? 'СЛЕДУЮЩАЯ ЗОНА'
        : 'ПОВТОРИТЬ ЗОНУ';

    $('end').classList.remove('hidden');

    G.ui();
  };

  // =========================================================
  // ПАУЗА
  // =========================================================

  G.pause = (on = !S.pause) => {
    if (!S.go || S.choice) {
      return;
    }

    S.pause = on;

    $('paused').classList.toggle('hidden', !on);
    $('pause').textContent = on ? '▶' : 'Ⅱ';
  };

  // =========================================================
  // ЭКРАН СТАРТА
  // =========================================================

  G.setup = () => {
    $('rank').textContent = `ВРАТА РАНГА ${rank()}`;
    $('portalname').textContent = portalName();
    G.ui();
  };

  // =========================================================
  // АССЕТЫ
  // =========================================================

  // Портрет героя: если в assets/ лежит сгенерированный
  // portrait.png — показываем его вместо иконки-орба.
  const portrait = new Image();
  portrait.onload = () => {
    const el = $('portrait');
    if (el) {
      el.innerHTML = '';
      el.appendChild(portrait);
    }
  };
  portrait.src = 'assets/portrait.png';

  // =========================================================
  // ГАЛЕРЕЯ АРТ-ДИРЕКЦИИ (референс-спрайты из папки «Сплайты»)
  // =========================================================

  const ART_FILES = [
    '01_hero_reference.png',
    '02_shadow_soldiers_reference.png',
    '03_enemies_reference.png',
    '04_skill_effects_reference.png',
    '05_portals_reference.png',
    '06_dungeon_props_reference.png',
    '07_tileset_reference.png',
    '08_ui_reference.png',
    '09_locations_reference.png',
    '10_full_art_direction.png'
  ];
  const ART_BASE = 'Сплайты/';
  let artIndex = 0;

  const showArt = (i) => {
    artIndex = (i + ART_FILES.length) % ART_FILES.length;
    const name = ART_FILES[artIndex];
    const img = $('artimg');

    if (img) {
      img.src = encodeURI(ART_BASE + name);
    }

    const label = $('artname');
    if (label) {
      label.textContent = name;
    }

    const gallery = $('gallery');
    if (gallery) {
      gallery.classList.remove('hidden');
    }
  };

  const art = $('art');
  if (art) art.onclick = () => showArt(0);

  const artPrev = $('artprev');
  if (artPrev) artPrev.onclick = () => showArt(artIndex - 1);

  const artNext = $('artnext');
  if (artNext) artNext.onclick = () => showArt(artIndex + 1);

  const artClose = $('artclose');
  if (artClose) artClose.onclick = () => {
    const gallery = $('gallery');
    if (gallery) {
      gallery.classList.add('hidden');
    }
  };
})();
