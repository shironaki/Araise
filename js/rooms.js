// =========================================================
// ROOMS — комнаты, зоны, переходы
// =========================================================
(() => {
  const G = window.ShadowAscendant;
  const { S, P, meta, roomName, nextRoomType, $, spawn } = G;

  // =========================================================
  // СПАВН КОМНАТ (мгновенный, без setTimeout)
  // =========================================================

  function spawnFight() {
    const amount = 4 + Math.floor(meta.portal / 2);

    for (let i = 0; i < amount; i++) {
      spawn();
    }
  }

  function spawnElite() {
    const amount = 2 + Math.floor(meta.portal / 2);

    for (let i = 0; i < amount; i++) {
      const type = Math.random() < 0.5 ? 'brute' : 'caster';
      spawn(type, false, true);
    }
  }

  function spawnBoss() {
    spawn('brute', true);
  }

  // =========================================================
  // СТАРТ КОМНАТЫ
  // =========================================================

  G.startRoom = () => {
    const type = nextRoomType(S.roomIndex);

    if (!type) {
      G.finish(true);
      return;
    }

    S.kills = 0;
    S.cleared = false;
    S.portalEntry = false;

    $('cleared').classList.add('hidden');

    if (type === 'fight') {
      spawnFight();
    } else if (type === 'elite') {
      spawnElite();
    } else if (type === 'reward') {
      roomReward();
    } else if (type === 'portal') {
      roomPortal();
    } else if (type === 'boss') {
      spawnBoss();
    } else if (type === 'recovery') {
      roomRecovery();
    } else if (type === 'event') {
      roomEvent();
    } else if (type === 'trial') {
      spawnElite();
    } else if (type === 'shop') {
      roomShop();
    } else if (type === 'story') {
      roomStory();
    }

    G.ui();
  };

  // =========================================================
  // ОСОБЫЕ КОМНАТЫ
  // =========================================================

  // Комната награды: полное лечение + выбор усиления.
  function roomReward() {
    P.hp = P.max;
    P.mana = P.maxMana;

    $('clrank').textContent = 'КОМНАТА НАГРАДЫ';
    $('cltitle').textContent = 'ДАР ПОРТАЛА';
    $('cltext').textContent =
      'Тени восстанавливают силы. Выбери усиление.';

    S.cleared = true;
    G.levelUp(true);
  }

  // Комната-портал: переход к следующему этапу.
  function roomPortal() {
    S.cleared = true;

    $('clrank').textContent = 'ПОРТАЛ';
    $('cltitle').textContent = 'ПУТЬ ОТКРЫТ';
    $('cltext').textContent =
      'Портал ведёт в следующий зал. Тени, пережившие бой, остаются с тобой.';

    $('cleared').classList.remove('hidden');
  }

  // Комната восстановления: полное лечение HP и маны.
  function roomRecovery() {
    P.hp = P.max;
    P.mana = P.maxMana;
    S.cleared = true;

    $('clrank').textContent = 'КОМНАТА ВОССТАНОВЛЕНИЯ';
    $('cltitle').textContent = 'ИСТОЧНИК ТЕНИ';
    $('cltext').textContent =
      'Силы полностью восстановлены. Иди дальше.';

    $('cleared').classList.remove('hidden');
  }

  // Событие: выбор с последствиями (без валюты — цена в HP/риске).
  function roomEvent() {
    S.choice = true;
    S.cleared = true;

    const $up = $('upgrade');
    $up.classList.remove('hidden');
    $('choices').innerHTML = '';

    const small = $up.querySelector('small');
    const h2 = $up.querySelector('h2');
    const p = $up.querySelector('p');

    if (small) small.textContent = 'СОБЫТИЕ';
    if (h2) h2.textContent = 'ТЁМНЫЙ АЛТАРЬ';
    if (p) p.textContent = 'Принести жертву тени в обмен на силу?';

    const close = () => {
      S.choice = false;
      $up.classList.add('hidden');
      G.ui();
      $('cleared').classList.remove('hidden');
    };

    const mk = (title, desc, fn) => {
      const button = document.createElement('button');
      button.className = 'choice';
      button.innerHTML = `<b>${title}</b><span>${desc}</span>`;
      button.onclick = () => {
        fn();
        close();
      };
      $('choices').append(button);
    };

    mk(
      'ПРИНЕСТИ ЖЕРТВУ',
      '-25 HP · урон +8',
      () => {
        P.hp = Math.max(1, P.hp - 25);
        P.dmg += 8;
      }
    );
    mk('ОТКАЗАТЬСЯ', 'Ничего не происходит', () => {});
  }

  // Магазин: покупки за души теней.
  function roomShop() {
    S.choice = true;
    S.cleared = true;

    const $up = $('upgrade');
    $up.classList.remove('hidden');

    const small = $up.querySelector('small');
    const h2 = $up.querySelector('h2');
    const p = $up.querySelector('p');

    if (small) small.textContent = 'МАГАЗИН';
    if (h2) h2.textContent = 'ТОРГОВЕЦ ТЕНЕЙ';

    const render = () => {
      $('choices').innerHTML = '';

      if (p) {
        p.textContent = `Души: ${S.souls}. Выбери покупку.`;
      }

      for (const [title, desc, key, amount, price] of G.shopItems) {
        const button = document.createElement('button');
        button.className = 'choice';
        button.innerHTML =
          `<b>${title}</b><span>${desc} · ${price} душ</span>`;
        button.disabled = S.souls < price;

        button.onclick = () => {
          if (S.souls < price) {
            return;
          }

          S.souls -= price;

          if (key === 'heal') {
            P.hp = Math.min(P.max, P.hp + Math.ceil(P.max * 0.5));
          } else if (key === 'fullmana') {
            P.mana = P.maxMana;
          } else {
            G.applyUpgrade(key, amount);
          }

          render();
          G.ui();
        };

        $('choices').append(button);
      }

      const leave = document.createElement('button');
      leave.className = 'choice';
      leave.innerHTML = '<b>ПОКИНУТЬ</b><span>Продолжить путь</span>';
      leave.onclick = () => {
        S.choice = false;
        $up.classList.add('hidden');
        G.ui();
        $('cleared').classList.remove('hidden');
      };

      $('choices').append(leave);
    };

    render();
  }

  // Сюжетная комната: текст перед боссом.
  function roomStory() {
    S.cleared = true;
    const story = G.storyLines[(meta.portal - 1) % G.storyLines.length];

    $('clrank').textContent = 'СКРИЖАЛЬ';
    $('cltitle').textContent = story.title;
    $('cltext').textContent = story.text;

    $('cleared').classList.remove('hidden');
  }

  // Вход в портал: комната очищена боем, игрок подошёл к порталу.
  G.tryPortalEntry = () => {
    if (!S.cleared || !S.portalEntry) {
      return false;
    }

    const pos = G.portalPos();

    if (Math.hypot(P.x - pos.x, P.y - pos.y) < 46) {
      G.nextRoom();
      return true;
    }

    return false;
  };

  // =========================================================
  // ОЧИСТКА И ПЕРЕХОД
  // =========================================================

  // Комната очищена: открыть переход.
  G.roomCleared = () => {
    const type = G.zoneChain[S.roomIndex];

    // Босс побеждён → зона пройдена.
    if (type === 'boss') {
      G.finish(true);
      return;
    }

    // Испытание пройдено → награда: случайное усиление автоматически.
    if (type === 'trial') {
      const up = G.upgrades[Math.floor(Math.random() * G.upgrades.length)];
      G.applyUpgrade(up[2], up[3]);

      S.cleared = true;

      $('clrank').textContent = 'ИСПЫТАНИЕ ПРОЙДЕНО';
      $('cltitle').textContent = 'НАГРАДА';
      $('cltext').textContent =
        `Усиление: ${up[0]} — ${up[1]}.`;

      $('cleared').classList.remove('hidden');
      return;
    }

    const nextType = nextRoomType(S.roomIndex + 1);

    // Боевая комната очищена: портал открыт на канвасе,
    // игрок подходит и входит (оверлей «ДАЛЬШЕ» не показываем).
    S.cleared = true;
    S.portalEntry = true;
    G.ui();
  };

  // Переход к следующей комнате.
  G.nextRoom = () => {
    if (!S.go || !S.cleared) {
      return;
    }

    S.roomIndex++;
    G.startRoom();
  };
})();
