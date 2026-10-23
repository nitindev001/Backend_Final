
const q = s => document.querySelector(s), qa = s => [...document.querySelectorAll(s)];
const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;

// 3D cube: idle spin + pointer + scroll
const cube = q('.cube'); let mx = 0, my = 0, cx = 0, cy = 0, auto = 0;
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5 });
(function loop() {
  if (!rm) auto += .25;
  cx += (mx - cx) * .06; cy += (my - cy) * .06;
  const s = scrollY * .12;
  cube.style.setProperty('--ry', (auto + cx * 120 + s) + 'deg');
  cube.style.setProperty('--rx', (-20 - cy * 80 + s * .3) + 'deg');
  requestAnimationFrame(loop);
})();

// particle network
const cv = q('#bg'), c = cv.getContext('2d'); let W, H, P = [];
function size() {
  W = cv.width = innerWidth; H = cv.height = innerHeight;
  P = Array.from({ length: Math.min(70, W / 18 | 0) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3 }));
}
size(); addEventListener('resize', size);
(function draw() {
  c.clearRect(0, 0, W, H);
  P.forEach((p, i) => {
    if (!rm) { p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H }
    c.fillStyle = 'rgba(155,158,201,.7)'; c.fillRect(p.x, p.y, 2, 2);
    for (let j = i + 1; j < P.length; j++) {
      const d = Math.hypot(p.x - P[j].x, p.y - P[j].y);
      if (d < 120) { c.strokeStyle = 'rgba(139,108,255,' + (.18 * (1 - d / 120)) + ')'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(P[j].x, P[j].y); c.stroke() }
    }
  });
  if (!rm) requestAnimationFrame(draw);
})();

// 3D tilt cards
if (!rm) qa('.tilt').forEach(el => {
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    el.style.transform = 'perspective(800px) rotateY(' + x * 14 + 'deg) rotateX(' + (-y * 14) + 'deg) translateZ(8px)';
    el.style.setProperty('--gx', (x + .5) * 100 + '%'); el.style.setProperty('--gy', (y + .5) * 100 + '%');
  });
  el.addEventListener('pointerleave', () => { el.style.transform = '' });
});