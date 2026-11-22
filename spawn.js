// Token spawner: the GM picks a token in gm-companion.html, which pushes {token, count, at} to Firebase gmspawn/gaia.
// The GM's OBR client turns each request into token images at the centre of the view, then deletes the request.
import OBR, { buildImage } from 'https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm';
const BASE = 'https://geezsheets-default-rtdb.firebaseio.com/gmspawn/gaia';
const TOKENS = 'https://geezjonny.github.io/GeezSheets/tokens/';
const MAX_AGE = 2 * 60 * 1000;
const seen = new Set();
const pretty = (t) => t.replace(/\.png$/i, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

async function spawn(id, req) {
  if (seen.has(id)) return; seen.add(id);
  await fetch(`${BASE}/${id}.json`, { method: 'DELETE' }).catch(() => {});   // drop first so a reload never repeats it
  const token = String(req?.token || '');
  if (!/^[\w\- ]+\.png$/i.test(token) || Date.now() - (Number(req.at) || 0) > MAX_AGE) return;
  if (!(await OBR.scene.isReady()) || (await OBR.player.getRole()) !== 'GM') return;
  const count = Math.max(1, Math.min(20, Math.trunc(Number(req.count)) || 1));
  const dpi = await OBR.scene.grid.getDpi();
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const mid = await OBR.viewport.inverseTransformPoint({ x: w / 2, y: h / 2 });
  const url = TOKENS + encodeURIComponent(token), name = pretty(token), cols = Math.ceil(Math.sqrt(count));
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(buildImage({ url, mime: 'image/png', width: 256, height: 256 }, { dpi: 256, offset: { x: 128, y: 128 } })
      .position({ x: mid.x + ((i % cols) - (cols - 1) / 2) * dpi, y: mid.y + (Math.floor(i / cols) - (Math.ceil(count / cols) - 1) / 2) * dpi })
      .layer('CHARACTER').name(count > 1 ? `${name} ${i + 1}` : name).build());
  }
  await OBR.scene.items.addItems(items);
}

export function startSpawn() {
  const es = new EventSource(BASE + '.json');
  const handle = (path, data) => {
    if (path === '/') { for (const [k, v] of Object.entries(data || {})) spawn(k, v); return; }
    const k = path.split('/').filter(Boolean)[0];
    if (data && typeof data === 'object') spawn(k, data);
  };
  es.addEventListener('put', (ev) => { const { path, data } = JSON.parse(ev.data); handle(path, data); });
  es.addEventListener('patch', (ev) => { const { path, data } = JSON.parse(ev.data); for (const [k, v] of Object.entries(data || {})) handle((path === '/' ? '' : path) + '/' + k, v); });
}
