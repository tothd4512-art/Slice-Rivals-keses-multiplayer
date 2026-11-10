# .mj emote packs

A `.mj` file is a JSON file that adds a keyframe dance or movement to Blade Rivals.
Import it in the Armory → **Dance Packs** tab with **📂 Import .mj file**.
Once imported, the pack appears in the Dance Packs list and the emote menus.
Imported packs are stored in your save, so they stay after a restart.

## Fields

| Field | Type | Notes |
|---|---|---|
| `format` | `"mj-emote"` | required |
| `version` | `1` | required |
| `id` | string | required, 3–32 chars: `a-z 0-9 _` |
| `name` | string | required, up to 40 chars (emoji are fine) |
| `desc` | string | optional, up to 140 chars |
| `duration` | number | seconds, 0.2–12 |
| `loop` | boolean | default `true`. `false` holds the last pose |
| `knife` | boolean | default `true`. Show the knife in the right hand |
| `keyframes` | array | 1–120 entries, the first one at `t: 0` |

Each keyframe is `{ "t": seconds, "parts": { ... } }`. Parts that are not listed keep their rest pose.
Values between keyframes are interpolated linearly.

Allowed parts: `body`, `torso`, `head`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg`.

- `rot: [x, y, z]` in radians, clamped to ±6.3.
- `pos: [x, y, z]` in metres, clamped to ±1.5. Only `body` may use `pos`.

Rotation x > 0 raises an arm forward and up. Body `rot.x < 0` leans the character forward.

## Example

```json
{
  "format": "mj-emote",
  "version": 1,
  "id": "my_wave",
  "name": "👋 Wave",
  "desc": "A little wave with the right arm.",
  "duration": 1.0,
  "loop": true,
  "knife": true,
  "keyframes": [
    { "t": 0.0, "parts": { "rightArm": { "rot": [2.4, 0, -0.2] } } },
    { "t": 0.5, "parts": { "rightArm": { "rot": [2.8, 0, -0.5] } } },
    { "t": 1.0, "parts": { "rightArm": { "rot": [2.4, 0, -0.2] } } }
  ]
}
```

Files are limited to 64 KB, and up to 20 custom packs can be imported.
Use the `id` of a built-in pack (`moonwalk`, `lean_forward`) to unlock that pack without buying it.
