import type { Node, NodeBase, ShapeNode, TextNode, LineNode, PathNode, ImageNode, PathPoint } from '@dream-motion/shared';
import { createId } from './ids';

export type SvgImportResult = {
  width: number;
  height: number;
  nodes: Node[];
  warnings: string[];
};

const parseNumber = (value: string | null, fallback = 0) => {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseFill = (value: string | null) => {
  if (!value || value === 'none') return null;
  return value;
};

const parseStroke = (value: string | null) => {
  if (!value || value === 'none') return null;
  return value;
};

const parseStyleAttr = (value: string | null) => {
  if (!value) return {};
  return value.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, raw] = part.split(':').map((item) => item.trim());
    if (key && raw) acc[key] = raw;
    return acc;
  }, {});
};

const parseTransform = (value: string | null) => {
  const matrix = new DOMMatrix();
  if (!value) return matrix;
  const regex = /(\w+)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value))) {
    const fn = match[1];
    const rawArgs = match[2]
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number.parseFloat(part));

    if (fn === 'translate') {
      matrix.translateSelf(rawArgs[0] || 0, rawArgs[1] || 0);
    } else if (fn === 'scale') {
      matrix.scaleSelf(rawArgs[0] ?? 1, rawArgs[1] ?? rawArgs[0] ?? 1);
    } else if (fn === 'rotate') {
      const angle = rawArgs[0] || 0;
      const cx = rawArgs[1] || 0;
      const cy = rawArgs[2] || 0;
      if (rawArgs.length > 1) {
        matrix.translateSelf(cx, cy);
        matrix.rotateSelf(angle);
        matrix.translateSelf(-cx, -cy);
      } else {
        matrix.rotateSelf(angle);
      }
    } else if (fn === 'matrix') {
      if (rawArgs.length === 6) {
        const [a, b, c, d, e, f] = rawArgs;
        const next = new DOMMatrix([a, b, c, d, e, f]);
        matrix.multiplySelf(next);
      }
    }
  }
  return matrix;
};

const parsePathPoints = (pathData: string): PathPoint[] => {
  const segments = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  const points: PathPoint[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  segments.forEach((segment) => {
    const command = segment[0];
    const values = segment
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((part) => Number.parseFloat(part))
      .filter((part) => !Number.isNaN(part));
    const isRelative = command === command.toLowerCase();
    if (command === 'M' || command === 'm') {
      for (let i = 0; i < values.length; i += 2) {
        cx = values[i] + (isRelative ? cx : 0);
        cy = values[i + 1] + (isRelative ? cy : 0);
        if (!points.length) {
          sx = cx;
          sy = cy;
        }
        points.push({ x: cx, y: cy });
      }
    } else if (command === 'L' || command === 'l') {
      for (let i = 0; i < values.length; i += 2) {
        cx = values[i] + (isRelative ? cx : 0);
        cy = values[i + 1] + (isRelative ? cy : 0);
        points.push({ x: cx, y: cy });
      }
    } else if (command === 'C' || command === 'c') {
      for (let i = 0; i < values.length; i += 6) {
        const c1x = values[i] + (isRelative ? cx : 0);
        const c1y = values[i + 1] + (isRelative ? cy : 0);
        const x = values[i + 4] + (isRelative ? cx : 0);
        const y = values[i + 5] + (isRelative ? cy : 0);
        if (points.length) {
          const prev = points[points.length - 1];
          prev.out = { x: c1x - prev.x, y: c1y - prev.y };
        }
        cx = x;
        cy = y;
        points.push({ x: cx, y: cy });
      }
    } else if (command === 'H' || command === 'h') {
      values.forEach((value) => {
        cx = value + (isRelative ? cx : 0);
        points.push({ x: cx, y: cy });
      });
    } else if (command === 'V' || command === 'v') {
      values.forEach((value) => {
        cy = value + (isRelative ? cy : 0);
        points.push({ x: cx, y: cy });
      });
    } else if (command === 'Z' || command === 'z') {
      cx = sx;
      cy = sy;
    }
  });
  return points;
};

const combineMatrix = (parent: DOMMatrix, local: DOMMatrix) => {
  const next = new DOMMatrix(parent.toFloat64Array());
  return next.multiplySelf(local);
};

const decomposeMatrix = (matrix: DOMMatrix) => {
  const scaleX = Math.hypot(matrix.a, matrix.b) || 1;
  const scaleY = Math.hypot(matrix.c, matrix.d) || 1;
  const rotation = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
  return {
    x: matrix.e,
    y: matrix.f,
    scaleX,
    scaleY,
    rotation
  };
};

const buildBase = (partial: Partial<NodeBase>, zIndex: number): NodeBase => ({
  id: partial.id ?? createId(),
  name: partial.name ?? 'Layer',
  type: partial.type ?? 'rect',
  parentId: null,
  locked: partial.locked ?? false,
  x: partial.x ?? 0,
  y: partial.y ?? 0,
  width: partial.width ?? 10,
  height: partial.height ?? 10,
  rotation: partial.rotation ?? 0,
  scaleX: partial.scaleX ?? 1,
  scaleY: partial.scaleY ?? 1,
  opacity: partial.opacity ?? 1,
  visible: partial.visible ?? true,
  fill: partial.fill ?? null,
  stroke: partial.stroke ?? null,
  strokeWidth: partial.strokeWidth ?? null,
  cornerRadius: partial.cornerRadius ?? null,
  zIndex,
  bind: null
});

export const importSvgText = (svgText: string): SvgImportResult => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  const warnings: string[] = [];
  if (!svg) {
    return {
      width: 800,
      height: 600,
      nodes: [],
      warnings: ['No svg root found.']
    };
  }

  let width = parseNumber(svg.getAttribute('width'), 800);
  let height = parseNumber(svg.getAttribute('height'), 600);
  const viewBox = svg.getAttribute('viewBox');
  let viewBoxOffset = { x: 0, y: 0 };
  if ((!width || !height) && viewBox) {
    const parts = viewBox.split(/\s+/).map((part) => Number.parseFloat(part));
    if (parts.length === 4) {
      width = width || parts[2];
      height = height || parts[3];
    }
  }
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map((part) => Number.parseFloat(part));
    if (parts.length === 4) {
      viewBoxOffset = { x: -parts[0], y: -parts[1] };
    }
  }

  const nodes: Node[] = [];
  let zIndex = 0;

  const unsupportedSelectors = [
    'linearGradient',
    'radialGradient',
    'clipPath',
    'mask',
    'filter',
    'pattern',
    'symbol',
    'use'
  ];
  unsupportedSelectors.forEach((selector) => {
    if (svg.querySelector(selector)) {
      warnings.push(`Unsupported SVG feature: ${selector}`);
    }
  });

  const walk = (element: Element, inherited: {
    fill: string | null;
    stroke: string | null;
    strokeWidth: number | null;
    opacity: number;
    transform: DOMMatrix;
  }) => {
    const tag = element.tagName.toLowerCase();
    const id = element.getAttribute('id') ?? createId();
    const name = element.getAttribute('id') ?? `${tag}-${id.slice(0, 4)}`;
    const styleMap = parseStyleAttr(element.getAttribute('style'));
    const localTransform = parseTransform(element.getAttribute('transform'));
    const combinedTransform = combineMatrix(inherited.transform, localTransform);
    const transform = decomposeMatrix(combinedTransform);
    const opacity = parseNumber(
      element.getAttribute('opacity') ?? styleMap.opacity ?? null,
      inherited.opacity
    );
    const fill = parseFill(element.getAttribute('fill') ?? styleMap.fill ?? null) ?? inherited.fill;
    const stroke = parseStroke(element.getAttribute('stroke') ?? styleMap.stroke ?? null) ?? inherited.stroke;
    const strokeWidth = element.getAttribute('stroke-width') || styleMap['stroke-width']
      ? parseNumber(element.getAttribute('stroke-width') ?? styleMap['stroke-width'], 1)
      : inherited.strokeWidth;

    if (fill && fill.startsWith('url(')) {
      warnings.push('Unsupported SVG paint server (fill)');
    }
    if (stroke && stroke.startsWith('url(')) {
      warnings.push('Unsupported SVG paint server (stroke)');
    }

    if (tag === 'rect') {
      const x = parseNumber(element.getAttribute('x')) + transform.x;
      const y = parseNumber(element.getAttribute('y')) + transform.y;
      const width = parseNumber(element.getAttribute('width'), 10);
      const height = parseNumber(element.getAttribute('height'), 10);
      const radius = parseNumber(element.getAttribute('rx')) || parseNumber(element.getAttribute('ry')) || null;
      const base = buildBase(
        {
          id,
          name,
          type: 'rect',
          x,
          y,
          width,
          height,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth,
          cornerRadius: radius
        },
        zIndex++
      );
      nodes.push(base as ShapeNode);
      return;
    }

    if (tag === 'circle' || tag === 'ellipse') {
      const cx = parseNumber(element.getAttribute('cx')) + transform.x;
      const cy = parseNumber(element.getAttribute('cy')) + transform.y;
      const rx = parseNumber(element.getAttribute(tag === 'circle' ? 'r' : 'rx'), 10);
      const ry = parseNumber(element.getAttribute(tag === 'circle' ? 'r' : 'ry'), 10);
      const base = buildBase(
        {
          id,
          name,
          type: 'ellipse',
          x: cx - rx,
          y: cy - ry,
          width: rx * 2,
          height: ry * 2,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth
        },
        zIndex++
      );
      nodes.push(base as ShapeNode);
      return;
    }

    if (tag === 'line' || tag === 'polyline' || tag === 'polygon') {
      let pointValues: number[] = [];
      if (tag === 'line') {
        const x1 = parseNumber(element.getAttribute('x1'));
        const y1 = parseNumber(element.getAttribute('y1'));
        const x2 = parseNumber(element.getAttribute('x2'));
        const y2 = parseNumber(element.getAttribute('y2'));
        pointValues = [x1, y1, x2, y2];
      } else {
        const pointsAttr = element.getAttribute('points') ?? '';
        pointValues = pointsAttr
          .split(/[,\s]+/)
          .map((part) => Number.parseFloat(part))
          .filter((part) => !Number.isNaN(part));
      }
      if (pointValues.length < 4) return;
      const base = buildBase(
        {
          id,
          name,
          type: 'line',
          x: transform.x,
          y: transform.y,
          width: 0,
          height: 0,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth
        },
        zIndex++
      );
      nodes.push({ ...(base as LineNode), points: pointValues });
      return;
    }

    if (tag === 'path') {
      const pathData = element.getAttribute('d') ?? '';
      if (!pathData) return;
      const pathPoints = parsePathPoints(pathData);
      const base = buildBase(
        {
          id,
          name,
          type: 'path',
          x: transform.x,
          y: transform.y,
          width: 0,
          height: 0,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth
        },
        zIndex++
      );
      nodes.push({ ...(base as PathNode), pathData, pathPoints });
      return;
    }

    if (tag === 'text') {
      const x = parseNumber(element.getAttribute('x')) + transform.x;
      const y = parseNumber(element.getAttribute('y')) + transform.y;
      const text = element.textContent ?? '';
      const fontSize = parseNumber(element.getAttribute('font-size'), 16);
      const fontFamily = element.getAttribute('font-family') ?? 'Arial';
      const fontWeight = element.getAttribute('font-weight');
      const base = buildBase(
        {
          id,
          name,
          type: 'text',
          x,
          y,
          width: 200,
          height: fontSize * 1.2,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth
        },
        zIndex++
      );
      nodes.push({
        ...(base as TextNode),
        text,
        fontSize,
        fontFamily,
        fontWeight: fontWeight ?? null
      });
      return;
    }

    if (tag === 'image') {
      const href =
        element.getAttribute('href') ?? element.getAttribute('xlink:href') ?? '';
      const x = parseNumber(element.getAttribute('x')) + transform.x;
      const y = parseNumber(element.getAttribute('y')) + transform.y;
      const width = parseNumber(element.getAttribute('width'), 100);
      const height = parseNumber(element.getAttribute('height'), 100);
      const base = buildBase(
        {
          id,
          name,
          type: 'image',
          x,
          y,
          width,
          height,
          rotation: transform.rotation,
          scaleX: transform.scaleX,
          scaleY: transform.scaleY,
          opacity,
          fill,
          stroke,
          strokeWidth
        },
        zIndex++
      );
      nodes.push({ ...(base as ImageNode), src: href });
      return;
    }

    if (tag === 'g') {
      Array.from(element.children).forEach((child) => {
        walk(child, {
          fill,
          stroke,
          strokeWidth,
          opacity,
          transform: combinedTransform
        });
      });
      return;
    }

    warnings.push(`Unsupported SVG element: ${tag}`);
  };

  const rootTransform = new DOMMatrix().translate(viewBoxOffset.x, viewBoxOffset.y);
  Array.from(svg.children).forEach((child) =>
    walk(child, {
      fill: null,
      stroke: null,
      strokeWidth: null,
      opacity: 1,
      transform: rootTransform
    })
  );

  return { width, height, nodes, warnings };
};

export const importImageFile = (file: File) =>
  new Promise<ImageNode>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        resolve({
          id: createId(),
          name: file.name,
          type: 'image',
          parentId: null,
          locked: false,
          x: 40,
          y: 40,
          width: img.width,
          height: img.height,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          fill: null,
          stroke: null,
          strokeWidth: null,
          cornerRadius: null,
          zIndex: 0,
          bind: null,
          src: String(reader.result)
        });
      };
      img.onerror = () => reject(new Error('Unable to load image.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
