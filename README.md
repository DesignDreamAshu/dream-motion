# Dream Motion V1 MVP

Working V1 MVP for Dream Motion: import SVG/PNG/JPG, design frames, auto-motion, preview, and runtime export.

## Structure

- apps/web: React + Vite editor
- packages/runtime: runtime evaluator + canvas renderer
- packages/schema: Zod schemas for scene.json and motion.json
- packages/shared: shared types and constants
- packages/export: adapter stubs for GIF/MP4

## Setup

```bash
npm install
npm run dev
```

Open the dev server URL printed by Vite.

## Demo

- Use `Import SVG` and load `apps/web/public/sample.svg`.
- Create Frame 2 (Add Scene) and move a shape.
- Switch to Animate tab and drag the blue connector from Frame 1 -> Frame 2.
- Adjust Duration / Animation / Easing in the Properties panel.
- Toggle Preview mode and Play to verify motion.

## Tools (Text / Pencil / Pen / Image)

- Text tool (T): click to insert text, type, press Enter to commit.
- Pencil tool (B): drag to draw a freehand stroke; release to finish.
- Pen tool (P): click to add points, drag to curve, press Enter to finish.
- Image tool (I): click the image tool to pick a file; image drops at the center.
  - Click in the canvas to place at a specific position.

## DMX Save/Open

Use the Actions palette (Ctrl/Cmd + K):

- File -> Save / Save As... to download a `.dmx` project file.
- File -> Open... to restore a project from `.dmx`.

Sample file: `apps/web/public/sample.dmx`

Demo steps:

1) Create Frame 1 + Frame 2, draw a shape, connect transition.
2) Actions -> Save As... and download `project.dmx`.
3) Refresh browser.
4) Actions -> Open... and select `project.dmx`.

## Header Grouping

- Left: app menu, file name menu, New file
- Center: tool toolbar (shape + pen groups, responsive Tools menu)
- Right: Edit/Preview switch, play controls, Share, Resources menu, Workspace menu

## Runtime Export

Use `Export Runtime` to download:

- `scene.json`
- `motion.json`
- `runtime.js`

If `runtime.js` is missing, run:

```bash
npm run export-runtime
```

## Embed Example

```html
<canvas id="dm-canvas" width="960" height="540"></canvas>
<script src="runtime.js"></script>
<script>
  Promise.all([
    fetch('scene.json').then(r => r.json()),
    fetch('motion.json').then(r => r.json())
  ]).then(([scene, motion]) => {
    const canvas = document.getElementById('dm-canvas');
    const transitionId = motion.transitions[0]?.id;
    const player = window.DreamMotionRuntime.createPlayer({
      canvas,
      scene,
      motion,
      transitionId,
      loop: true
    });
    player.play();
  });
</script>
```

## Notes

- Preview uses the same runtime evaluator as export.
- SVG import supports basic shapes, paths, text, and images. Unsupported SVG elements generate warnings.
- GIF/MP4 export is stubbed in `packages/export`.




