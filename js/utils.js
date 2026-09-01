// =========================================================
// UTILS — холст, утилиты, частицы
// =========================================================
(() => {
  const G = window.ShadowAscendant;

  const C = document.querySelector('#canvas');
  const X = C.getContext('2d');

  G.canvas = C;
  G.ctx = X;
  G.W = C.width;
  G.H = C.height;

  G.$ = id => document.getElementById(id);

  // Нажатые клавиши.
  G.K = {};

  // Текущее значение джойстика (null — нет управления).
  G.stick = null;

  // Позиция портала-объекта (правый край арены).
  G.portalPos = () => ({ x: G.W - 70, y: G.H / 2 });

  // ---------- Утилиты ----------
  G.dist = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  G.clamp = (n, a, b) =>
    Math.max(a, Math.min(b, n));

  G.rand = (min, max) =>
    min + Math.random() * (max - min);

  // ---------- Частицы ----------
  G.fx = (x, y, color, amount = 8) => {
    const S = G.S;
    const rand = G.rand;

    while (amount--) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = rand(35, 145);

      S.fx.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        t: 0.5,
        color
      });
    }
  };

  // ---------- Отрисовка круга ----------
  G.circle = (object, color) => {
    X.beginPath();
    X.arc(object.x, object.y, object.r, 0, Math.PI * 2);
    X.fillStyle = color;
    X.fill();
  };

  // ---------- Энергетические эффекты (VFX) ----------
  // Расширяющаяся волна-кольцо.
  G.ring = (x, y, color, radius = 40, speed = 260, life = 0.4) => {
    G.S.fx.push({
      kind: 'ring', x, y, r: radius, vr: speed, t: life, color
    });
  };

  // Дуга — след удара клинком.
  G.arc = (x, y, dir, color, radius = 60, life = 0.22) => {
    G.S.fx.push({
      kind: 'arc', x, y, dir, r: radius, t: life, color
    });
  };

  // Магический круг призыва (руны).
  G.runeCircle = (x, y, color, radius = 34, life = 0.6) => {
    G.S.fx.push({
      kind: 'rune', x, y, r: radius, t: life, color,
      rot: Math.random() * Math.PI * 2
    });
  };

  // Взрыв из искр.
  G.burst = (x, y, color, amount = 18, speed = 200) => {
    const rand = G.rand;

    while (amount--) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.4, speed);

      G.S.fx.push({
        kind: 'spark', x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        t: rand(0.3, 0.7),
        color
      });
    }
  };
})();
