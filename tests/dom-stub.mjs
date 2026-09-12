/* ============================================================
   Headless-заглушка DOM для автотестов Shadow Ascendant.
   Не требует зависимостей: игра выполняется в node:vm, а все
   обращения к document/canvas/localStorage обслуживает эта
   минимальная реализация. Позволяет прогонять сотни игровых
   секунд без браузера.
   ============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'js', 'shadow-game.js'
);

export function createEnv(options = {}) {
  const errors = [];

  class ClassList {
    constructor() { this.items = new Set(); }
    add(...c) { c.forEach((x) => this.items.add(x)); }
    remove(...c) { c.forEach((x) => this.items.delete(x)); }
    contains(c) { return this.items.has(c); }
    toggle(c, force) {
      const on = force === undefined ? !this.items.has(c) : !!force;
      if (on) this.items.add(c); else this.items.delete(c);
      return on;
    }
  }

  class El {
    constructor(id = '', tag = 'div') {
      this.id = id;
      this.tagName = tag.toUpperCase();
      this.classList = new ClassList();
      this.style = {};
      this.children = [];
      this.listeners = {};
      this.rect = { width: 960, height: 600, left: 0, top: 0 };
      this._text = '';
      this._html = '';
      this.onclick = null;
    }
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); }
    get innerHTML() { return this._html; }
    set innerHTML(v) { this._html = String(v); if (v === '') this.children = []; }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    querySelector(sel) { return this.children.find((c) => c.tag === sel || c.tagName === sel.toUpperCase()) || null; }
    getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
    setPointerCapture() {}
    releasePointerCapture() {}
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
    fire(type, event = {}) { (this.listeners[type] || []).forEach((fn) => fn({ preventDefault() {}, ...event })); }
    click() { if (this.onclick) this.onclick({ preventDefault() {} }); }
  }

  // Набор элементов из index.html
  const ids = ['canvas', 'sound', 'level', 'hptext', 'hp', 'xp', 'vault', 'shadows', 'pause', 'arena',
    'start', 'rank', 'portalname', 'play', 'reset', 'statvault', 'statclears', 'statkills',
    'upgrade', 'upgradesub', 'choices', 'paused', 'resume', 'quit',
    'end', 'endrank', 'endtitle', 'endtext', 'endsummary', 'again',
    'bossbar', 'bossname', 'bosshp', 'banner', 'bannertitle', 'bannertext',
    'objective', 'objbar', 'attack', 'raise', 'touch', 'stick', 'ta', 'tr'];

  const elements = new Map();
  for (const id of ids) {
    const tag = ['canvas'].includes(id) ? 'canvas' : (id.startsWith('t') && id.length === 2) || ['attack', 'raise', 'play', 'again', 'resume', 'quit', 'reset', 'pause', 'sound'].includes(id) ? 'button' : 'div';
    elements.set(id, new El(id, tag));
  }

  // #stick > i (координаты, как в мобильной вёрстке)
  const knob = new El('', 'i');
  elements.get('stick').children.push(knob);
  elements.get('stick').rect = { width: 92, height: 92, left: 22, top: 15 };

  // Стартовое состояние классов, как в index.html
  for (const id of ['upgrade', 'paused', 'end', 'bossbar', 'banner']) elements.get(id).classList.add('hidden');
  elements.get('bossbar').classList.add('bossbar');
  elements.get('banner').classList.add('banner');

  // Контекст canvas
  const ctxCalls = {};
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      const fn = (...args) => {
        ctxCalls[prop] = (ctxCalls[prop] || 0) + 1;
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          return { addColorStop() {} };
        }
        if (prop === 'measureText') return { width: 10 };
        return undefined;
      };
      return fn;
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });

  const canvasEl = elements.get('canvas');
  canvasEl.getContext = () => ctx;
  canvasEl.width = 960;
  canvasEl.height = 600;

  const arenaEl = elements.get('arena');
  arenaEl.rect = { width: options.width ?? 960, height: options.height ?? 600, left: 0, top: 0 };

  const store = new Map();
  if (options.storage) for (const [k, v] of Object.entries(options.storage)) store.set(k, v);
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const windowListeners = {};
  let rafCallback = null;
  let time = 0;

  const documentStub = {
    hidden: false,
    querySelector: (sel) => (sel === '#canvas' ? canvasEl : null),
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => new El('', tag),
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    removeEventListener: () => {}
  };

  let lcg = 123456789;
  const mathStub = Object.create(Math);
  mathStub.random = options.seed === undefined
    ? Math.random
    : () => {
        lcg = (1103515245 * lcg + 12345) % 2147483648;
        return lcg / 2147483648;
      };

  const sandbox = {
    console,
    document: documentStub,
    localStorage,
    Math: mathStub, JSON, Date, Number, Object, Array, String, Boolean, isNaN, isFinite,
    parseInt, parseFloat, Set, Map, Error, TypeError, Symbol, Promise,
    devicePixelRatio: 1,
    innerWidth: options.width ?? 960,
    innerHeight: options.height ?? 600,
    performance: { now: () => time },
    setTimeout: (fn) => { try { fn(); } catch (e) { errors.push(e); } return 0; },
    clearTimeout: () => {},
    requestAnimationFrame: (cb) => { rafCallback = cb; return 1; },
    cancelAnimationFrame: () => {},
    ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb([]); } disconnect() {} },
    addEventListener: (type, fn) => { (windowListeners[type] ||= []).push(fn); },
    removeEventListener: () => {},
    alert: () => {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const code = fs.readFileSync(options.file || GAME_FILE, 'utf8');
  const context = vm.createContext(sandbox);

  vm.runInContext(code, context, { filename: 'shadow-game.js' });

  // Управление кадрами
  const frame = (dtMs = 16.6667) => {
    time += dtMs;
    const cb = rafCallback;
    rafCallback = null;
    if (cb) cb(time);
  };

  const key = (type, k, code) => {
    const list = windowListeners[type] || [];
    for (const fn of list) fn({ key: k, code, preventDefault() {} });
  };

  return {
    sandbox,
    game: sandbox.ShadowAscendant,
    elements,
    errors,
    ctxCalls,
    store,
    canvasEl,
    arenaEl,
    frame,
    key,
    get time() { return time; },
    fireWindow: (type, event = {}) => (windowListeners[type] || []).forEach((fn) => fn(event)),
    documentStub
  };
}
