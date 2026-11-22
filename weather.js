// Weather: the GM sets {type, intensity, wind} in gm-companion.html (Firebase gmweather/gaia); every client
// draws it locally as one effect over the biggest map picture. Nothing is saved in the room.
import OBR, { buildEffect } from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';

export const WX = 'com.geezsheets/weather';
const URL = 'https://geezsheets-default-rtdb.firebaseio.com/gmweather/gaia.json';
const KINDS = { rain: 1, snow: 2, fog: 3, storm: 4 };

const SHADER = `
uniform float time, kind, inten, slant, cellpx;
float h1(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float vn(float2 p) {
  float2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + float2(1, 0)), f.x), mix(h1(i + float2(0, 1)), h1(i + float2(1, 1)), f.x), f.y);
}
float rain(float2 uv, float amt) {
  float2 p = float2(uv.x + uv.y * slant, uv.y);
  float a = 0.0;
  for (int k = 0; k < 2; k++) {
    float s = 5.0 + float(k) * 3.0;
    float c = floor(p.x * s), r = h1(float2(c, float(k)));
    float f = fract(p.y * (0.35 + 0.1 * float(k)) - time * (1.6 + r * 1.4 + float(k)) + r * 10.0);
    float streak = smoothstep(0.0, 0.015, f) * (1.0 - smoothstep(0.015, 0.1, f));
    float thin = 1.0 - smoothstep(0.03, 0.07, abs(fract(p.x * s) - 0.5));
    a += streak * thin * step(h1(float2(c, 9.0 + float(k))), amt);
  }
  return a;
}
float snow(float2 uv, float amt) {
  float a = 0.0;
  for (int k = 0; k < 3; k++) {
    float s = 1.0 + float(k) * 0.8;
    float2 q = uv * s * 1.6;
    q.y += time * 0.35 * s; q.x += sin(time * 0.6 + q.y) * 0.3 + slant * time * 0.4 * s;
    float2 cell = floor(q), f = fract(q) - 0.5, o = (float2(h1(cell + 3.0), h1(cell + 7.0)) - 0.5) * 0.6;
    a += (1.0 - smoothstep(0.05, 0.13, length(f - o))) * step(h1(cell), amt);
  }
  return a;
}
half4 main(float2 coord) {
  float2 uv = coord / cellpx;
  float a = 0.0; float3 col = float3(0.75, 0.85, 1.0);
  if (kind == 1.0 || kind == 4.0) {
    a = rain(uv, inten) * 0.5;
    if (kind == 4.0) {
      float fl = smoothstep(0.96, 1.0, sin(time * 0.9 + sin(time * 2.3) * 2.0));
      float dark = 0.28 * inten;
      float total = clamp(a + dark + fl * 0.35, 0.0, 1.0);
      float3 c = (col * a + float3(0.02, 0.03, 0.08) * dark + float3(1.0) * fl * 0.35) / max(total, 0.001);
      return half4(half3(c * total), half(total));
    }
  } else if (kind == 2.0) {
    a = snow(uv, inten) * 0.85; col = float3(1.0);
  } else if (kind == 3.0) {
    float2 q = uv * 0.35 + float2(time * 0.02 * (1.0 + slant * 4.0), 0.0);
    float n = 0.5 * vn(q) + 0.3 * vn(q * 2.1 + 5.0) + 0.2 * vn(q * 4.3 + 11.0);
    a = clamp(n * inten * 0.9, 0.0, 0.7); col = float3(0.82, 0.86, 0.9);
  }
  a = clamp(a, 0.0, 1.0);
  return half4(half3(col * a), half(a));
}`;

let wx = null, run = Promise.resolve(), lastKey = '';

async function sync() {
  const old = (await OBR.scene.isReady()) ? await OBR.scene.local.getItems((i) => i.metadata[WX]) : [];
  const kind = KINDS[wx?.type];
  if (!kind || !(await OBR.scene.isReady())) { if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id)); lastKey = ''; return; }
  const maps = await OBR.scene.items.getItems((i) => i.type === 'IMAGE' && i.layer === 'MAP' && i.visible);
  const map = maps.sort((a, b) => b.image.width * b.image.height - a.image.width * a.image.height)[0];
  if (!map) { if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id)); lastKey = ''; return; }
  const dpi = await OBR.scene.grid.getDpi();
  const key = JSON.stringify([map.id, map.position, map.scale, map.rotation, map.image, map.grid, wx.type, wx.intensity, wx.wind, dpi]);
  if (key === lastKey && old.length) return;
  const k = dpi / map.grid.dpi, ang = map.rotation * Math.PI / 180;
  const x = -map.grid.offset.x * k * map.scale.x, y = -map.grid.offset.y * k * map.scale.y;
  const effect = buildEffect().effectType('STANDALONE').sksl(SHADER)
    .width(map.image.width * k).height(map.image.height * k)
    .position({ x: map.position.x + x * Math.cos(ang) - y * Math.sin(ang), y: map.position.y + x * Math.sin(ang) + y * Math.cos(ang) })
    .scale(map.scale).rotation(map.rotation)
    .layer('ATTACHMENT').zIndex(1000).disableAutoZIndex(true).locked(true).disableHit(true).name('Weather')
    .metadata({ [WX]: true })
    .uniforms([
      { name: 'kind', value: kind },
      { name: 'inten', value: Math.max(0, Math.min(1, (Number(wx.intensity) || 0) / 100)) },
      { name: 'slant', value: ((Number(wx.wind) || 0) / 100) * 0.6 },
      { name: 'cellpx', value: dpi / Math.abs(map.scale.x) },
    ]).build();
  if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
  await OBR.scene.local.addItems([effect]);
  lastKey = key;
}
const queue = () => { run = run.then(sync).catch((e) => console.warn('GeezSheets weather:', e)); };

export function startWeather() {
  OBR.scene.items.onChange(queue); OBR.scene.grid.onChange(queue); OBR.scene.onReadyChange(queue);
  const es = new EventSource(URL);   // reconnects by itself, first event is the full value
  const set = (path, data) => {
    if (path === '/') wx = data && typeof data === 'object' ? { ...data } : null;
    else { wx = wx || {}; const k = path.split('/').filter(Boolean)[0]; if (data === null) delete wx[k]; else wx[k] = data; }
    queue();
  };
  es.addEventListener('put', (ev) => { const { path, data } = JSON.parse(ev.data); set(path, data); });
  es.addEventListener('patch', (ev) => { const { path, data } = JSON.parse(ev.data); for (const [k, v] of Object.entries(data || {})) set((path === '/' ? '' : path) + '/' + k, v); });
  queue();
}
