/*
  Port a WebGL2 puro del componente Dither de React Bits (sin React ni three.js).
  Shaders: Copyright (c) 2026 David Haz, licencia MIT + Commons Clause
  https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
*/
(() => {
const CONFIG = {
  // Colores por tema, en valores 0–1. El dithering los reduce a pocos niveles,
  // así que el tono que se ve en pantalla es aproximado: conviene probar y mirar.
  themes: {
    dark:  { waveColor: [0.06, 0.45, 0.14], backgroundColor: [0, 0, 0] },          // verde oscuro sobre negro
    light: { waveColor: [0.12, 0.62, 0.22], backgroundColor: [0.91, 0.91, 0.91] }  // verde claro sobre #f4f4f4
  },
  colorNum: 4.3,
  pixelSize: 2,
  waveAmplitude: 0.44,
  waveFrequency: 2.3,
  waveSpeed: 0.03,
  disableAnimation: false,
  enableMouseInteraction: true,
  mouseRadius: 0
};

// Si el sistema pide menos movimiento, se dibuja un único cuadro estático
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) CONFIG.disableAnimation = true;

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// Paso 1: ondas de ruido Perlin (fbm) con distorsión de dominio
const WAVE_FRAG = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec3 backgroundColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
out vec4 fragColor;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz, iy = Pi.yyww, fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x), g10 = vec2(gx.y, gy.y), g01 = vec2(gx.z, gy.z), g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0, amp = 1.0, freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }
  vec3 col = mix(backgroundColor, waveColor, clamp(f, 0.0, 1.0));
  fragColor = vec4(col, 1.0);
}`;

// Paso 2: pixelado + dithering ordenado con matriz de Bayer 8x8
const DITHER_FRAG = `#version 300 es
precision highp float;
uniform sampler2D inputBuffer;
uniform vec2 resolution;
uniform float colorNum;
uniform float pixelSize;
out vec4 fragColor;

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float stepSize = 1.0 / (colorNum - 1.0);
  color += threshold * stepSize;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float bias = mix(0.2, 0.0, smoothstep(0.45, 0.8, luminance));
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

// three.js convierte la salida final de lineal a sRGB; se replica acá
vec3 linearToSRGB(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 normalizedPixelSize = pixelSize / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(uv / normalizedPixelSize);
  vec4 color = texture(inputBuffer, uvPixel);
  fragColor = vec4(linearToSRGB(dither(uv, color.rgb)), 1.0);
}`;

const canvas = document.getElementById('dither');
if (!canvas) return;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
// Sin WebGL2 queda un degradado CSS en su lugar (ver .no-webgl en styles.css)
const fallback = () => canvas.parentElement.classList.add('no-webgl');
if (!gl) return fallback();

const program = (vsSource, fsSource) => {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vsSource], [gl.FRAGMENT_SHADER, fsSource]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'position');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
    loc[name] = gl.getUniformLocation(p, name);
  }
  return { p, loc };
};

let wave, retro;
try {
  wave = program(VERT, WAVE_FRAG);
  retro = program(VERT, DITHER_FRAG);
} catch (err) {
  console.warn('Dither: no se pudo compilar el shader', err);
  return fallback();
}

// Triángulo que cubre toda la pantalla
gl.bindVertexArray(gl.createVertexArray());
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

// Buffer intermedio en half float, como el EffectComposer original
const halfFloat = !!gl.getExtension('EXT_color_buffer_float');
const tex = gl.createTexture();
const fbo = gl.createFramebuffer();
let width = 0, height = 0;

const resize = () => {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); // dpr 1, igual que el original
  if (w === width && h === height) return false;
  width = canvas.width = w;
  height = canvas.height = h;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA,
    halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return true;
};

// El canvas queda detrás del contenido, así que el mouse se escucha en la ventana
const mouse = [0, 0];
window.addEventListener('pointermove', e => {
  const r = canvas.getBoundingClientRect();
  mouse[0] = e.clientX - r.left;
  mouse[1] = e.clientY - r.top;
}, { passive: true });
// smoothstep(0, 0, x) no está definido en GLSL: con radio 0 la interacción se apaga
const mouseOn = CONFIG.enableMouseInteraction && CONFIG.mouseRadius > 0;

const start = performance.now();
let time = 0;
let drawn = false;
let visible = true;
let raf = 0;

// Paleta según el tema activo (<html data-theme="dark|light">)
const root = document.documentElement;
let palette;
const applyTheme = () => {
  palette = CONFIG.themes[root.dataset.theme] || CONFIG.themes.dark;
  drawn = false; // fuerza un redibujado aunque la animación esté quieta
};
applyTheme();
new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
const draw = () => {
  gl.viewport(0, 0, width, height);

  // Paso 1: ondas al buffer intermedio
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.useProgram(wave.p);
  const u = wave.loc;
  gl.uniform2f(u.resolution, width, height);
  gl.uniform1f(u.time, time);
  gl.uniform1f(u.waveSpeed, CONFIG.waveSpeed);
  gl.uniform1f(u.waveFrequency, CONFIG.waveFrequency);
  gl.uniform1f(u.waveAmplitude, CONFIG.waveAmplitude);
  gl.uniform3fv(u.waveColor, palette.waveColor);
  gl.uniform3fv(u.backgroundColor, palette.backgroundColor);
  gl.uniform2fv(u.mousePos, mouse);
  gl.uniform1i(u.enableMouseInteraction, mouseOn ? 1 : 0);
  gl.uniform1f(u.mouseRadius, CONFIG.mouseRadius);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Paso 2: pixelado y dithering a la pantalla
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(retro.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(retro.loc.inputBuffer, 0);
  gl.uniform2f(retro.loc.resolution, width, height);
  gl.uniform1f(retro.loc.colorNum, CONFIG.colorNum);
  gl.uniform1f(retro.loc.pixelSize, CONFIG.pixelSize);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  drawn = true;
};

const frame = now => {
  raf = 0;
  if (!visible) return; // fuera de pantalla no se dibuja nada
  const resized = resize();
  if (!CONFIG.disableAnimation) time = (now - start) / 1000;
  if (!CONFIG.disableAnimation || resized || !drawn) draw();
  raf = requestAnimationFrame(frame);
};

// Pausa la animación cuando la banda sale de la pantalla
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible && !raf) raf = requestAnimationFrame(frame);
}).observe(canvas);
})();
