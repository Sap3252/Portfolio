(() => {
// Modo claro / oscuro: el tema inicial lo aplica el script del <head>
const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const syncThemeUI = () => {
  const light = root.dataset.theme === 'light';
  themeToggle.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeToggle.title = light ? 'Modo oscuro' : 'Modo claro';
  themeColor.content = light ? '#f4f4f4' : '#000000';
};
themeToggle.addEventListener('click', () => {
  const next = root.dataset.theme === 'light' ? 'dark' : 'light';
  const apply = () => { root.dataset.theme = next; syncThemeUI(); };
  // Fundido suave donde el navegador lo soporta
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduce) document.startViewTransition(apply);
  else apply();
  try { localStorage.setItem('theme', next); } catch {}
});
syncThemeUI();

// Reloj en hora de Argentina
const clock = document.getElementById('clock');
const fmt = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const tick = () => { clock.textContent = fmt.format(new Date()); };
tick();
setInterval(tick, 1000);

// Barra de progreso de scroll
const progress = document.querySelector('.progress');
const onScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Grilla de materias: una celda por materia, encendidas las aprobadas
const subjects = document.querySelector('.subjects');
if (subjects) {
  const total = Number(subjects.dataset.total);
  const done = Number(subjects.dataset.done);
  for (let i = 0; i < total; i++) {
    const cell = document.createElement('span');
    if (i < done) cell.className = 'on';
    cell.style.setProperty('--i', i);
    subjects.append(cell);
  }
}

// Aparición de secciones al hacer scroll
const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('in');
    reveal.unobserve(entry.target);
  }
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

// Resalta en la barra superior la sección visible
const navLinks = [...document.querySelectorAll('.nav a')];
const spy = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navLinks.forEach(a => a.classList.toggle('active', a.hash === '#' + entry.target.id));
  }
}, { rootMargin: '-40% 0px -55% 0px' });
navLinks.forEach(a => {
  const section = document.querySelector(a.hash);
  if (section) spy.observe(section);
});

// Marquesina: se duplica el contenido para que el loop no tenga cortes
document.querySelectorAll('.marquee-track').forEach(track => {
  const clones = [...track.children].map(node => node.cloneNode(true));
  track.append(...clones);
  track.parentElement.classList.add('is-ready');
});

// Copiar email al portapapeles
document.querySelectorAll('[data-copy]').forEach(btn => {
  const label = btn.querySelector('span');
  const original = label.textContent;
  let timer;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      label.textContent = 'Copiado';
    } catch {
      label.textContent = 'Error';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { label.textContent = original; }, 1800);
  });
});

document.getElementById('year').textContent = new Date().getFullYear();
})();
