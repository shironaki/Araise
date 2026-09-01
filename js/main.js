// =========================================================
// MAIN — игровой цикл, ввод, кнопки, джойстик
// =========================================================
(() => {
  const G = window.ShadowAscendant;
  const { S, P, K, W, H, dist, clamp, $, fx } = G;

  // =========================================================
  // ИГРОВОЙ ТИК
  // =========================================================

  function tick(dt) {
    if (!S.go || S.pause || S.choice) {
      return;
    }

    // Вход в портал: комната очищена боем, игрок подошёл к порталу.
    if (S.cleared && S.portalEntry && G.tryPortalEntry()) {
      return;
    }

    // Оверлейные комнаты (событие/магазин/сюжет/награда) — игра замирает.
    if (S.cleared && !S.portalEntry) {
      return;
    }

    P.cd -= dt;
    P.pcd -= dt;
    P.flash -= dt;

    // Мана НЕ восстанавливается пассивно —
    // только при повышении уровня (как в Solo Leveling).

    // -------------------------
    // ДВИЖЕНИЕ ИГРОКА
    // -------------------------

    let dx =
      (K.d || K.arrowright ? 1 : 0) -
      (K.a || K.arrowleft ? 1 : 0);

    let dy =
      (K.s || K.arrowdown ? 1 : 0) -
      (K.w || K.arrowup ? 1 : 0);

    if (G.stick) {
      dx = G.stick.x;
      dy = G.stick.y;
    }

    if (dx || dy) {
      const length = Math.hypot(dx, dy);

      P.x = clamp(P.x + dx / length * P.spd * dt, 22, W - 22);
      P.y = clamp(P.y + dy / length * P.spd * dt, 22, H - 22);
      P.face = Math.atan2(dy, dx);
    }

    // -------------------------
    // БОЕВАЯ ЛОГИКА КАДРА
    // AI врагов и теней, смерть врагов — в едином модуле combat.js.
    // -------------------------

    G.updateCombatAI(dt);

    // -------------------------
    // ТРУПЫ И ЧАСТИЦЫ
    // -------------------------

    for (const corpse of S.corpses) {
      corpse.t -= dt;
    }

    S.corpses = S.corpses.filter(c => c.t > 0);

    for (const particle of S.fx) {
      if (!particle.kind || particle.kind === 'spark') {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      } else if (particle.kind === 'ring') {
        particle.r += particle.vr * dt;
      }
      particle.t -= dt;
    }

    S.fx = S.fx.filter(p => p.t > 0);

    // -------------------------
    // ПОРАЖЕНИЕ
    // -------------------------

    if (P.hp <= 0) {
      P.hp = 0;
      G.finish(false);
      return;
    }

    // -------------------------
    // ОЧИСТКА КОМНАТЫ
    // (если открыт выбор усиления — переход показываем после выбора)
    // -------------------------

    if (!S.cleared && !S.choice && S.enemies.length === 0) {
      G.roomCleared();
      return;
    }

    G.ui();
  }

  // =========================================================
  // ЦИКЛ
  // =========================================================

  function loop(time) {
    const dt = Math.min(0.033, (time - S.last) / 1000 || 0);
    S.last = time;

    try {
      tick(dt);
      G.draw();
    } catch (error) {
      // Страховка: ошибка в одном кадре не должна убивать игру.
      // Логируем и продолжаем цикл.
      if (window.console && console.error) {
        console.error('Shadow Ascendant error:', error);
      }
    }

    requestAnimationFrame(loop);
  }

  G.setup();
  requestAnimationFrame(loop);

  // =========================================================
  // КЛАВИАТУРА
  // =========================================================

  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    K[key] = true;

    if (event.code === 'Space') {
      event.preventDefault();
      G.attack();
    }

    if (event.code === 'KeyQ') {
      event.preventDefault();
      G.power();
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      G.summonFromVault();
    }

    if (event.code === 'KeyF') {
      event.preventDefault();
      G.returnShadow();
    }

    if (event.code === 'KeyG') {
      event.preventDefault();
      G.releaseShadow();
    }

    if (event.code === 'KeyE') {
      event.preventDefault();
      G.raise();
    }

    if (event.code === 'Escape') {
      event.preventDefault();
      G.pause();
    }
  });

  addEventListener('keyup', event => {
    K[event.key.toLowerCase()] = false;
  });

  // =========================================================
  // КНОПКИ
  // =========================================================

  $('play').onclick = G.start;

  $('reset').onclick = () => {
    if (window.confirm && confirm('Сбросить весь прогресс? Зона, теневые хранилище и улучшения будут удалены.')) {
      localStorage.removeItem('shadow-ascendant');
      location.reload();
    }
  };

  $('again').onclick = () => {
    G.setup();
    G.start();
  };

  $('next').onclick = G.nextRoom;

  $('attack').onclick = G.attack;
  $('power').onclick = G.power;
  $('raise').onclick = G.raise;
  $('summon').onclick = G.summonFromVault;
  $('return').onclick = G.returnShadow;
  $('release').onclick = G.releaseShadow;

  // Тач-кнопки: pointerdown вместо click —
  // надёжнее на мобильных и не конфликтует с жестами/скроллом.
  const tapButton = (el, fn) => {
    el.addEventListener('pointerdown', event => {
      event.preventDefault();
      fn();
    });
  };

  tapButton($('ta'), G.attack);
  tapButton($('tp'), G.power);
  tapButton($('ts'), G.summonFromVault);
  tapButton($('tr'), G.raise);

  $('pause').onclick = () => G.pause();
  $('resume').onclick = () => G.pause(false);

  // =========================================================
  // СЕНСОРНЫЙ ДЖОЙСТИК
  // =========================================================

  const joystick = $('stick');

  function moveStick(event) {
    const rect = joystick.getBoundingClientRect();

    let dx =
      (event.clientX - rect.left - rect.width / 2) /
      (rect.width / 2);

    let dy =
      (event.clientY - rect.top - rect.height / 2) /
      (rect.height / 2);

    const length = Math.hypot(dx, dy);

    if (length > 1) {
      dx /= length;
      dy /= length;
    }

    G.stick = { x: dx, y: dy };

    joystick.firstChild.style.transform =
      `translate(${dx * 22}px, ${dy * 22}px)`;
  }

  joystick.onpointerdown = event => {
    joystick.setPointerCapture(event.pointerId);
    moveStick(event);
  };

  joystick.onpointermove = event => {
    if (event.buttons) {
      moveStick(event);
    }
  };

  joystick.onpointerup = () => {
    G.stick = null;
    joystick.firstChild.style.transform = 'translate(0,0)';
  };
})();
