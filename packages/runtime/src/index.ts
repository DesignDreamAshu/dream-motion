import type {
  DocumentModel,
  MotionModel,
  MotionTrack,
  MotionTrackProperty,
  Node,
  Frame,
  Bone,
  Skeleton
} from '@dream-motion/shared';

export type EvaluatedNode = Node;

const easingFns: Record<string, (t: number) => number> = {
  linear: (t) => t,
  ease: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - Math.pow(1 - t, 2),
  spring: (t) => 1 - Math.cos(t * Math.PI * 4) * Math.exp(-t * 6),
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  overshoot: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
};

export const getFrameById = (scene: DocumentModel, id: string): Frame | null =>
  scene.frames.find((frame) => frame.id === id) ?? null;

const indexNodes = (nodes: Node[]) => {
  const map = new Map<string, Node>();
  nodes.forEach((node) => map.set(node.id, node));
  return map;
};

const applyTrackValue = (
  track: MotionTrack,
  timeMs: number
): number => {
  const { delay, duration, from, to, easing } = track;
  if (duration <= 0) return to;
  const local = timeMs - delay;
  if (local <= 0) return from;
  if (local >= duration) return to;
  const t = Math.min(1, Math.max(0, local / duration));
  const ease = easingFns[easing] ?? easingFns.ease;
  const eased = ease(t);
  return from + (to - from) * eased;
};

const setProperty = (
  node: Node,
  property: MotionTrackProperty,
  value: number
) => {
  switch (property) {
    case 'x':
      node.x = value;
      break;
    case 'y':
      node.y = value;
      break;
    case 'width':
      node.width = value;
      break;
    case 'height':
      node.height = value;
      break;
    case 'rotation':
      node.rotation = value;
      break;
    case 'scaleX':
      node.scaleX = value;
      break;
    case 'scaleY':
      node.scaleY = value;
      break;
    case 'opacity':
      node.opacity = value;
      break;
    case 'cornerRadius':
      if ('cornerRadius' in node) {
        node.cornerRadius = value;
      }
      break;
    case 'lineLength':
      if (node.type === 'line' && 'points' in node) {
        const points = node.points;
        if (points.length >= 4) {
          const x1 = points[0];
          const y1 = points[1];
          const x2 = points[2];
          const y2 = points[3];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const currentLen = Math.sqrt(dx * dx + dy * dy) || 1;
          const scale = value / currentLen;
          points[2] = x1 + dx * scale;
          points[3] = y1 + dy * scale;
        }
      }
      break;
    default:
      break;
  }
};

const cloneNode = (node: Node): Node => JSON.parse(JSON.stringify(node));

const buildBoneMap = (skeleton: Skeleton) => {
  const map = new Map<string, Bone>();
  skeleton.bones.forEach((bone) => map.set(bone.id, { ...bone }));
  return map;
};

const computeBoneWorld = (boneId: string, bones: Map<string, Bone>, cache: Map<string, Bone>) => {
  const cached = cache.get(boneId);
  if (cached) return cached;
  const bone = bones.get(boneId);
  if (!bone) return null;
  if (!bone.parentId) {
    cache.set(boneId, bone);
    return bone;
  }
  const parent = computeBoneWorld(bone.parentId, bones, cache);
  if (!parent) return bone;
  const rotation = parent.rotation + bone.rotation;
  const x = parent.x + Math.cos((parent.rotation * Math.PI) / 180) * bone.x;
  const y = parent.y + Math.sin((parent.rotation * Math.PI) / 180) * bone.x;
  const world = { ...bone, x, y, rotation };
  cache.set(boneId, world);
  return world;
};

const applyAimConstraints = (skeleton: Skeleton, bones: Map<string, Bone>) => {
  skeleton.constraints.forEach((constraint) => {
    if (constraint.type !== 'aim') return;
    const bone = bones.get(constraint.boneId);
    if (!bone) return;
    const dx = constraint.targetX - bone.x;
    const dy = constraint.targetY - bone.y;
    bone.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  });
};

const applyIkConstraints = (skeleton: Skeleton, bones: Map<string, Bone>) => {
  skeleton.constraints.forEach((constraint) => {
    if (constraint.type !== 'ik') return;
    const [rootId, midId, endId] = constraint.chain;
    const root = bones.get(rootId);
    const mid = bones.get(midId);
    const end = bones.get(endId);
    if (!root || !mid || !end) return;
    const targetX = constraint.targetX;
    const targetY = constraint.targetY;
    const dx = targetX - root.x;
    const dy = targetY - root.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), root.length + mid.length);
    const a = root.length;
    const b = mid.length;
    const angleA = Math.acos(Math.min(1, Math.max(-1, (a * a + dist * dist - b * b) / (2 * a * dist))));
    const angleB = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - dist * dist) / (2 * a * b))));
    const targetAngle = Math.atan2(dy, dx);
    root.rotation = (targetAngle - angleA) * (180 / Math.PI);
    mid.rotation = (Math.PI - angleB) * (180 / Math.PI);
    end.x = mid.length;
    end.y = 0;
  });
};

const applySkeletons = (scene: DocumentModel, nodes: Node[]) => {
  if (!scene.skeletons.length) return nodes;
  const skeleton = scene.skeletons[0];
  const bones = buildBoneMap(skeleton);
  applyAimConstraints(skeleton, bones);
  applyIkConstraints(skeleton, bones);
  const cache = new Map<string, Bone>();

  return nodes.map((node) => {
    if (node.bind && node.bind.boneId) {
      const bone = computeBoneWorld(node.bind.boneId, bones, cache);
      if (!bone) return node;
      return {
        ...node,
        x: bone.x + node.bind.offsetX,
        y: bone.y + node.bind.offsetY,
        rotation: bone.rotation + node.bind.offsetRotation
      };
    }
    if (node.type === 'mesh') {
      const deformed = node.vertices.slice();
      for (let i = 0; i < node.vertices.length; i += 2) {
        let x = node.vertices[i];
        let y = node.vertices[i + 1];
        let dx = 0;
        let dy = 0;
        let hasInfluence = false;
        const weights = node.weights[i / 2] ?? [];
        weights.forEach((weight) => {
          const bone = computeBoneWorld(weight.boneId, bones, cache);
          if (!bone) return;
          hasInfluence = true;
          const r = (bone.rotation * Math.PI) / 180;
          const bx = bone.x;
          const by = bone.y;
          const rx = Math.cos(r) * x - Math.sin(r) * y;
          const ry = Math.sin(r) * x + Math.cos(r) * y;
          dx += (bx + rx) * weight.weight;
          dy += (by + ry) * weight.weight;
        });
        if (weights.length && hasInfluence) {
          deformed[i] = dx;
          deformed[i + 1] = dy;
        }
      }
      return { ...node, vertices: deformed };
    }
    return node;
  });
};

export const evaluateTransition = (input: {
  scene: DocumentModel;
  motion: MotionModel;
  transitionId: string;
  timeMs: number;
}): EvaluatedNode[] => {
  const { scene, motion, transitionId, timeMs } = input;
  const transition = motion.transitions.find((t) => t.id === transitionId);
  if (!transition) return [];

  const fromFrame = getFrameById(scene, transition.fromFrameId);
  const toFrame = getFrameById(scene, transition.toFrameId);
  if (!fromFrame || !toFrame) return [];

  const fromMap = indexNodes(fromFrame.nodes);
  const toMap = indexNodes(toFrame.nodes);

  const nodeIds = new Set<string>();
  fromMap.forEach((_, id) => nodeIds.add(id));
  toMap.forEach((_, id) => nodeIds.add(id));

  const tracksByNode = new Map<string, MotionTrack[]>();
  transition.tracks.forEach((track) => {
    const list = tracksByNode.get(track.nodeId) ?? [];
    list.push(track);
    tracksByNode.set(track.nodeId, list);
  });

  const evaluated: Node[] = [];
  nodeIds.forEach((id) => {
    const base = toMap.get(id) ?? fromMap.get(id);
    if (!base) return;
    const node = cloneNode(base);
    const tracks = tracksByNode.get(id) ?? [];
    tracks.forEach((track) => {
      const value = applyTrackValue(track, timeMs);
      setProperty(node, track.property, value);
    });
    evaluated.push(node);
  });

  const sorted = evaluated.sort((a, b) => a.zIndex - b.zIndex);
  return applySkeletons(scene, sorted);
};

export type CanvasRenderOptions = {
  canvas: HTMLCanvasElement;
  nodes: EvaluatedNode[];
  background: string | null;
};

const drawRect = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (node.cornerRadius && node.cornerRadius > 0) {
    const r = node.cornerRadius;
    const w = node.width;
    const h = node.height;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r);
    ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h);
    ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    if (node.fill) {
      ctx.fillStyle = node.fill;
      ctx.fill();
    }
    if (node.stroke && node.strokeWidth) {
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth;
      ctx.stroke();
    }
    return;
  }
  if (node.fill) {
    ctx.fillStyle = node.fill;
    ctx.fillRect(0, 0, node.width, node.height);
  }
  if (node.stroke && node.strokeWidth) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.strokeRect(0, 0, node.width, node.height);
  }
};

const drawEllipse = (ctx: CanvasRenderingContext2D, node: Node) => {
  ctx.beginPath();
  ctx.ellipse(
    node.width / 2,
    node.height / 2,
    node.width / 2,
    node.height / 2,
    0,
    0,
    Math.PI * 2
  );
  if (node.fill) {
    ctx.fillStyle = node.fill;
    ctx.fill();
  }
  if (node.stroke && node.strokeWidth) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke();
  }
};

const drawLine = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (!('points' in node)) return;
  const points = node.points;
  if (points.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  if (node.stroke && node.strokeWidth) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke();
  }
};

const drawPath = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (!('pathData' in node)) return;
  const path = new Path2D(node.pathData);
  if (node.fill) {
    ctx.fillStyle = node.fill;
    ctx.fill(path);
  }
  if (node.stroke && node.strokeWidth) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.stroke(path);
  }
};

const drawText = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (!('text' in node)) return;
  const fontSize = node.fontSize || 16;
  const fontFamily = node.fontFamily || 'Arial';
  const fontWeight = node.fontWeight ? String(node.fontWeight) + ' ' : '';
  ctx.font = `${fontWeight}${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  if (node.fill) {
    ctx.fillStyle = node.fill;
    ctx.fillText(node.text, 0, 0, node.width || undefined);
  }
  if (node.stroke && node.strokeWidth) {
    ctx.strokeStyle = node.stroke;
    ctx.lineWidth = node.strokeWidth;
    ctx.strokeText(node.text, 0, 0, node.width || undefined);
  }
};

const imageCache = new Map<string, HTMLImageElement>();

const drawImage = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (!('src' in node)) return;
  const src = node.src;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  if (img.complete) {
    ctx.drawImage(img, 0, 0, node.width, node.height);
  }
};

const renderNode = (ctx: CanvasRenderingContext2D, node: Node) => {
  if (!node.visible || node.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = node.opacity;
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.scale(node.scaleX, node.scaleY);
  ctx.translate(-node.width / 2, -node.height / 2);

  switch (node.type) {
    case 'rect':
      drawRect(ctx, node);
      break;
    case 'ellipse':
      drawEllipse(ctx, node);
      break;
    case 'line':
      drawLine(ctx, node);
      break;
    case 'path':
      drawPath(ctx, node);
      break;
    case 'text':
      drawText(ctx, node);
      break;
    case 'image':
      drawImage(ctx, node);
      break;
    case 'mesh': {
      if (!('vertices' in node) || !('triangles' in node)) break;
      const vertices = node.vertices;
      const triangles = node.triangles;
      if (node.fill) {
        ctx.fillStyle = node.fill;
      }
      for (let i = 0; i < triangles.length; i += 3) {
        const i0 = triangles[i] * 2;
        const i1 = triangles[i + 1] * 2;
        const i2 = triangles[i + 2] * 2;
        ctx.beginPath();
        ctx.moveTo(vertices[i0], vertices[i0 + 1]);
        ctx.lineTo(vertices[i1], vertices[i1 + 1]);
        ctx.lineTo(vertices[i2], vertices[i2 + 1]);
        ctx.closePath();
        if (node.fill) ctx.fill();
        if (node.stroke && node.strokeWidth) {
          ctx.strokeStyle = node.stroke;
          ctx.lineWidth = node.strokeWidth;
          ctx.stroke();
        }
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
};

export const renderToCanvas = (options: CanvasRenderOptions) => {
  const { canvas, nodes, background } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  nodes.forEach((node) => renderNode(ctx, node));
};

export type PlayerOptions = {
  canvas: HTMLCanvasElement;
  scene: DocumentModel;
  motion: MotionModel;
  transitionId: string;
  loop?: boolean;
};

export const createPlayer = (options: PlayerOptions) => {
  const { canvas, scene, motion, transitionId, loop } = options;
  let playing = false;
  let start = 0;
  let rafId = 0;
  const transition = motion.transitions.find((t) => t.id === transitionId);
  const duration = transition
    ? Math.max(
        transition.duration,
        transition.tracks.reduce((max, track) => Math.max(max, track.delay + track.duration), 0)
      )
    : 0;

  const tick = (timestamp: number) => {
    if (!playing) return;
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const timeMs = duration > 0 ? Math.min(elapsed, duration) : elapsed;
    const nodes = evaluateTransition({ scene, motion, transitionId, timeMs });
    const background = getFrameById(scene, transition?.fromFrameId ?? '')?.background ?? null;
    renderToCanvas({ canvas, nodes, background });

    if (elapsed >= duration) {
      if (loop) {
        start = timestamp;
        rafId = requestAnimationFrame(tick);
        return;
      }
      playing = false;
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  return {
    play: () => {
      if (playing) return;
      playing = true;
      start = 0;
      rafId = requestAnimationFrame(tick);
    },
    pause: () => {
      playing = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
    seek: (timeMs: number) => {
      const nodes = evaluateTransition({ scene, motion, transitionId, timeMs });
      const background = getFrameById(scene, transition?.fromFrameId ?? '')?.background ?? null;
      renderToCanvas({ canvas, nodes, background });
    }
  };
};

export const createStateMachine = (scene: DocumentModel, motion: MotionModel) => {
  const machine = scene.stateMachine;
  let currentStateId = machine.initialStateId ?? machine.states[0]?.id ?? null;
  const inputs = new Map<string, boolean | number | string | null>();
  machine.inputs.forEach((input) => inputs.set(input.id, input.defaultValue));

  const setInput = (id: string, value: boolean | number | string | null) => {
    inputs.set(id, value);
    const transitions = machine.transitions.filter((item) => item.fromStateId === currentStateId);
    transitions.forEach((transition) => {
      if (transition.condition === 'true') {
        currentStateId = transition.toStateId;
      }
      const inputValue = inputs.get(transition.inputId);
      if (inputValue && transition.condition === 'on') {
        currentStateId = transition.toStateId;
      }
    });
  };

  const getActiveFrame = () => {
    const state = machine.states.find((item) => item.id === currentStateId);
    if (!state) return null;
    return scene.frames.find((frame) => frame.id === state.frameId) ?? null;
  };

  return {
    getState: () => currentStateId,
    setInput,
    getActiveFrame
  };
};

export const blendFrames = (from: Frame, to: Frame, t: number): Node[] => {
  const clamped = Math.min(1, Math.max(0, t));
  const fromMap = new Map(from.nodes.map((node) => [node.id, node]));
  const toMap = new Map(to.nodes.map((node) => [node.id, node]));
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);
  const blended: Node[] = [];
  ids.forEach((id) => {
    const a = fromMap.get(id);
    const b = toMap.get(id);
    const base = b ?? a;
    if (!base) return;
    const node = JSON.parse(JSON.stringify(base)) as Node;
    if (a && b) {
      node.x = a.x + (b.x - a.x) * clamped;
      node.y = a.y + (b.y - a.y) * clamped;
      node.width = a.width + (b.width - a.width) * clamped;
      node.height = a.height + (b.height - a.height) * clamped;
      node.rotation = a.rotation + (b.rotation - a.rotation) * clamped;
      node.opacity = a.opacity + (b.opacity - a.opacity) * clamped;
    }
    blended.push(node);
  });
  return blended;
};
