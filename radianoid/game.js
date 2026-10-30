(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const CENTER = 400;
  const ORBIT = 289;
  const WALL = 310;
  const BALL_R = 5.8;
  const HEX_PALETTE = ['#57edff', '#729dff', '#a58aff', '#fd74cd', '#ffd985'];
  const POWERS = {
    G: { label: 'EXPANSIÓN', color: '#55f5ff', duration: 20 },
    T: { label: 'REDUCCIÓN', color: '#ff6b9b', duration: 14 },
    E: { label: 'ELÁSTICA', color: '#f9dc7b', duration: 18 },
    D: { label: 'DUAL', color: '#9c91ff', duration: 21 },
    C: { label: 'CAPTURA', color: '#8dffb2', duration: 20 },
    L: { label: 'LÁSER', color: '#ffbc75', duration: 19 },
    P: { label: 'PERFORANTE', color: '#e595ff', duration: 17 },
    M: { label: 'MULTIBOLA', color: '#6affd4' },
    H: { label: 'HIPER MULTIBOLA', color: '#ff7fdc' },
    X: { label: 'CAOS PERFORANTE', color: '#fff087' }
  };
  const POWER_POOL = ['G','G','G','D','D','E','E','C','C','L','L','P','P','M','M','H','H','X','T'];
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const board = $('board');
  const ctx = canvas.getContext('2d', { alpha: false });
  const ui = {
    score: $('score'), best: $('best'), level: $('level'), lives: $('lives'),
    pause: $('pauseBtn'), sound: $('soundBtn'), soundIcon: $('soundIcon'), soundLabel: $('soundLabel'),
    overlay: $('overlay'), overlayTitle: $('overlayTitle'), overlayText: $('overlayText'),
    overlaySymbol: $('overlaySymbol'), overlayEyebrow: $('overlayEyebrow'),
    overlayFootnote: $('overlayFootnote'), primary: $('primaryBtn'),
    state: $('stateLabel'), progress: $('progressFill'), bricks: $('bricksLabel'),
    hint: $('centerHint'), active: $('activeItems'), activeCount: $('activeCount'),
    caption: $('stageCaption')
  };
  const readStore = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
    catch { return fallback; }
  };
  const saveStore = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
  const bestStored = Number(readStore('radianoid-best-v1', '0')) || 0;
  const state = {
    mode: 'intro', level: 1, score: 0, best: bestStored, lives: 3,
    time: 0, visualTime: 0, lastHud: -1, lastShot: -1, shotHeld: false,
    paddle: Math.PI / 2, targetPaddle: Math.PI / 2, keyboardDir: 0,
    paddleVelocity: 0, bricks: [], totalBricks: 0,
    balls: [], capsules: [], shots: [], particles: [], floaters: [],
    power: {}, shake: 0, flash: 0, combo: 0, lastBreak: -10,
    stars: Array.from({ length: 95 }, () => ({
      x: Math.random() * 800, y: Math.random() * 800,
      size: .35 + Math.random() * 1.1, phase: Math.random() * TAU
    })),
    soundOn: readStore('radianoid-sound-v1', '1') !== '0',
    audio: null, touchMoving: false, pointerDown: false
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const random = (a, b) => a + Math.random() * (b - a);
  const wrap = angle => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const angleDiff = (a, b) => wrap(a - b);
  const magnitude = (x, y) => Math.hypot(x, y);
  const formatScore = n => Math.floor(n).toString().padStart(6, '0');
  const hasPower = key => Boolean(state.power[key] && state.power[key] > state.time);
  const paddleWidth = () => hasPower('G') ? .87 : hasPower('T') ? .34 : .58;
  const ballSpeed = () => Math.min(475, 290 + (state.level - 1) * 21 + Math.floor(state.score / 1500) * 5);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(canvas.width / 800, 0, 0, canvas.height / 800, 0, 0);
  }
  new ResizeObserver(resize).observe(board);
  window.addEventListener('resize', resize);

  function audioTone(freq = 440, duration = .08, kind = 'sine', volume = .045, bend = 0) {
    if (!state.soundOn) return;
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!state.audio) state.audio = new AudioCtor();
      const a = state.audio;
      if (a.state === 'suspended') a.resume();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = kind;
      osc.frequency.setValueAtTime(freq, a.currentTime);
      if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + bend), a.currentTime + duration);
      gain.gain.setValueAtTime(volume, a.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, a.currentTime + duration);
      osc.connect(gain); gain.connect(a.destination);
      osc.start(); osc.stop(a.currentTime + duration);
    } catch { /* Browsers may block audio. Gameplay does not depend on it. */ }
  }
  function playChord() {
    [330, 440, 660].forEach((f, i) => audioTone(f, .24 + i * .08, 'sine', .035));
  }
  function syncSound() {
    ui.soundIcon.textContent = state.soundOn ? '♫' : '♪̸';
    ui.soundLabel.textContent = state.soundOn ? 'SOUND ON' : 'SOUND OFF';
    ui.sound.setAttribute('aria-pressed', String(state.soundOn));
  }
  ui.sound.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    saveStore('radianoid-sound-v1', state.soundOn ? '1' : '0');
    syncSound();
    if (state.soundOn) audioTone(780, .08);
  });

  function hexVertices(x, y, size) {
    return Array.from({length: 6}, (_, i) => {
      const a = i * TAU / 6;
      return [x + Math.cos(a) * size, y + Math.sin(a) * size];
    });
  }
  function buildLevel() {
    const ringCount = Math.min(3 + Math.floor((state.level - 1) / 2), 5);
    const size = ringCount >= 5 ? 17.7 : ringCount === 4 ? 19 : 20.5;
    let id = 0;
    state.bricks = [];
    for (let q = -ringCount; q <= ringCount; q++) {
      for (let r = Math.max(-ringCount, -q - ringCount); r <= Math.min(ringCount, -q + ringCount); r++) {
        const s = -q - r;
        const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        const x = 1.5 * size * q;
        const y = Math.sqrt(3) * size * (r + q / 2);
        const health = (dist === 0 ? 3 : dist === 1 && state.level > 1 ? 2 : 1)
          + (state.level > 3 && (q * 5 + r * 7 + state.level) % 9 === 0 ? 1 : 0);
        const color = HEX_PALETTE[(ringCount - dist + state.level - 1) % HEX_PALETTE.length];
        state.bricks.push({ id: id++, x, y, size: size - 1.5, vertices: hexVertices(x, y, size - 1.5),
          hp: health, maxHp: health, color, phase: random(0, TAU), ring: dist });
      }
    }
    state.totalBricks = state.bricks.length;
    state.balls = []; state.capsules = []; state.shots = []; state.particles = []; state.floaters = [];
    state.power = {}; state.combo = 0; state.shake = 0;
    createBall(true);
    updateHud(true);
  }
  function createBall(stuck = false, origin = null, angle = null, piercing = false) {
    const a = angle == null ? state.paddle : angle;
    const speed = ballSpeed();
    const ball = {
      x: origin ? origin.x : Math.cos(a) * (ORBIT - 19),
      y: origin ? origin.y : Math.sin(a) * (ORBIT - 19),
      vx: origin ? Math.cos(a) * speed : -Math.cos(a) * speed + random(-35, 35),
      vy: origin ? Math.sin(a) * speed : -Math.sin(a) * speed + random(-35, 35),
      r: BALL_R, stuck, stickSide: 0, speed, piercing, hitIds: new Set(),
      trail: [], lastBrick: -1, lastBrickAt: -100, glow: random(0, TAU)
    };
    if (!stuck) normalizeBall(ball);
    state.balls.push(ball);
    return ball;
  }
  function normalizeBall(ball) {
    const m = magnitude(ball.vx, ball.vy) || 1;
    ball.vx = ball.vx / m * ball.speed;
    ball.vy = ball.vy / m * ball.speed;
  }
  function scatterParticles(x, y, color, n = 10, speed = 100) {
    for (let i = 0; i < n; i++) {
      const a = random(0, TAU), s = random(speed * .16, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        ttl: random(.24, .66), life: 0, color, size: random(.9, 3.2) });
    }
    if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
  }
  function floatText(x, y, text, color = '#c6faff', size = 15) {
    state.floaters.push({x, y, text, color, size, age: 0});
    if (state.floaters.length > 25) state.floaters.shift();
  }
  function addScore(amount) {
    state.score += amount;
    if (state.score > state.best) {
      state.best = state.score;
      saveStore('radianoid-best-v1', state.best);
    }
  }
  function dropCapsule(brick) {
    if (Math.random() > Math.min(.35, .27 + state.level * .012)) return;
    const letter = POWER_POOL[Math.floor(Math.random() * POWER_POOL.length)];
    const dir = random(0, TAU);
    const speed = random(85, 126);
    state.capsules.push({x: brick.x, y: brick.y, vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed, letter, angle: random(0, TAU), spin: random(-3, 3), life: 0});
  }
  function destroyBrick(brick, x, y) {
    const index = state.bricks.indexOf(brick);
    if (index < 0) return;
    state.bricks.splice(index, 1);
    const chain = state.time - state.lastBreak < 1.5;
    state.combo = chain ? Math.min(12, state.combo + 1) : 1;
    state.lastBreak = state.time;
    const points = 100 + (state.combo - 1) * 15;
    addScore(points);
    scatterParticles(brick.x, brick.y, brick.color, 12, 145);
    floatText(x, y, '+' + points, brick.color, 14);
    dropCapsule(brick);
    state.shake = Math.max(state.shake, 3.5);
    audioTone(280 + state.combo * 35, .085, 'triangle', .05, 160);
    if (state.bricks.length === 0) completeLevel();
  }
  function hitBrick(brick, x, y, damage = 1) {
    if (!state.bricks.includes(brick)) return;
    brick.hp -= damage;
    state.flash = .25;
    if (brick.hp <= 0) destroyBrick(brick, x, y);
    else {
      addScore(20);
      scatterParticles(x, y, brick.color, 5, 65);
      audioTone(190 + brick.hp * 75, .055, 'sine', .035);
    }
  }

  function distanceToHex(ball, brick) {
    let min = Infinity, nx = 0, ny = 0;
    const vertices = brick.vertices;
    let inside = true;
    for (let i = 0; i < 6; i++) {
      const [ax, ay] = vertices[i], [bx, by] = vertices[(i + 1) % 6];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((ball.x - ax) * dx + (ball.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const px = ax + dx * t, py = ay + dy * t;
      const ddx = ball.x - px, ddy = ball.y - py;
      const dist = ddx * ddx + ddy * ddy;
      if (dist < min) { min = dist; nx = ddx; ny = ddy; }
      if ((dx * (ball.y - ay) - dy * (ball.x - ax)) < 0) inside = false;
    }
    const distance = Math.sqrt(min);
    if (distance >= ball.r && !inside) return null;
    const normalSize = magnitude(nx, ny);
    if (inside || normalSize < .001) {
      const speed = magnitude(ball.vx, ball.vy) || 1;
      return {x: -ball.vx / speed, y: -ball.vy / speed};
    }
    return {x: nx / normalSize, y: ny / normalSize};
  }

  function breakByBall(ball, prevX, prevY) {
    if (state.bricks.length === 0) return;
    const pierce = ball.piercing || hasPower('P');
    for (const brick of state.bricks) {
      const reach = brick.size + ball.r;
      if (Math.abs(ball.x - brick.x) > reach || Math.abs(ball.y - brick.y) > reach) continue;
      const normal = distanceToHex(ball, brick);
      if (!normal) continue;
      if (pierce) {
        if (ball.hitIds.has(brick.id)) continue;
        ball.hitIds.add(brick.id);
        hitBrick(brick, ball.x, ball.y, 1);
        // Piercing moves continuously through the tile, never reflecting.
      } else {
        if (ball.lastBrick === brick.id && state.time - ball.lastBrickAt < .065) return;
        ball.lastBrick = brick.id; ball.lastBrickAt = state.time;
        hitBrick(brick, ball.x, ball.y, 1);
        ball.x = prevX; ball.y = prevY;
        const dot = ball.vx * normal.x + ball.vy * normal.y;
        if (dot < 0) {
          ball.vx -= 2 * dot * normal.x;
          ball.vy -= 2 * dot * normal.y;
        } else { ball.vx = -ball.vx; ball.vy = -ball.vy; }
        // Avoid near-parallel lockups at vertices.
        if (magnitude(ball.vx, ball.vy) < 5) ball.vx = 1;
        normalizeBall(ball);
        return;
      }
      if (state.mode !== 'playing') return;
    }
  }
  function paddleAngles() { return hasPower('D') ? [state.paddle, wrap(state.paddle + Math.PI)] : [state.paddle]; }
  function catchAngle(angle) {
    const width = paddleWidth();
    for (const a of paddleAngles()) {
      const delta = angleDiff(angle, a);
      if (Math.abs(delta) <= width / 2 + .026) return {a, delta};
    }
    return null;
  }
  function bounceBall(ball, angle, captured) {
    ball.x = Math.cos(angle) * (ORBIT - 11);
    ball.y = Math.sin(angle) * (ORBIT - 11);
    const impact = clamp(captured.delta / (paddleWidth() / 2), -.99, .99);
    if (hasPower('C')) {
      ball.stuck = true;
      ball.stickSide = Math.abs(angleDiff(captured.a, state.paddle)) > 1 ? Math.PI : 0;
      ball.trail.length = 0;
      audioTone(480, .12, 'sine', .05, -200);
      return;
    }
    const elastic = hasPower('E');
    const normalX = -Math.cos(angle), normalY = -Math.sin(angle);
    const tangentX = -Math.sin(angle), tangentY = Math.cos(angle);
    const turn = impact * (elastic ? 1.02 : .80) + (elastic ? clamp(state.paddleVelocity / 14, -.2, .2) : 0);
    ball.vx = normalX * 1 + tangentX * turn;
    ball.vy = normalY * 1 + tangentY * turn;
    ball.speed = clamp(ball.speed * (elastic ? 1.13 : 1.019), 235, elastic ? 600 : 520);
    normalizeBall(ball);
    scatterParticles(ball.x, ball.y, elastic ? '#ffdd86' : '#61ebff', 6, 80);
    state.shake = Math.max(state.shake, elastic ? 5 : 2.4);
    audioTone(elastic ? 590 : 380, .1, elastic ? 'sawtooth' : 'sine', .045, 220);
  }
  function loseBall(ball) {
    const index = state.balls.indexOf(ball);
    if (index < 0) return;
    state.balls.splice(index, 1);
    scatterParticles(ball.x, ball.y, '#ff70cf', 16, 180);
    audioTone(220, .24, 'triangle', .06, -160);
    state.shake = 8;
    if (state.balls.length > 0) return;
    state.lives--;
    state.power = {}; state.shots = []; state.capsules = [];
    if (state.lives <= 0) finishGame();
    else {
      createBall(true);
      floatText(0, 210, 'ENERGÍA PERDIDA', '#ff88ca', 20);
      updateHud(true);
    }
  }

  function updateBalls(dt) {
    for (const ball of [...state.balls]) {
      if (!state.balls.includes(ball)) continue;
      if (ball.stuck) {
        const a = state.paddle + ball.stickSide;
        ball.x = Math.cos(a) * (ORBIT - 20);
        ball.y = Math.sin(a) * (ORBIT - 20);
        ball.trail.length = 0;
        continue;
      }
      const steps = Math.max(1, Math.ceil((ball.speed * dt) / 3.5));
      const sub = dt / steps;
      for (let i = 0; i < steps; i++) {
        if (state.mode !== 'playing' || !state.balls.includes(ball)) break;
        const oldX = ball.x, oldY = ball.y;
        ball.x += ball.vx * sub;
        ball.y += ball.vy * sub;
        breakByBall(ball, oldX, oldY);
        if (state.mode !== 'playing') break;
        const r = magnitude(ball.x, ball.y);
        if (r >= ORBIT - 7) {
          const a = Math.atan2(ball.y, ball.x);
          const hit = catchAngle(a);
          if (hit) bounceBall(ball, a, hit);
          else if (r >= WALL + BALL_R) { loseBall(ball); break; }
        }
      }
      if (!ball.stuck && state.balls.includes(ball)) {
        ball.trail.push({x: ball.x, y: ball.y});
        if (ball.trail.length > 13) ball.trail.shift();
      }
    }
  }

  function launchStuck() {
    let launched = false;
    for (const ball of state.balls) {
      if (!ball.stuck) continue;
      const angle = Math.atan2(ball.y, ball.x);
      const offset = random(-.20, .20);
      ball.speed = Math.max(ball.speed, ballSpeed());
      ball.vx = -Math.cos(angle + offset) * ball.speed;
      ball.vy = -Math.sin(angle + offset) * ball.speed;
      ball.stuck = false;
      normalizeBall(ball);
      launched = true;
      scatterParticles(ball.x, ball.y, '#76ffff', 6, 65);
    }
    if (launched) { audioTone(630, .14, 'sine', .055, 180); updateHud(true); }
  }
  function shoot() {
    if (!hasPower('L') || state.time - state.lastShot < .23) return;
    state.lastShot = state.time;
    for (const a of paddleAngles()) {
      for (const off of [-paddleWidth() * .22, paddleWidth() * .22]) {
        const angle = a + off;
        const start = ORBIT - 17;
        state.shots.push({x: Math.cos(angle) * start, y: Math.sin(angle) * start,
          vx: -Math.cos(angle) * 690, vy: -Math.sin(angle) * 690, ttl: 1.1});
      }
    }
    scatterParticles(Math.cos(state.paddle) * ORBIT, Math.sin(state.paddle) * ORBIT, '#ffbd75', 3, 80);
    audioTone(760, .07, 'square', .025, -330);
  }
  function updateShots(dt) {
    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.ttl -= dt;
      let hit = false;
      for (const brick of state.bricks) {
        if (Math.abs(s.x - brick.x) > brick.size + 4 || Math.abs(s.y - brick.y) > brick.size + 4) continue;
        if (distanceToHex({x:s.x,y:s.y,r:4,vx:s.vx,vy:s.vy}, brick)) {
          hitBrick(brick, s.x, s.y, 1); hit = true; break;
        }
      }
      if (hit || s.ttl <= 0 || magnitude(s.x, s.y) > WALL + 20) state.shots.splice(i, 1);
      if (state.mode !== 'playing') break;
    }
  }
  function addMultiballs(number, piercing = false) {
    const source = state.balls.find(b => !b.stuck) || state.balls[0];
    if (!source) { createBall(true); return; }
    const x = source.x, y = source.y;
    const original = Math.atan2(source.vy, source.vx);
    // Spread in a full fan; enough variation for ricochets without an instant outward wipeout.
    const canAdd = Math.min(number, 28 - state.balls.length);
    for (let i = 0; i < canAdd; i++) {
      const angle = original + (i - (canAdd - 1) / 2) * (piercing ? .46 : .34) + random(-.09, .09);
      const ball = createBall(false, {x, y}, angle, piercing);
      ball.speed = source.speed * random(.92, 1.05);
      normalizeBall(ball);
      ball.trail.length = 0;
    }
    if (piercing) for (const b of state.balls) b.piercing = true;
    scatterParticles(x, y, piercing ? POWERS.X.color : POWERS.H.color, 30, 210);
    state.shake = 11;
  }
  function collectCapsule(c) {
    const letter = c.letter;
    const power = POWERS[letter];
    addScore(50);
    if (letter === 'M') addMultiballs(2);
    else if (letter === 'H') addMultiballs(8);
    else if (letter === 'X') { addMultiballs(11, true); state.power.P = state.time + 17; }
    else {
      if (letter === 'G') delete state.power.T;
      if (letter === 'T') delete state.power.G;
      state.power[letter] = state.time + power.duration;
    }
    floatText(c.x, c.y, power.label, power.color, 17);
    scatterParticles(c.x, c.y, power.color, 24, 135);
    state.shake = 7;
    playChord();
    updateHud(true);
  }
  function updateCapsules(dt) {
    for (let i = state.capsules.length - 1; i >= 0; i--) {
      const c = state.capsules[i];
      c.x += c.vx * dt; c.y += c.vy * dt; c.life += dt; c.angle += c.spin * dt;
      const radius = magnitude(c.x, c.y);
      if (radius >= ORBIT - 13) {
        if (catchAngle(Math.atan2(c.y, c.x)) && radius <= WALL + 18) collectCapsule(c);
        state.capsules.splice(i, 1);
      } else if (c.life > 7) state.capsules.splice(i, 1);
    }
  }
  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.1; p.vy *= 1 - dt * 1.1;
      if (p.life >= p.ttl) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const f = state.floaters[i];
      f.age += dt; f.y -= dt * 23;
      if (f.age >= .85) state.floaters.splice(i, 1);
    }
  }
  function update(dt) {
    state.time += dt;
    const before = state.paddle;
    if (state.keyboardDir) state.targetPaddle = wrap(state.targetPaddle - state.keyboardDir * dt * 3.4);
    const delta = angleDiff(state.targetPaddle, state.paddle);
    state.paddle = wrap(state.paddle + delta * Math.min(1, dt * 21));
    state.paddleVelocity = angleDiff(state.paddle, before) / dt;
    state.shake = Math.max(0, state.shake - dt * 24);
    state.flash = Math.max(0, state.flash - dt * 1.8);
    for (const key of Object.keys(state.power)) {
      if (!hasPower(key)) delete state.power[key];
    }
    if (state.shotHeld) shoot();
    updateBalls(dt);
    if (state.mode !== 'playing') return;
    updateShots(dt);
    if (state.mode !== 'playing') return;
    updateCapsules(dt);
    updateParticles(dt);
    if (state.time - state.lastHud > .12) updateHud();
  }

  function showOverlay(eyebrow, title, text, button, note, symbol) {
    ui.overlayEyebrow.textContent = eyebrow;
    ui.overlayTitle.innerHTML = title;
    ui.overlayText.textContent = text;
    ui.primary.firstChild.textContent = button + ' ';
    ui.overlayFootnote.textContent = note;
    ui.overlaySymbol.textContent = symbol;
    ui.overlay.classList.remove('hidden');
    updateHud(true);
  }
  function hideOverlay() { ui.overlay.classList.add('hidden'); }
  function beginGame() {
    state.level = 1; state.score = 0; state.lives = 3;
    state.time = 0; state.lastShot = -1; state.combo = 0;
    buildLevel();
    state.mode = 'playing';
    hideOverlay();
    playChord();
    updateHud(true);
  }
  function completeLevel() {
    if (state.mode !== 'playing') return;
    state.mode = 'level';
    state.shotHeld = false;
    addScore(350 * state.level);
    showOverlay('SECTOR DESPEJADO', 'ÓRBITA<br><em>LIBERADA.</em>',
      'El núcleo cayó. Las próximas estructuras serán más resistentes. Tu energía sigue intacta.',
      'SIGUIENTE SECTOR', 'BONIFICACIÓN POR LIMPIEZA DE SECTOR', '✧');
    audioTone(700, .38, 'sine', .05, 500);
  }
  function nextLevel() {
    state.level++;
    buildLevel();
    state.mode = 'playing';
    hideOverlay();
    playChord();
  }
  function finishGame() {
    state.mode = 'gameover'; state.shotHeld = false;
    showOverlay('FIN DE TRANSMISIÓN', 'GAME<br><em>OVER.</em>',
      'Tu señal se perdió, pero el núcleo sigue esperando. Conseguí ' + formatScore(state.score) + ' puntos.',
      'VOLVER A JUGAR', 'MEJOR PUNTAJE: ' + formatScore(state.best), '✕');
  }
  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused'; state.shotHeld = false;
      showOverlay('TRANSMISIÓN INTERRUMPIDA', 'EN<br><em>PAUSA.</em>',
        'La órbita está congelada. Retomá cuando quieras.', 'CONTINUAR', 'P O ESC PARA REANUDAR', 'Ⅱ');
    } else if (state.mode === 'paused') {
      state.mode = 'playing'; hideOverlay(); updateHud(true);
    }
  }
  ui.pause.addEventListener('click', togglePause);
  ui.primary.addEventListener('click', () => {
    switch (state.mode) {
      case 'intro': case 'gameover': beginGame(); break;
      case 'paused': togglePause(); break;
      case 'level': nextLevel(); break;
    }
  });
  function interact() {
    if (state.mode !== 'playing') return;
    launchStuck();
    shoot();
  }
  board.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || state.mode !== 'playing') return;
    state.pointerDown = true;
    if (event.pointerType !== 'mouse') {
      state.touchMoving = true;
      const rect = board.getBoundingClientRect();
      state.targetPaddle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2);
    }
    state.shotHeld = true;
    interact();
  });
  window.addEventListener('pointermove', event => {
    if (state.mode !== 'playing') return;
    const rect = board.getBoundingClientRect();
    if (event.pointerType === 'mouse') {
      const portion = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      state.targetPaddle = wrap((.5 - portion) * TAU + Math.PI / 2);
    } else if (state.touchMoving) {
      state.targetPaddle = Math.atan2(event.clientY - rect.top - rect.height / 2, event.clientX - rect.left - rect.width / 2);
    }
  });
  window.addEventListener('pointerup', () => { state.pointerDown = false; state.touchMoving = false; state.shotHeld = false; });
  window.addEventListener('pointercancel', () => { state.pointerDown = false; state.touchMoving = false; state.shotHeld = false; });
  window.addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') state.keyboardDir = -1;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') state.keyboardDir = 1;
    if (event.code === 'Space') {
      if (!event.repeat && state.mode === 'playing') interact();
      if (state.mode === 'playing') state.shotHeld = true;
    }
    if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) togglePause();
    if (event.code === 'Enter' && !event.repeat && state.mode !== 'playing') ui.primary.click();
  });
  window.addEventListener('keyup', event => {
    if ((event.code === 'ArrowLeft' || event.code === 'KeyA') && state.keyboardDir < 0) state.keyboardDir = 0;
    if ((event.code === 'ArrowRight' || event.code === 'KeyD') && state.keyboardDir > 0) state.keyboardDir = 0;
    if (event.code === 'Space') state.shotHeld = false;
  });
  window.addEventListener('blur', () => {
    state.keyboardDir = 0; state.shotHeld = false;
    if (state.mode === 'playing') togglePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') togglePause();
  });

  function updateHud(force = false) {
    if (!force && state.time - state.lastHud < .10) return;
    state.lastHud = state.time;
    ui.score.textContent = formatScore(state.score);
    ui.best.textContent = formatScore(state.best);
    ui.level.textContent = String(state.level).padStart(2, '0');
    ui.lives.textContent = Array.from({length: state.lives}, () => '◆').join(' ');
    ui.pause.textContent = state.mode === 'paused' ? '▶' : 'Ⅱ';
    ui.pause.setAttribute('aria-label', state.mode === 'paused' ? 'Reanudar juego' : 'Pausar juego');
    const left = state.bricks.length;
    ui.bricks.textContent = left + ' NÚCLEOS';
    ui.progress.style.width = ((state.totalBricks - left) / (state.totalBricks || 1) * 100).toFixed(1) + '%';
    const statuses = {intro:'ESPERANDO JUGADOR',playing:'SEÑAL ACTIVA',paused:'TRANSMISIÓN EN PAUSA',level:'SECTOR DESPEJADO',gameover:'SEÑAL PERDIDA'};
    ui.state.textContent = statuses[state.mode];
    const stuck = state.mode === 'playing' && state.balls.some(b => b.stuck);
    ui.hint.classList.toggle('show', stuck);
    ui.caption.innerHTML = 'SECTOR ' + String(state.level).padStart(2, '0') + ' <span>↗</span> ' + (state.mode === 'playing' ? 'EN VIVO' : 'STANDBY');
    const actives = Object.keys(state.power).filter(hasPower);
    ui.activeCount.textContent = String(actives.length).padStart(2, '0');
    ui.active.replaceChildren();
    if (!actives.length) {
      const none = document.createElement('span');
      none.className = 'no-effects'; none.textContent = 'NINGÚN EFECTO ACTIVO';
      ui.active.append(none);
    } else for (const key of actives) {
      const node = document.createElement('span');
      node.className = 'active-token';
      node.style.setProperty('--token', POWERS[key].color);
      node.textContent = key + ' ' + Math.ceil(state.power[key] - state.time) + 's';
      node.title = POWERS[key].label;
      ui.active.append(node);
    }
  }

  function pathHex(vertices) {
    ctx.beginPath();
    for (let i = 0; i < vertices.length; i++) {
      const [x, y] = vertices[i];
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function arc(a, b, r) { ctx.beginPath(); ctx.arc(0, 0, r, a, b); }
  function drawBackground() {
    const bg = ctx.createRadialGradient(400, 390, 40, 400, 400, 570);
    bg.addColorStop(0, '#10223b'); bg.addColorStop(.40, '#080e20'); bg.addColorStop(1, '#030714');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 800);
    ctx.save();
    for (const star of state.stars) {
      ctx.globalAlpha = .18 + Math.sin(state.visualTime * 1.2 + star.phase) * .12;
      ctx.fillStyle = '#b1d6ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    ctx.translate(CENTER, CENTER);
    const a = state.visualTime;
    ctx.strokeStyle = '#234461'; ctx.lineWidth = 1;
    for (let r = 70; r < 320; r += 48) {
      ctx.globalAlpha = r > 280 ? .32 : .22;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = .30;
    for (let i = 0; i < 24; i++) {
      const ang = i * TAU / 24;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 45, Math.sin(ang) * 45);
      ctx.lineTo(Math.cos(ang) * 320, Math.sin(ang) * 320); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.rotate(a * .035);
    ctx.strokeStyle = '#4ebbd35c'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      arc(i * TAU / 4, i * TAU / 4 + .28, 332); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.rotate(-a * .022);
    ctx.strokeStyle = '#c17ce444'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      arc(i * TAU / 12, i * TAU / 12 + .12, 345); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#5f9bb963'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 10]);
    arc(0, TAU, 254); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 72; i++) {
      const ang = TAU * i / 72;
      const major = i % 6 === 0;
      ctx.strokeStyle = major ? '#65cde68a' : '#3b678553';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 317, Math.sin(ang) * 317);
      ctx.lineTo(Math.cos(ang) * (major ? 327 : 322), Math.sin(ang) * (major ? 327 : 322)); ctx.stroke();
    }
    ctx.shadowColor = '#45e1ff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#52d9f78f'; ctx.lineWidth = 1.5;
    arc(0, TAU, WALL); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU);
    ctx.strokeStyle = '#45deff24'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function drawBricks() {
    ctx.save(); ctx.translate(CENTER, CENTER);
    for (const brick of state.bricks) {
      ctx.save();
      pathHex(brick.vertices);
      ctx.shadowColor = brick.color; ctx.shadowBlur = 13;
      ctx.strokeStyle = brick.color; ctx.lineWidth = 2.1;
      ctx.fillStyle = '#0d2032'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.save(); pathHex(brick.vertices); ctx.clip();
      const g = ctx.createLinearGradient(brick.x - brick.size, brick.y - brick.size, brick.x + brick.size, brick.y + brick.size);
      g.addColorStop(0, brick.color + '39');
      g.addColorStop(.53, brick.color + '12');
      g.addColorStop(1, '#00000006');
      ctx.fillStyle = g; ctx.fillRect(brick.x - brick.size - 2, brick.y - brick.size - 2, brick.size * 2 + 4, brick.size * 2 + 4);
      ctx.restore();
      ctx.globalAlpha = .52 + Math.sin(state.visualTime * 1.7 + brick.phase) * .20;
      ctx.strokeStyle = brick.color; ctx.lineWidth = .9;
      ctx.beginPath(); ctx.moveTo(brick.x - brick.size * .28, brick.y + brick.size * .2);
      ctx.lineTo(brick.x, brick.y - brick.size * .25);
      ctx.lineTo(brick.x + brick.size * .28, brick.y + brick.size * .2); ctx.stroke();
      ctx.globalAlpha = 1;
      if (brick.maxHp > 1) {
        for (let h = 0; h < brick.hp; h++) {
          ctx.fillStyle = brick.color;
          ctx.fillRect(brick.x - (brick.hp - 1) * 3 + h * 6 - 1.5, brick.y + brick.size * .47, 3, 2);
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawPaddleAt(angle, secondary = false) {
    const width = paddleWidth();
    ctx.save(); ctx.translate(CENTER, CENTER);
    const color = hasPower('E') ? '#ffe792' : hasPower('C') ? '#8affb1' : secondary ? '#bf9eff' : '#72f4ff';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color + '1c'; ctx.lineWidth = 25;
    ctx.shadowColor = color; ctx.shadowBlur = 22;
    arc(angle - width / 2, angle + width / 2, ORBIT); ctx.stroke();
    ctx.strokeStyle = color + '80'; ctx.lineWidth = 15;
    ctx.shadowBlur = 24;
    arc(angle - width / 2, angle + width / 2, ORBIT); ctx.stroke();
    ctx.strokeStyle = '#f5ffff'; ctx.lineWidth = 5;
    ctx.shadowBlur = 14;
    arc(angle - width / 2, angle + width / 2, ORBIT); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = color;
    ctx.shadowBlur = 14;
    arc(angle - width / 2, angle + width / 2, ORBIT - 10); ctx.stroke();
    ctx.shadowBlur = 0;
    for (const side of [-1, 1]) {
      const a = angle + side * width / 2;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(Math.cos(a) * ORBIT, Math.sin(a) * ORBIT, 7, 0, TAU); ctx.fill();
    }
    if (hasPower('L')) {
      for (const side of [-1,1]) {
        const a = angle + side * width * .22;
        const x = Math.cos(a) * (ORBIT - 15), y = Math.sin(a) * (ORBIT - 15);
        ctx.fillStyle = '#ffbf75'; ctx.shadowColor = '#ffbf75'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawBalls() {
    ctx.save(); ctx.translate(CENTER, CENTER);
    for (const ball of state.balls) {
      const piercing = ball.piercing || hasPower('P');
      const color = piercing ? '#f3aaff' : '#b5fbff';
      if (ball.trail.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < ball.trail.length; i++) {
          const p = ball.trail[i];
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = piercing ? '#dc8dff60' : '#59e6ff6c';
        ctx.lineWidth = piercing ? 4 : 3; ctx.lineCap = 'round'; ctx.stroke();
      }
      ctx.shadowColor = color; ctx.shadowBlur = piercing ? 25 : 17;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, piercing ? 6.7 : BALL_R, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 2.5, 0, TAU); ctx.fill();
      if (piercing) {
        ctx.strokeStyle = '#f1b6ff8c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 10 + Math.sin(state.visualTime * 12 + ball.glow) * 2, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawCapsules() {
    ctx.save(); ctx.translate(CENTER, CENTER);
    for (const c of state.capsules) {
      const color = POWERS[c.letter].color;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
      ctx.shadowColor = color; ctx.shadowBlur = 19;
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.fillStyle = '#0b1a2d';
      ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(8, -11); ctx.lineTo(12, 8); ctx.lineTo(-8, 11); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.rotate(-c.angle);
      ctx.font = '800 16px "Barlow Condensed", sans-serif';
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.letter, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawShots() {
    ctx.save(); ctx.translate(CENTER, CENTER);
    ctx.lineCap = 'round';
    for (const shot of state.shots) {
      const dir = magnitude(shot.vx, shot.vy) || 1;
      ctx.beginPath();
      ctx.moveTo(shot.x - shot.vx / dir * 16, shot.y - shot.vy / dir * 16);
      ctx.lineTo(shot.x, shot.y);
      ctx.strokeStyle = '#ffba73'; ctx.lineWidth = 3;
      ctx.shadowColor = '#ffae64'; ctx.shadowBlur = 18;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawParticles() {
    ctx.save(); ctx.translate(CENTER, CENTER);
    for (const p of state.particles) {
      ctx.globalAlpha = 1 - p.life / p.ttl;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.min(1, (1 - f.age / .85) * 1.6);
      ctx.font = '800 ' + f.size + 'px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = f.color;
      ctx.shadowColor = f.color; ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
  function draw() {
    if (!canvas.width) return;
    ctx.save();
    drawBackground();
    ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
    drawBricks();
    drawCapsules();
    drawShots();
    drawParticles();
    for (const a of paddleAngles()) drawPaddleAt(a, Math.abs(angleDiff(a, state.paddle)) > 1);
    drawBalls();
    ctx.restore();
  }
  let last = performance.now(), accumulator = 0;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    state.visualTime += dt;
    if (state.mode === 'playing') {
      accumulator = Math.min(.08, accumulator + dt);
      while (accumulator >= 1 / 120 && state.mode === 'playing') {
        update(1 / 120); accumulator -= 1 / 120;
      }
    } else {
      accumulator = 0;
      updateParticles(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }
  buildLevel();
  state.mode = 'intro';
  syncSound();
  updateHud(true);
  resize();
  requestAnimationFrame(frame);
})();