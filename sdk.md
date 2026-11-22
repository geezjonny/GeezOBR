# Owlbear Rodeo SDK notes

These notes record the SDK behavior used by the extension. The extension currently imports `@owlbear-rodeo/sdk@3.1.0` from jsDelivr.

## Light items

- `buildLight()` creates an item with `type: "LIGHT"`.
- Light items are local-only. Add them with `OBR.scene.local.addItems()`, not `OBR.scene.items.addItems()`.
- Shared scene geometry such as walls, doors, and shapes belongs in `OBR.scene.items`.
- A light uses world-coordinate values for `attenuationRadius` and `sourceRadius`; multiplying a map radius in squares by the scene grid DPI converts it to world coordinates.
- The builder supports `.position()`, `.attenuationRadius()`, `.sourceRadius()`, `.falloff()`, `.innerAngle()`, `.outerAngle()`, and `.lightType()`.
- `lightType` is one of `PRIMARY`, `SECONDARY`, or `AUXILIARY`.
- `PRIMARY` lights reveal for everyone; `SECONDARY` lights are seen through character vision; `AUXILIARY` is available for other dynamic-fog use cases.
- `attenuationRadius` controls the outer light radius and also affects the distance at which walls block the light.
- `sourceRadius` controls the inner light radius and shadow softness.
- The light builder has no color, intensity, or shadows setters. Those dd2vtt fields cannot be represented directly by an Owlbear light item.

## Attachments and local synchronization

- Local lights can still use `.attachedTo(mapId)` and `.disableAttachmentBehavior([...])` so they follow a map picture.
- Because local items are not shared, each client must recreate imported lights from shared map metadata.
- The extension stores the imported map dimensions, light list, and selected light type in the map picture's `com.geezsheets/dd2vtt` metadata. The background page uses that metadata to rebuild local lights after scene load, refresh, or map transforms.
