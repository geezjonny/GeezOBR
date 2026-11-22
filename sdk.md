# Owlbear Rodeo SDK notes

These notes record the SDK behavior used by the extension. The extension currently imports `@owlbear-rodeo/sdk@3.1.0` from jsDelivr.

## Light items

- `buildLight()` creates an item with `type: "LIGHT"`.
- Light items are local-only. Add them with `OBR.scene.local.addItems()`, not `OBR.scene.items.addItems()`.
- SDK `WALL` items are also local-only. Sending them in a shared batch can prevent the entire batch (including fog) from being added. Persist wall geometry as invisible shared curves and recreate the local wall on every client. Door state lives in shared metadata.
- A light uses world-coordinate values for `attenuationRadius` and `sourceRadius`; multiplying a map radius in squares by the scene grid DPI converts it to world coordinates.
- The builder supports `.position()`, `.attenuationRadius()`, `.sourceRadius()`, `.falloff()`, `.innerAngle()`, `.outerAngle()`, and `.lightType()`.
- `lightType` is one of `PRIMARY`, `SECONDARY`, or `AUXILIARY`.
- `PRIMARY` lights reveal for everyone; `SECONDARY` lights are seen through character vision; `AUXILIARY` is available for other dynamic-fog use cases.
- `attenuationRadius` controls the outer light radius.
- `sourceRadius` controls the inner light radius and shadow softness.
- The light builder has no color, intensity, or shadows setters. Those dd2vtt fields cannot be represented directly by an Owlbear light item.

## Attachments and local synchronization

- Local lights can still use `.attachedTo(mapId)` and `.disableAttachmentBehavior([...])` so they follow a map picture.
- Because local items are not shared, each client must recreate imported lights from shared map metadata.
- The extension stores the imported map dimensions, light list, and selected light type in the map picture's `com.geezsheets/dd2vtt` metadata. The background page uses that metadata to rebuild local lights after scene load, refresh, or map transforms.

## Static fog and scene uploads

- Imports default to infinite fog fill, walls enabled, and primary lights. Each imported light is represented by a hidden, unlocked shared prop with `com.geezsheets/light` metadata containing its world radius and light type.
- Each client renders a local light from that prop. The emitted light explicitly stays visible even though the shared prop has `visible: false`; moving, scaling or deleting the prop updates its light. The Add Light tool creates the same prop format.
- `torch.png` is a generated transparent ordinary torch illustration saved for use as prop art. Built-in image generation prompt: "One plain medieval wooden torch, a rough brown wooden stick with a coarse cloth-wrapped burning head, orange-yellow fire, warm hand-painted tabletop RPG prop style, dark outlines, natural wood grain, transparent background. No metal, ornaments, emblems, text, UI or scenery." It is provided as an asset; the current light markers use circles.

- Static room fog is a shared `PATH` item on the `FOG` layer. `fillRule('evenodd')` supports holes within a room outline.
- `buildSceneUpload().items(items)` embeds shared items in the uploaded scene. Use this for fog so it exists immediately, even if the background page fails to initialize.
- Scene uploads default to a 150-DPI scene grid. Convert map pixels using `150 / map.ppg` when embedding fog beside a base map uploaded at `map.ppg` DPI.
- Browser-local pending imports are a fallback for attaching dynamic geometry after the map item is created; they should not be the sole mechanism for creating static fog.

References: [Wall](https://docs.owlbear.rodeo/extensions/reference/items/wall/), [Light](https://docs.owlbear.rodeo/extensions/reference/items/light/), [Path](https://docs.owlbear.rodeo/extensions/reference/items/path/), [Scene upload builder](https://docs.owlbear.rodeo/extensions/reference/builders/scene-upload/).

## Deployment

- This repository is `GeezOBR`; its manifest must reference `https://geezjonny.github.io/GeezOBR/`. The original manifest referenced `GeezSheets/owlbear/`, so pushing this repository did not update the code loaded by that older manifest.
