import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rooms, sceneItems, uploadFog, localWall, propLight, LIGHT, WALL, ROOM, DOOR, PART, inRoom } from './dd2vtt.js';

let serial = 0;
function builder(type) {
    const item = { id: String(++serial), type, metadata: {}, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 };
    const b = new Proxy({}, { get: (_, key) => key === 'build' ? () => item : (value) => { item[key] = value; return b; } });
    return b;
}
const b = Object.fromEntries(['Path', 'Curve', 'Wall', 'Light', 'Shape'].map((t) => ['build' + t, () => builder(t.toUpperCase())]));
const map = { w: 10, h: 10, ppg: 70, walls: [[{ x: 5, y: 0 }, { x: 5, y: 10 }]],
    doors: [{ a: { x: 2, y: 0 }, b: { x: 3, y: 0 }, closed: true }], lights: [{ x: 2, y: 2, range: 4 }] };
map.rooms = rooms(map);
assert(map.rooms.length >= 2, 'divider creates separate room fog outlines');
const img = { id: 'map', image: { width: 700, height: 700 }, grid: { dpi: 70, offset: { x: 0, y: 0 } }, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 };
const items = sceneItems(b, img, 150, map, { roomFog: true });
const shared = items.filter((i) => i.type !== 'LIGHT');
assert.equal(shared.length, items.length, 'all imported items are shared-safe, including light props');
const prop = items.find((i) => i.metadata[LIGHT]);
assert.equal(prop.layer, 'PROP');
assert.equal(prop.visible, false, 'light prop is hidden from players');
assert.equal(prop.locked, false, 'GM can move the prop');
assert.equal(prop.metadata[PART], img.id);
assert.equal(propLight(b.buildLight, prop).visible, true, 'hidden prop still emits visible light');
assert(shared.every((i) => i.type !== 'WALL'), 'shared fog batch contains no local-only walls');
assert.equal(shared.filter((i) => i.metadata[ROOM]).length, map.rooms.length);
const uploaded = uploadFog(b, map, { roomFog: true }, 700, 700);
assert.equal(uploaded.length, map.rooms.length, 'fog is embedded in the upload itself');
assert(uploaded.every((i) => i.layer === 'FOG' && !i.attachedTo && !i.metadata[PART]));
assert(uploaded.some((i) => inRoom(i, { x: 300, y: 300 })), 'embedded fog covers a point inside the map');
assert.equal(uploadFog(b, map, { roomFog: false }, 700, 700).length, 0);
const door = shared.find((i) => i.metadata[WALL] && i.metadata[DOOR]);
assert.equal(localWall(b.buildWall, door).blocking, true);
door.metadata[DOOR].closed = false;
assert.equal(localWall(b.buildWall, door).blocking, false, 'shared door state updates local wall');
door.rotation = 90; door.position = { x: 100, y: 200 };
const local = localWall(b.buildWall, door);
assert(Math.abs(local.points[0].x - 100) < 1e-8);
assert(Math.abs(local.points[0].y - 500) < 1e-8, 'walls follow shared geometry transforms');
console.log('PASS fog: room coverage, embedded upload fog, shared-safe geometry, local doors and transforms');
for (const file of ['background.html', 'import.html']) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8').split('<script type="module">')[1].split('</script>')[0].replace(/^import .*$/gm, '');
    new Function(code);
}

// Run the background's actual reconciliation against a joining client's empty local scene.
let props = [prop], locals = [], ready = true;
const OBR = { scene: {
    isReady: async () => ready, onReadyChange() {},
    items: { getItems: async (f) => props.filter(f), onChange() {} },
    local: {
        getItems: async (f) => locals.filter(f),
        addItems: async (items) => { locals.push(...items); },
        deleteItems: async (ids) => { locals = locals.filter((i) => !ids.includes(i.id)); },
    },
} };
const html = readFileSync(new URL('background.html', import.meta.url), 'utf8');
const block = html.slice(html.indexOf('  let propRun'), html.indexOf('  // Rooms tool'));
const sync = new Function('OBR', 'LIGHT', 'propLight', 'buildLight', block + '\nreturn { syncPropLights, settled: () => propRun };')(OBR, LIGHT, propLight, b.buildLight);
await sync.settled();
assert.equal(locals.length, 1, 'joining client recreates prop light');
const initialId = locals[0].id;
await sync.syncPropLights();
assert.equal(locals[0].id, initialId, 'unrelated changes do not rebuild light');
prop.position = { x: 450, y: 600 };
await sync.syncPropLights();
assert.deepEqual(locals[0].position, prop.position, 'light follows prop movement');
props = []; await sync.syncPropLights();
assert.equal(locals.length, 0, 'deleting prop removes emitted light');
props = [prop]; await sync.syncPropLights();
locals = []; await sync.syncPropLights();
assert.equal(locals.length, 1, 'lost local lights are restored');
console.log('PASS light props: hidden markers, joining clients, movement, deletion and recovery');
