import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Path, Text, Image as KonvaImage, Transformer, Group, Label, Tag, Circle } from 'react-konva';
import Konva from 'konva';
import type { Frame, Node, PathPoint } from '@dream-motion/shared';
import handIcon from '../assets/Hand.svg';
import penCursor from '../assets/Cursor-Pen.svg';
import pencilCursor from '../assets/Cursor-Pencil.svg';
import { createWebGLRenderer } from '../lib/webglRenderer';
import { renderToCanvas } from '@dream-motion/runtime';
import { createId } from '../lib/ids';
import { getBaseNameForNode, getNextNameForBase, getNextNameForTool } from '../lib/naming';

const useImage = (src: string | null) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
  }, [src]);
  return image;
};

type ImageShapeProps = {
  node: Node;
  common: Record<string, unknown>;
  bindRef: (instance: Konva.Node | null) => void;
};

const ImageShape: React.FC<ImageShapeProps> = ({ node, common, bindRef }) => {
  const image = useImage('src' in node ? node.src : null);
  return <KonvaImage {...common} image={image ?? undefined} ref={bindRef} />;
};

type PenPoint = {
  x: number;
  y: number;
  out?: { x: number; y: number };
};

type CanvasStageProps = {
  frame: Frame;
  frames: Frame[];
  activeFrameId: string;
  nodes: Node[];
  selectedNodeIds: string[];
  frameSelected: boolean;
  symbols: { id: string; name: string; nodes: Node[] }[];
  onUpdateFramePosition: (id: string, x: number, y: number) => void;
  onDuplicateFrameAtPosition: (id: string, x: number, y: number) => string | null;
  onDeselectFrame: () => void;
  webglEnabled: boolean;
  webglFrame: Frame;
  webglNodes: Node[];
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
  onAddNodes: (nodes: Node[]) => void;
  onToolComplete: () => void;
  onDropFiles: (files: FileList, point: { x: number; y: number } | null) => void;
  onRequestImagePlace: (point: { x: number; y: number }) => void;
  onSelectFrame: (id: string) => void;
  onOpenContextMenu: (event: { x: number; y: number; targetId: string | null; targetType: 'node' | 'frame' }) => void;
  playMode: boolean;
  activeTool: 'select' | 'frame' | 'rect' | 'ellipse' | 'line' | 'text' | 'pen' | 'pencil' | 'image' | 'connector';
  emptyHint: boolean;
  playHint: boolean;
  playFrameId: string;
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  lockAspect: boolean;
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  frame,
  frames,
  activeFrameId,
  nodes,
  selectedNodeIds,
  frameSelected,
  symbols,
  onUpdateFramePosition,
  onDuplicateFrameAtPosition,
  onDeselectFrame,
  webglEnabled,
  webglFrame,
  webglNodes,
  onSelectNode,
  onUpdateNode,
  onAddNodes,
  onToolComplete,
  onDropFiles,
  onRequestImagePlace,
  onSelectFrame,
  onOpenContextMenu,
  playMode,
  activeTool,
  emptyHint,
  playHint,
  playFrameId,
  stageRef,
  lockAspect
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const [dismissEmptyHint, setDismissEmptyHint] = useState(() => {
    try {
      return window.localStorage.getItem('dm_empty_hint_dismissed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!emptyHint || dismissEmptyHint) return;
    try {
      window.localStorage.setItem('dm_empty_hint_dismissed', '1');
    } catch {
      // ignore storage failures
    }
  }, [dismissEmptyHint, emptyHint]);
  const [stageTransform, setStageTransform] = useState({ scale: 1, x: 0, y: 0 });
  const playTransformRef = useRef<{ scale: number; x: number; y: number } | null>(null);
  const rulerSize = playMode ? 0 : 22;
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<ReturnType<typeof createWebGLRenderer> | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    type: 'rect' | 'ellipse' | 'line';
  } | null>(null);
  const frameDragRef = useRef<{
    active: boolean;
    startPointer: { x: number; y: number };
    startFrame: { x: number; y: number };
    frameId: string;
    sourceFrameId: string;
    axisLock: 'x' | 'y' | null;
    duplicating: boolean;
    origin: 'label' | 'empty';
    moved: boolean;
  } | null>(null);
  const rotateDragRef = useRef<{
    nodeId: string;
    pivot: { x: number; y: number };
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const nodeDragRef = useRef<{
    active: boolean;
    nodeId: string;
    cloneId: string | null;
    startPointer: { x: number; y: number };
    startNode: { x: number; y: number };
    axisLock: 'x' | 'y' | null;
  } | null>(null);
  const [textEdit, setTextEdit] = useState<{ id: string; value: string } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const pencilRef = useRef<{ points: { x: number; y: number }[] } | null>(null);
  const [pencilPreview, setPencilPreview] = useState<number[] | null>(null);
  const penRef = useRef<{
    points: PenPoint[];
    draggingIndex: number | null;
    preview: { x: number; y: number } | null;
  } | null>(null);
  const [penPreview, setPenPreview] = useState<{ path: string; points: PenPoint[] } | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ nodeId: string; points: PathPoint[] } | null>(null);
  const [editMode, setEditMode] = useState<'explicit' | 'pen' | null>(null);
  const [hoverVertexIndex, setHoverVertexIndex] = useState<number | null>(null);
  const [hoverSegmentIndex, setHoverSegmentIndex] = useState<number | null>(null);
  const editDragRef = useRef<{ index: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stageSize = useMemo(() => {
    return {
      width: Math.max(0, size.width - rulerSize),
      height: Math.max(0, size.height - rulerSize)
    };
  }, [size.width, size.height]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (playMode) {
      if (!playTransformRef.current) {
        playTransformRef.current = { ...stageTransform };
      }
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      setStageTransform({ scale: 1, x: 0, y: 0 });
      return;
    }
    if (playTransformRef.current) {
      const restore = playTransformRef.current;
      stage.scale({ x: restore.scale, y: restore.scale });
      stage.position({ x: restore.x, y: restore.y });
      setStageTransform(restore);
      playTransformRef.current = null;
    }
  }, [playMode, stageRef, stageTransform]);

  const getArtboardOffset = (target: Frame) => {
    const frameOffsetX = playMode ? 0 : target.x ?? 0;
    const frameOffsetY = playMode ? 0 : target.y ?? 0;
    return {
      x: (stageSize.width - target.width) / 2 + frameOffsetX,
      y: (stageSize.height - target.height) / 2 + frameOffsetY
    };
  };

  const artboardOffset = useMemo(
    () => getArtboardOffset(frame),
    [stageSize, frame.width, frame.height, frame.x, frame.y]
  );

  const frameById = useMemo(
    () => new Map(frames.map((item) => [item.id, item])),
    [frames]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const target = event.target as HTMLElement | null;
        const isEditable =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (isEditable) return;
        if (playMode) return;
        event.preventDefault();
        setSpacePressed(true);
      }
      if (event.key === 'Shift') {
        setShiftPressed(true);
      }
      if (event.key === 'Alt') {
        setAltPressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setSpacePressed(false);
        stageRef.current?.draggable(false);
        setIsPanning(false);
      }
      if (event.key === 'Shift') {
        setShiftPressed(false);
      }
      if (event.key === 'Alt') {
        setAltPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [stageRef, playMode]);


  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
  }, [stageRef]);

  useEffect(() => {
    const wrap = containerRef.current;
    if (!wrap) return;
    // Cursor hotspots: pen/pencil tips and create-tool crosshair use explicit hotspots for precision.
    const penCursorStyle = `url(${penCursor}) 12 22, crosshair`;
    const pencilCursorStyle = `url(${pencilCursor}) 12 22, crosshair`;
    if (playMode) {
      wrap.style.cursor = '';
      return;
    }
    if (activeTool === 'pen') {
      wrap.style.cursor = penCursorStyle;
      return;
    }
    if (activeTool === 'pencil') {
      wrap.style.cursor = pencilCursorStyle;
      return;
    }
    if (
      activeTool === 'frame' ||
      activeTool === 'rect' ||
      activeTool === 'ellipse' ||
      activeTool === 'line' ||
      activeTool === 'text' ||
      activeTool === 'image'
    ) {
      wrap.style.cursor = 'crosshair';
      return;
    }
    if (hoverVertexIndex != null) {
      wrap.style.cursor = 'pointer';
      return;
    }
    if (hoverSegmentIndex != null) {
      wrap.style.cursor = 'crosshair';
      return;
    }
    if (hoverNodeId && activeTool === 'select' && !playMode && !editState) {
      wrap.style.cursor = 'move';
      return;
    }
    wrap.style.cursor = '';
  }, [hoverVertexIndex, hoverSegmentIndex, hoverNodeId, activeTool, playMode, editState]);


  useEffect(() => {
    if (!webglEnabled) return;
    if (!webglCanvasRef.current) return;
    if (!webglRendererRef.current) {
      webglRendererRef.current = createWebGLRenderer({ canvas: webglCanvasRef.current });
    }
  }, [webglEnabled]);

  useEffect(() => {
    if (!webglEnabled) return;
    const renderer = webglRendererRef.current;
    const canvas = webglCanvasRef.current;
    if (!renderer || !canvas) return;
    canvas.width = webglFrame.width;
    canvas.height = webglFrame.height;
    renderer.draw({
      nodes: webglNodes,
      background: webglFrame.background,
      width: webglFrame.width,
      height: webglFrame.height
    });
  }, [webglEnabled, webglNodes, webglFrame]);

  useEffect(() => {
    if (!playMode) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    renderToCanvas({
      canvas,
      nodes,
      background: frame.background ?? null
    });
  }, [playMode, nodes, frame.width, frame.height, frame.background]);

  const nodeById = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeIds.length) return null;
    return nodeById.get(selectedNodeIds[0]) ?? null;
  }, [selectedNodeIds, nodeById]);

  useEffect(() => {
    if (playMode) return;
    if (activeTool === 'pen' && selectedNode?.type === 'path') {
      if (editMode !== 'explicit') {
        const points = getEditablePoints(selectedNode);
        if (points) {
          setEditState({ nodeId: selectedNode.id, points });
          setEditMode('pen');
        }
      }
      return;
    }
    if (editMode === 'pen') {
      exitEditMode();
    }
  }, [activeTool, selectedNode?.id, selectedNode?.type, editMode, playMode]);

  useEffect(() => {
    if (!editState) return;
    if (editMode !== 'explicit') return;
    if (selectedNodeIds.length && selectedNodeIds[0] !== editState.nodeId) {
      exitEditMode();
    }
  }, [editMode, editState, selectedNodeIds]);

  useEffect(() => {
    if (editMode === 'explicit' && activeTool !== 'select') {
      exitEditMode();
    }
  }, [activeTool, editMode]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectedNodes = selectedNodeIds
      .filter((id) => {
        const node = nodeById.get(id);
        return node ? !node.locked : false;
      })
      .map((id) => nodeRefs.current.get(id))
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedNodeIds, nodeById, nodes]);

  useEffect(() => {
    const canvas = horizontalRulerRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = stageSize.width * dpr;
    canvas.height = rulerSize * dpr;
    canvas.style.width = `${stageSize.width}px`;
    canvas.style.height = `${rulerSize}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [stageSize.width, rulerSize]);

  useEffect(() => {
    const canvas = verticalRulerRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rulerSize * dpr;
    canvas.height = stageSize.height * dpr;
    canvas.style.width = `${rulerSize}px`;
    canvas.style.height = `${stageSize.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [stageSize.height, rulerSize]);

  const getStep = (scale: number) => {
    if (scale > 4) return 10;
    if (scale > 2) return 25;
    if (scale < 0.25) return 200;
    if (scale < 0.5) return 100;
    return 50;
  };

  useEffect(() => {
    const hCanvas = horizontalRulerRef.current;
    const vCanvas = verticalRulerRef.current;
    if (!hCanvas || !vCanvas) return;
    const hCtx = hCanvas.getContext('2d');
    const vCtx = vCanvas.getContext('2d');
    if (!hCtx || !vCtx) return;

    const { scale, x, y } = stageTransform;
    const step = getStep(scale);
    const startX = -x / scale;
    const endX = startX + stageSize.width / scale;
    const startY = -y / scale;
    const endY = startY + stageSize.height / scale;

    hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height);
    vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);

    hCtx.fillStyle = '#f3f4f6';
    hCtx.fillRect(0, 0, hCanvas.width, hCanvas.height);
    vCtx.fillStyle = '#f3f4f6';
    vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);

    hCtx.strokeStyle = '#d1d5db';
    vCtx.strokeStyle = '#d1d5db';
    hCtx.fillStyle = '#6b7280';
    vCtx.fillStyle = '#6b7280';
    hCtx.font = '10px "Space Grotesk", sans-serif';
    vCtx.font = '10px "Space Grotesk", sans-serif';

    const firstX = Math.floor(startX / step) * step;
    const minLabelPx = 60;
    let lastLabelX = -Infinity;
    for (let value = firstX; value <= endX; value += step) {
      const px = value * scale + x;
      hCtx.beginPath();
      hCtx.moveTo(px, rulerSize);
      hCtx.lineTo(px, rulerSize - 6);
      hCtx.stroke();
      if (px - lastLabelX >= minLabelPx) {
        hCtx.fillText(String(Math.round(value)), px + 2, 11);
        lastLabelX = px;
      }
    }

    const firstY = Math.floor(startY / step) * step;
    let lastLabelY = -Infinity;
    for (let value = firstY; value <= endY; value += step) {
      const py = value * scale + y;
      vCtx.beginPath();
      vCtx.moveTo(rulerSize, py);
      vCtx.lineTo(rulerSize - 6, py);
      vCtx.stroke();
      if (py - lastLabelY >= minLabelPx) {
        vCtx.save();
        vCtx.translate(8, py + 4);
        vCtx.rotate(-Math.PI / 2);
        vCtx.fillText(String(Math.round(value)), 0, 0);
        vCtx.restore();
        lastLabelY = py;
      }
    }
  }, [stageTransform, stageSize]);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    if (playMode) return;
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    if (!event.evt.ctrlKey) {
      const nextX = stage.x() - event.evt.deltaX;
      const nextY = stage.y() - event.evt.deltaY;
      stage.position({ x: nextX, y: nextY });
      setStageTransform({ scale: stage.scaleX(), x: nextX, y: nextY });
      return;
    }
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    stage.scale({ x: newScale, y: newScale });
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };
    stage.position(newPos);
    setStageTransform({ scale: newScale, x: newPos.x, y: newPos.y });
  };

  const getFramePoint = () => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    const scale = stage.scaleX() || 1;
    const stageX = (pointer.x - stage.x()) / scale;
    const stageY = (pointer.y - stage.y()) / scale;
    return {
      x: stageX - artboardOffset.x,
      y: stageY - artboardOffset.y
    };
  };

  const getEditorRect = (node: Node) => {
    const stage = stageRef.current;
    const wrap = containerRef.current;
    if (!stage || !wrap) return null;
    const scale = stage.scaleX() || 1;
    const stageRect = stage.container().getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const left =
      stageRect.left -
      wrapRect.left +
      stage.x() +
      (node.x + artboardOffset.x) * scale;
    const top =
      stageRect.top -
      wrapRect.top +
      stage.y() +
      (node.y + artboardOffset.y) * scale;
    const width = Math.max(80, node.width * scale);
    const height = Math.max(24, node.height * scale);
    return { left, top, width, height, scale };
  };

  const startTextEdit = (node: Node) => {
    if (node.type !== 'text') return;
    setTextEdit({ id: node.id, value: node.text ?? '' });
    window.setTimeout(() => {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }, 0);
  };

  const finishTextEdit = (commit: boolean) => {
    if (!textEdit) return;
    const value = textEdit.value;
    if (commit) {
      onUpdateNode(textEdit.id, { text: value });
    }
    setTextEdit(null);
  };

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const getPivot = (target: Node) => {
    const pivotX = target.pivotX ?? target.width / 2;
    const pivotY = target.pivotY ?? target.height / 2;
    return { x: pivotX, y: pivotY };
  };

  const distanceToSegment = (point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return distance(point, a);
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const closest = { x: a.x + clamped * dx, y: a.y + clamped * dy };
    return distance(point, closest);
  };

  const buildPencilPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    const localPoints = points.map((point) => ({
      x: point.x - minX,
      y: point.y - minY
    }));
    const path = localPoints
      .map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
      )
      .join(' ');
    return {
      path,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  };

  const buildPenPath = (
    points: PenPoint[],
    preview: { x: number; y: number } | null,
    offset: { x: number; y: number } = { x: 0, y: 0 }
  ) => {
    if (!points.length) return '';
    const list = preview ? [...points, { x: preview.x, y: preview.y }] : points;
    let d = `M ${list[0].x - offset.x} ${list[0].y - offset.y}`;
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const next = list[i];
      if (prev.out) {
        const c1x = prev.x + prev.out.x - offset.x;
        const c1y = prev.y + prev.out.y - offset.y;
        d += ` C ${c1x} ${c1y} ${next.x - offset.x} ${next.y - offset.y} ${next.x - offset.x} ${next.y - offset.y}`;
      } else {
        d += ` L ${next.x - offset.x} ${next.y - offset.y}`;
      }
    }
    return d;
  };

  const buildPathBounds = (points: PathPoint[]) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  };

  const buildPathDataFromPoints = (points: PathPoint[], offset: { x: number; y: number }) => {
    if (!points.length) return '';
    let d = `M ${points[0].x - offset.x} ${points[0].y - offset.y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const next = points[i];
      if (prev.out) {
        const c1x = prev.x + prev.out.x - offset.x;
        const c1y = prev.y + prev.out.y - offset.y;
        d += ` C ${c1x} ${c1y} ${next.x - offset.x} ${next.y - offset.y} ${next.x - offset.x} ${next.y - offset.y}`;
      } else {
        d += ` L ${next.x - offset.x} ${next.y - offset.y}`;
      }
    }
    return d;
  };

  const parsePathDataToPoints = (pathData: string, offset: { x: number; y: number }) => {
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
          points.push({ x: cx + offset.x, y: cy + offset.y });
        }
      } else if (command === 'L' || command === 'l') {
        for (let i = 0; i < values.length; i += 2) {
          cx = values[i] + (isRelative ? cx : 0);
          cy = values[i + 1] + (isRelative ? cy : 0);
          points.push({ x: cx + offset.x, y: cy + offset.y });
        }
      } else if (command === 'C' || command === 'c') {
        for (let i = 0; i < values.length; i += 6) {
          const c1x = values[i] + (isRelative ? cx : 0);
          const c1y = values[i + 1] + (isRelative ? cy : 0);
          const x = values[i + 4] + (isRelative ? cx : 0);
          const y = values[i + 5] + (isRelative ? cy : 0);
          if (points.length) {
            const prev = points[points.length - 1];
            prev.out = { x: c1x + offset.x - prev.x, y: c1y + offset.y - prev.y };
          }
          cx = x;
          cy = y;
          points.push({ x: cx + offset.x, y: cy + offset.y });
        }
      } else if (command === 'Z' || command === 'z') {
        cx = sx;
        cy = sy;
      }
    });
    return points;
  };

  const getEditablePoints = (target: Node): PathPoint[] | null => {
    if (target.type === 'path') {
      if ('pathPoints' in target && target.pathPoints?.length) {
        return target.pathPoints.map((point) => ({
          ...point,
          x: point.x + target.x,
          y: point.y + target.y
        }));
      }
      const points = parsePathDataToPoints(target.pathData ?? '', { x: target.x, y: target.y });
      return points.length ? points : null;
    }
    if (target.type === 'rect' || target.type === 'ellipse') {
      return [
        { x: target.x, y: target.y },
        { x: target.x + target.width, y: target.y },
        { x: target.x + target.width, y: target.y + target.height },
        { x: target.x, y: target.y + target.height }
      ];
    }
    if (target.type === 'line' && 'points' in target) {
      const points: PathPoint[] = [];
      for (let i = 0; i < target.points.length; i += 2) {
        points.push({ x: target.x + target.points[i], y: target.y + target.points[i + 1] });
      }
      return points;
    }
    if (target.type === 'mesh' && 'vertices' in target) {
      const points: PathPoint[] = [];
      for (let i = 0; i < target.vertices.length; i += 2) {
        points.push({ x: target.x + target.vertices[i], y: target.y + target.vertices[i + 1] });
      }
      return points;
    }
    return null;
  };

  const applyEditPoints = (target: Node, points: PathPoint[]) => {
    if (target.type === 'rect' || target.type === 'ellipse') {
      const bounds = buildPathBounds(points);
      return {
        patch: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        },
        points: [
          { x: bounds.x, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y },
          { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          { x: bounds.x, y: bounds.y + bounds.height }
        ]
      };
    }
    if (target.type === 'line' && 'points' in target) {
      const bounds = buildPathBounds(points);
      const nextPoints = points.map((point) => ({ x: point.x - bounds.x, y: point.y - bounds.y }));
      return {
        patch: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          points: nextPoints.flatMap((point) => [point.x, point.y])
        },
        points
      };
    }
    if (target.type === 'path') {
      const bounds = buildPathBounds(points);
      const pathData = buildPathDataFromPoints(points, { x: bounds.x, y: bounds.y });
      return {
        patch: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          pathData,
          pathPoints: points.map((point) => ({
            ...point,
            x: point.x - bounds.x,
            y: point.y - bounds.y
          }))
        },
        points
      };
    }
    if (target.type === 'mesh') {
      const bounds = buildPathBounds(points);
      return {
        patch: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          vertices: points.flatMap((point) => [point.x - bounds.x, point.y - bounds.y])
        },
        points
      };
    }
    return { patch: {}, points };
  };

  const enterEditMode = (target: Node) => {
    const points = getEditablePoints(target);
    if (!points) return;
    setEditState({ nodeId: target.id, points });
    setEditMode('explicit');
    setHoverVertexIndex(null);
    setHoverSegmentIndex(null);
  };

  const exitEditMode = () => {
    setEditState(null);
    setEditMode(null);
    setHoverVertexIndex(null);
    setHoverSegmentIndex(null);
  };

  const finalizePenPath = () => {
    const current = penRef.current;
    if (!current) return;
    if (current.points.length < 2) {
      penRef.current = null;
      setPenPreview(null);
      return;
    }
    const bounds = buildPencilPath(current.points);
    if (!bounds) return;
    const path = buildPenPath(current.points, null, { x: bounds.x, y: bounds.y });
    const name = getNextNameForTool(frames, 'pen');
    const node: Node = {
      id: createId(),
      name,
      type: 'path',
      parentId: null,
      locked: false,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      visible: true,
      fill: null,
      stroke: '#111111',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      cornerRadius: null,
      zIndex: nodes.length,
      bind: null,
      pathData: path,
      pathPoints: current.points.map((point) => ({
        x: point.x - bounds.x,
        y: point.y - bounds.y,
        out: point.out ? { ...point.out } : undefined
      }))
    };
    onAddNodes([node]);
    onSelectNode(node.id);
    penRef.current = null;
    setPenPreview(null);
    onToolComplete();
  };

  useEffect(() => {
    if (activeTool !== 'pencil') {
      pencilRef.current = null;
      setPencilPreview(null);
    }
    if (activeTool !== 'pen') {
      penRef.current = null;
      setPenPreview(null);
    }
    if (activeTool !== 'text' && textEdit) {
      finishTextEdit(true);
    }
  }, [activeTool, textEdit]);

  useEffect(() => {
    const handlePenKeys = (event: KeyboardEvent) => {
      if (playMode) return;
      if (activeTool !== 'pen') return;
      if (!penRef.current) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        finalizePenPath();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        penRef.current = null;
        setPenPreview(null);
      }
    };
    window.addEventListener('keydown', handlePenKeys);
    return () => window.removeEventListener('keydown', handlePenKeys);
  }, [activeTool, playMode, finalizePenPath]);

  useEffect(() => {
    const handleEditKeys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!editState) return;
      event.preventDefault();
      exitEditMode();
    };
    window.addEventListener('keydown', handleEditKeys);
    return () => window.removeEventListener('keydown', handleEditKeys);
  }, [editState]);

  const getFrameIdFromTarget = (event: Konva.KonvaEventObject<MouseEvent>) => {
    let current: Konva.Node | null = event.target;
    while (current) {
      if (current.hasName?.('frame-label')) {
        const frameId = current.getAttr?.('frameId');
        if (frameId) return frameId as string;
      }
      current = current.getParent?.() ?? null;
    }
    return null;
  };

  const isFrameBackgroundTarget = (event: Konva.KonvaEventObject<MouseEvent>) =>
    Boolean(event.target?.hasName?.('frame-bg'));

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (playMode) return;
    if (event.evt.button !== 0) return;
    if (textEdit) {
      finishTextEdit(true);
    }
    if (spacePressed) {
      setIsPanning(true);
      stageRef.current?.draggable(true);
      const stage = stageRef.current;
      if (stage) {
        setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
      }
      return;
    }
    if (activeTool === 'image') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      onRequestImagePlace(point);
      return;
    }
    if (editState && (activeTool === 'select' || activeTool === 'pen')) {
      const point = getFramePoint();
      if (point) {
        const hitRadius = 10 / (stageRef.current?.scaleX() || 1);
        if (hoverSegmentIndex != null && hoverSegmentIndex >= 0) {
          const nextPoints = [...editState.points];
          nextPoints.splice(hoverSegmentIndex + 1, 0, { x: point.x, y: point.y });
          const targetNode = nodeById.get(editState.nodeId);
          if (targetNode) {
            const update = applyEditPoints(targetNode, nextPoints);
            onUpdateNode(targetNode.id, update.patch);
            setEditState({ nodeId: targetNode.id, points: update.points });
            setHoverSegmentIndex(null);
            setHoverVertexIndex(hoverSegmentIndex + 1);
          }
          return;
        }
        const hitIndex = editState.points.findIndex((pt) => distance(pt, point) <= hitRadius);
        if (hitIndex !== -1) {
          setHoverVertexIndex(hitIndex);
          return;
        }
      }
      if (activeTool === 'select') {
        const onFrameBackground = isFrameBackgroundTarget(event);
        const clickedOnEmpty = event.target === event.target.getStage();
        if (clickedOnEmpty || onFrameBackground) {
          exitEditMode();
        }
      }
    }
    if (activeTool === 'text') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      const id = createId();
      const name = getNextNameForTool(frames, 'text');
      const node: Node = {
        id,
        name,
        type: 'text',
        parentId: null,
        locked: false,
        x: point.x,
        y: point.y,
        width: 120,
        height: 28,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        visible: true,
        fill: '#111111',
        stroke: null,
        strokeWidth: null,
        cornerRadius: null,
        zIndex: nodes.length,
        bind: null,
        text: 'Text',
        fontSize: 24,
        fontFamily: 'Inter',
        fontWeight: 400,
        textAlign: 'left',
        lineHeight: 1.2,
        letterSpacing: 0
      };
      onAddNodes([node]);
      onSelectNode(id);
      startTextEdit(node);
      onToolComplete();
      return;
    }
    if (activeTool === 'pencil') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      pencilRef.current = { points: [point] };
      setPencilPreview([point.x, point.y]);
      return;
    }
    if (activeTool === 'pen') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      const current = penRef.current;
      if (!current) {
        penRef.current = { points: [{ x: point.x, y: point.y }], draggingIndex: 0, preview: null };
        setPenPreview({ path: `M ${point.x} ${point.y}`, points: [{ x: point.x, y: point.y }] });
        return;
      }
      const firstPoint = current.points[0];
      if (current.points.length > 1 && distance(firstPoint, point) < 8) {
        finalizePenPath();
        return;
      }
      current.points = [...current.points, { x: point.x, y: point.y }];
      current.draggingIndex = current.points.length - 1;
      current.preview = null;
      setPenPreview({ path: buildPenPath(current.points, null), points: current.points });
      return;
    }
    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'line') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      const id = createId();
      const name = getNextNameForTool(frames, activeTool);
      const base = {
        id,
        parentId: null,
        locked: false,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        visible: true,
        fill: '#d0d0d0',
        stroke: '#111111',
        strokeWidth: 1,
        cornerRadius: 0,
        zIndex: 0,
        bind: null
      };
      const node: Node =
        activeTool === 'line'
          ? {
              ...base,
              name,
              type: 'path',
              fill: null,
              strokeWidth: 2,
              lineCap: 'round',
              lineJoin: 'round',
              pathData: 'M 0 0 L 1 1'
            }
          : {
              ...base,
              name,
              type: activeTool === 'rect' ? 'rect' : 'ellipse'
            };
      onAddNodes([node]);
      onSelectNode(id);
      drawRef.current = {
        id,
        startX: point.x,
        startY: point.y,
        type: activeTool
      };
      return;
    }
    if (activeTool !== 'select' && activeTool !== 'frame' && activeTool !== 'connector') return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const clickedOnEmpty = event.target === event.target.getStage();
    const onFrameLabel = Boolean(event.target?.hasName?.('frame-label'));
    const onFrameBackground = isFrameBackgroundTarget(event);
    if (pointer && onFrameLabel) {
      const targetFrameId = getFrameIdFromTarget(event) ?? activeFrameId;
      onSelectFrame(targetFrameId);
      let dragFrameId = targetFrameId;
      const startFrame = frameById.get(targetFrameId);
      if (altPressed && startFrame) {
        const cloneId = onDuplicateFrameAtPosition(targetFrameId, startFrame.x ?? 0, startFrame.y ?? 0);
        if (cloneId) {
          dragFrameId = cloneId;
        }
      }
      frameDragRef.current = {
        active: true,
        startPointer: pointer,
        frameId: dragFrameId,
        sourceFrameId: targetFrameId,
        startFrame: { x: startFrame?.x ?? 0, y: startFrame?.y ?? 0 },
        axisLock: null,
        duplicating: altPressed,
        origin: onFrameLabel ? 'label' : 'empty',
        moved: false
      };
      return;
    }
    if (clickedOnEmpty || onFrameBackground) {
      onSelectNode(null);
      onDeselectFrame();
    }
  };

  const handleStageMouseUp = () => {
    if (playMode) return;
    rotateDragRef.current = null;
    setIsPanning(false);
    stageRef.current?.draggable(false);
    const stage = stageRef.current;
    if (stage) {
      setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
    }
    if (drawRef.current) {
      drawRef.current = null;
      onToolComplete();
    }
    if (pencilRef.current) {
      const pencilPoints = pencilRef.current.points;
      const result = buildPencilPath(pencilPoints);
      if (result) {
        const name = getNextNameForTool(frames, 'pencil');
        const node: Node = {
          id: createId(),
          name,
          type: 'path',
          parentId: null,
          locked: false,
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          visible: true,
          fill: null,
          stroke: '#111111',
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'round',
          cornerRadius: null,
          zIndex: nodes.length,
          bind: null,
          pathData: result.path,
          pathPoints: pencilPoints.map((point) => ({
            x: point.x - result.x,
            y: point.y - result.y
          }))
        };
        onAddNodes([node]);
        onSelectNode(node.id);
      }
      pencilRef.current = null;
      setPencilPreview(null);
      onToolComplete();
    }
    if (penRef.current?.draggingIndex != null) {
      penRef.current.draggingIndex = null;
    }
    const dragState = frameDragRef.current;
    if (dragState?.active) {
      if (!dragState.moved && dragState.origin === 'empty') {
        onDeselectFrame();
      }
      frameDragRef.current = null;
    }
  };

  const handleStageMouseMove = () => {
    if (rotateDragRef.current) {
      const drag = rotateDragRef.current;
      const point = getFramePoint();
      if (!point) return;
      const angle = Math.atan2(point.y - drag.pivot.y, point.x - drag.pivot.x);
      const delta = ((angle - drag.startAngle) * 180) / Math.PI;
      onUpdateNode(drag.nodeId, { rotation: drag.startRotation + delta });
      return;
    }
    if (drawRef.current) {
      const point = getFramePoint();
      if (!point) return;
      const startX = drawRef.current.startX;
      const startY = drawRef.current.startY;
      if (drawRef.current.type === 'line') {
        const nextX = Math.min(startX, point.x);
        const nextY = Math.min(startY, point.y);
        const nextW = Math.max(1, Math.abs(point.x - startX));
        const nextH = Math.max(1, Math.abs(point.y - startY));
        const pathData = `M ${(startX - nextX).toFixed(1)} ${(startY - nextY).toFixed(
          1
        )} L ${(point.x - nextX).toFixed(1)} ${(point.y - nextY).toFixed(1)}`;
        onUpdateNode(drawRef.current.id, {
          x: nextX,
          y: nextY,
          width: nextW,
          height: nextH,
          pathData
        });
        return;
      }
      const nextX = Math.min(startX, point.x);
      const nextY = Math.min(startY, point.y);
      const nextW = Math.max(1, Math.abs(point.x - startX));
      const nextH = Math.max(1, Math.abs(point.y - startY));
      onUpdateNode(drawRef.current.id, {
        x: nextX,
        y: nextY,
        width: nextW,
        height: nextH
      });
      return;
    }
    if (pencilRef.current) {
      const point = getFramePoint();
      if (!point) return;
      const points = pencilRef.current.points;
      const last = points[points.length - 1];
      if (distance(last, point) >= 2) {
        pencilRef.current.points = [...points, point];
        setPencilPreview(pencilRef.current.points.flatMap((item) => [item.x, item.y]));
      }
      return;
    }
    if (penRef.current) {
      const point = getFramePoint();
      if (!point) return;
      const current = penRef.current;
      if (current.draggingIndex != null) {
        const idx = current.draggingIndex;
        const anchor = current.points[idx];
        anchor.out = { x: point.x - anchor.x, y: point.y - anchor.y };
        current.preview = null;
      } else {
        current.preview = point;
      }
      setPenPreview({ path: buildPenPath(current.points, current.preview), points: current.points });
      return;
    }
    if (editState && (activeTool === 'select' || activeTool === 'pen')) {
      const point = getFramePoint();
      if (!point) return;
      const hitRadius = 10 / (stageRef.current?.scaleX() || 1);
      let vertexIndex: number | null = null;
      editState.points.forEach((pt, index) => {
        if (distance(pt, point) <= hitRadius && vertexIndex == null) {
          vertexIndex = index;
        }
      });
      let segmentIndex: number | null = null;
      if (vertexIndex == null) {
        for (let i = 0; i < editState.points.length - 1; i += 1) {
          const a = editState.points[i];
          const b = editState.points[i + 1];
          if (distanceToSegment(point, a, b) <= hitRadius) {
            segmentIndex = i;
            break;
          }
        }
      }
      setHoverVertexIndex(vertexIndex);
      setHoverSegmentIndex(segmentIndex);
      return;
    }
    const dragState = frameDragRef.current;
    if (!dragState?.active) return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const scale = stage.scaleX() || 1;
    const dx = (pointer.x - dragState.startPointer.x) / scale;
    const dy = (pointer.y - dragState.startPointer.y) / scale;
    if (!dragState.moved && Math.hypot(dx, dy) > 2) {
      dragState.moved = true;
    }
    let nextX = dragState.startFrame.x + dx;
    let nextY = dragState.startFrame.y + dy;
    if (shiftPressed) {
      if (!dragState.axisLock) {
        dragState.axisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (dragState.axisLock === 'x') {
        nextY = dragState.startFrame.y;
      } else {
        nextX = dragState.startFrame.x;
      }
    } else {
      dragState.axisLock = null;
    }
    onUpdateFramePosition(dragState.frameId, nextX, nextY);
  };

  const updateFromShape = (id: string, shape: Konva.Node) => {
    const scaleX = shape.scaleX();
    const scaleY = shape.scaleY();
    const newWidth = Math.max(1, shape.width() * scaleX);
    const newHeight = Math.max(1, shape.height() * scaleY);
    shape.scale({ x: 1, y: 1 });
    const pivot = target ? getPivot(target) : { x: 0, y: 0 };
    let nextX = shape.x() - artboardOffset.x - pivot.x;
    let nextY = shape.y() - artboardOffset.y - pivot.y;
    if (target?.type === 'ellipse') {
      nextX -= newWidth / 2;
      nextY -= newHeight / 2;
    }
    const target = nodeById.get(id);
    if (target?.type === 'path' && target.pathPoints?.length) {
      const baseWidth = Math.max(1, target.width);
      const baseHeight = Math.max(1, target.height);
      const scaledPoints = target.pathPoints.map((point) => ({
        x: point.x * (newWidth / baseWidth),
        y: point.y * (newHeight / baseHeight),
        out: point.out
          ? {
              x: point.out.x * (newWidth / baseWidth),
              y: point.out.y * (newHeight / baseHeight)
            }
          : undefined
      }));
      const absolutePoints = scaledPoints.map((point) => ({
        ...point,
        x: point.x + nextX,
        y: point.y + nextY
      }));
      const pathData = buildPathDataFromPoints(absolutePoints, { x: nextX, y: nextY });
      onUpdateNode(id, {
        x: nextX,
        y: nextY,
        width: newWidth,
        height: newHeight,
        rotation: shape.rotation(),
        scaleX: 1,
        scaleY: 1,
        pathData,
        pathPoints: scaledPoints
      });
      return;
    }

    onUpdateNode(id, {
      x: nextX,
      y: nextY,
      width: newWidth,
      height: newHeight,
      rotation: shape.rotation(),
      scaleX: 1,
      scaleY: 1
    });
  };

  const handleSelect = (id: string) => {
    if (playMode || spacePressed) return;
    if (activeTool !== 'select' && activeTool !== 'connector') return;
    if (editState && editState.nodeId !== id) {
      exitEditMode();
    }
    onSelectNode(id);
  };

  const handleNodeDragStart = (event: Konva.KonvaEventObject<DragEvent>, node: Node) => {
    if (playMode || spacePressed) return;
    const point = getFramePoint();
    if (!point) return;
    const cloneId = altPressed ? createId() : null;
    if (cloneId) {
      const name = getNextNameForBase(frames, getBaseNameForNode(node));
      const clone: Node = {
        ...node,
        id: cloneId,
        name,
        locked: false
      };
      onAddNodes([clone]);
      onSelectNode(cloneId);
    }
    nodeDragRef.current = {
      active: true,
      nodeId: node.id,
      cloneId,
      startPointer: { x: point.x, y: point.y },
      startNode: { x: node.x, y: node.y },
      axisLock: null
    };
  };

  const handleNodeDragMove = (event: Konva.KonvaEventObject<DragEvent>, node: Node) => {
    const drag = nodeDragRef.current;
    if (!drag || !drag.active) return;
    const point = getFramePoint();
    if (!point) return;
    const pivot = getPivot(node);
    let dx = point.x - drag.startPointer.x;
    let dy = point.y - drag.startPointer.y;
    if (shiftPressed) {
      if (!drag.axisLock) {
        drag.axisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (drag.axisLock === 'x') {
        dy = 0;
      } else {
        dx = 0;
      }
    } else {
      drag.axisLock = null;
    }
    const nextX = drag.startNode.x + dx;
    const nextY = drag.startNode.y + dy;
    const targetId = drag.cloneId ?? drag.nodeId;
    if (drag.cloneId) {
      event.target.position({
        x: drag.startNode.x + artboardOffset.x + pivot.x,
        y: drag.startNode.y + artboardOffset.y + pivot.y
      });
      onUpdateNode(targetId, { x: nextX, y: nextY });
    } else {
      event.target.position({
        x: nextX + artboardOffset.x + pivot.x,
        y: nextY + artboardOffset.y + pivot.y
      });
    }
  };

  const handleNodeDragEnd = (event: Konva.KonvaEventObject<DragEvent>, node: Node) => {
    const drag = nodeDragRef.current;
    if (!drag) return;
    const targetId = drag.cloneId ?? drag.nodeId;
    const position = event.target.position();
    if (!drag.cloneId) {
      const pivot = getPivot(node);
      onUpdateNode(targetId, {
        x: position.x - artboardOffset.x - pivot.x,
        y: position.y - artboardOffset.y - pivot.y
      });
    }
    nodeDragRef.current = null;
  };

  const handleNodeDoubleClick = (target: Node) => {
    if (playMode) return;
    if (activeTool !== 'select') return;
    if (target.type === 'text') {
      startTextEdit(target);
      return;
    }
    const points = getEditablePoints(target);
    if (points) {
      enterEditMode(target);
    }
  };

  const renderNodeWithOffset = (
    node: Node,
    offset: { x: number; y: number },
    interactive: boolean,
    idPrefix: string | null
  ) => {
    const nodeId = idPrefix ? `${idPrefix}:${node.id}` : node.id;
    const isEditingNode = editState?.nodeId === node.id;
    const previewNode =
      isEditingNode && editState ? { ...node, ...applyEditPoints(node, editState.points).patch } : node;
    const hoverEnabled = interactive && !playMode && activeTool === 'select' && !editState;
    const strokeWidth = previewNode.strokeWidth ?? 0;
    const strokePosition = previewNode.strokePosition ?? 'center';
    let displayWidth = previewNode.width;
    let displayHeight = previewNode.height;
    let displayX = previewNode.x + offset.x;
    let displayY = previewNode.y + offset.y;
    if ((node.type === 'rect' || node.type === 'ellipse') && strokeWidth > 0) {
      const delta =
        strokePosition === 'inside'
          ? -strokeWidth
          : strokePosition === 'outside'
          ? strokeWidth
          : 0;
      displayWidth = Math.max(1, previewNode.width + delta);
      displayHeight = Math.max(1, previewNode.height + delta);
      displayX = previewNode.x + offset.x + (previewNode.width - displayWidth) / 2;
      displayY = previewNode.y + offset.y + (previewNode.height - displayHeight) / 2;
    }
    const cornerRadii =
      previewNode.cornerRadiusTL != null ||
      previewNode.cornerRadiusTR != null ||
      previewNode.cornerRadiusBR != null ||
      previewNode.cornerRadiusBL != null
        ? [
            previewNode.cornerRadiusTL ?? 0,
            previewNode.cornerRadiusTR ?? 0,
            previewNode.cornerRadiusBR ?? 0,
            previewNode.cornerRadiusBL ?? 0
          ]
        : previewNode.cornerRadius ?? 0;
    const pivot = getPivot(previewNode);
    const common = {
      id: nodeId,
      key: nodeId,
      x: displayX + pivot.x,
      y: displayY + pivot.y,
      width: displayWidth,
      height: displayHeight,
      rotation: previewNode.rotation,
      scaleX: previewNode.scaleX,
      scaleY: previewNode.scaleY,
      opacity: previewNode.opacity,
      visible: previewNode.visible,
      fillOpacity: previewNode.fillOpacity ?? 1,
      strokeOpacity: previewNode.strokeOpacity ?? 1,
      shadowColor: previewNode.shadowColor ?? undefined,
      shadowOpacity: previewNode.shadowOpacity ?? 0,
      shadowBlur: previewNode.shadowBlur ?? 0,
      shadowOffsetX: previewNode.shadowOffsetX ?? 0,
      shadowOffsetY: previewNode.shadowOffsetY ?? 0,
      filters: previewNode.blurRadius && previewNode.blurRadius > 0 ? [Konva.Filters.Blur] : undefined,
      blurRadius: previewNode.blurRadius ?? 0,
      offsetX: pivot.x,
      offsetY: pivot.y,
      draggable: interactive && !playMode && !node.locked && !isEditingNode,
      onClick: interactive ? () => handleSelect(node.id) : undefined,
      onTap: interactive ? () => handleSelect(node.id) : undefined,
      onDblClick: interactive ? () => handleNodeDoubleClick(node) : undefined,
      onMouseEnter: hoverEnabled ? () => setHoverNodeId(node.id) : undefined,
      onMouseLeave: hoverEnabled ? () => setHoverNodeId((prev) => (prev === node.id ? null : prev)) : undefined,
      onContextMenu: interactive
        ? (event: Konva.KonvaEventObject<PointerEvent>) => {
            event.evt.preventDefault();
            onOpenContextMenu({
              x: event.evt.clientX,
              y: event.evt.clientY,
              targetId: node.id,
              targetType: 'node'
            });
          }
        : undefined,
      onDragStart: interactive
        ? (event: Konva.KonvaEventObject<DragEvent>) => handleNodeDragStart(event, node)
        : undefined,
      onDragMove: interactive
        ? (event: Konva.KonvaEventObject<DragEvent>) => handleNodeDragMove(event, node)
        : undefined,
      onDragEnd: interactive
        ? (event: Konva.KonvaEventObject<DragEvent>) => handleNodeDragEnd(event, node)
        : undefined,
      onTransformEnd: interactive
        ? (event: Konva.KonvaEventObject<Event>) =>
            updateFromShape(node.id, event.target)
        : undefined
    };

    const bindRef = (instance: Konva.Node | null) => {
      if (instance && interactive && !idPrefix) {
        nodeRefs.current.set(node.id, instance);
      }
      if (instance) {
        if (node.blurRadius && node.blurRadius > 0) {
          instance.cache({ pixelRatio: 1 });
        } else {
          instance.clearCache();
        }
      }
    };

    const renderTarget = previewNode;
    switch (node.type) {
      case 'rect':
        return (
          <Rect
            {...common}
            cornerRadius={cornerRadii}
            fill={renderTarget.fill ?? undefined}
            stroke={renderTarget.stroke ?? undefined}
            strokeWidth={renderTarget.strokeWidth ?? undefined}
            ref={bindRef}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            {...common}
            x={displayX + displayWidth / 2 + pivot.x}
            y={displayY + displayHeight / 2 + pivot.y}
            radiusX={displayWidth / 2}
            radiusY={displayHeight / 2}
            fill={renderTarget.fill ?? undefined}
            stroke={renderTarget.stroke ?? undefined}
            strokeWidth={renderTarget.strokeWidth ?? undefined}
            ref={bindRef}
          />
        );
      case 'line':
        return (
          <Line
            {...common}
            points={'points' in renderTarget ? renderTarget.points : []}
            stroke={renderTarget.stroke ?? '#111'}
            strokeWidth={renderTarget.strokeWidth ?? 1}
            lineCap={renderTarget.lineCap ?? undefined}
            lineJoin={renderTarget.lineJoin ?? undefined}
            ref={bindRef}
          />
        );
      case 'path':
        return (
          <Path
            {...common}
            data={'pathData' in renderTarget ? renderTarget.pathData : ''}
            fill={renderTarget.fill ?? undefined}
            stroke={renderTarget.stroke ?? undefined}
            strokeWidth={renderTarget.strokeWidth ?? undefined}
            lineCap={renderTarget.lineCap ?? undefined}
            lineJoin={renderTarget.lineJoin ?? undefined}
            ref={bindRef}
          />
        );
      case 'text':
        return (
          <Text
            {...common}
            text={'text' in renderTarget ? renderTarget.text : ''}
            fontSize={'fontSize' in renderTarget ? renderTarget.fontSize : 16}
            fontFamily={'fontFamily' in renderTarget ? renderTarget.fontFamily : 'Arial'}
            fontStyle={'fontWeight' in renderTarget && renderTarget.fontWeight ? String(renderTarget.fontWeight) : 'normal'}
            align={'textAlign' in renderTarget && renderTarget.textAlign ? renderTarget.textAlign : 'left'}
            lineHeight={'lineHeight' in renderTarget && renderTarget.lineHeight ? renderTarget.lineHeight : 1.2}
            letterSpacing={'letterSpacing' in renderTarget && renderTarget.letterSpacing ? renderTarget.letterSpacing : 0}
            fill={renderTarget.fill ?? '#111'}
            ref={bindRef}
          />
        );
      case 'image':
        return <ImageShape node={renderTarget} common={common} bindRef={bindRef} />;
      case 'mesh': {
        const points = 'vertices' in renderTarget ? renderTarget.vertices : [];
        return (
          <Line
            {...common}
            points={points}
            closed
            fill={renderTarget.fill ?? undefined}
            stroke={renderTarget.stroke ?? '#94a3b8'}
            strokeWidth={renderTarget.strokeWidth ?? 1}
            ref={bindRef}
          />
        );
      }
      case 'symbol': {
        const symbol = symbols.find((item) => item.id === node.symbolId);
        if (!symbol) {
          return (
            <Rect
              {...common}
              stroke="#ef4444"
              dash={[6, 4]}
              fill="transparent"
              ref={bindRef}
            />
          );
        }
        return (
          <Group {...common} ref={bindRef}>
            <Rect
              x={0}
              y={0}
              width={node.width}
              height={node.height}
              stroke="#cbd5f5"
              dash={[4, 4]}
              fill="transparent"
            />
            {symbol.nodes.map((child) => {
              const override = node.overrides.find((item) => item.nodeId === child.id);
              const childNode = {
                ...child,
                ...override?.patch,
                id: `${node.id}:${child.id}`
              } as Node;
              return renderNodeWithOffset(childNode, { x: 0, y: 0 }, false, idPrefix);
            })}
          </Group>
        );
      }
      default:
        return null;
    }
  };

  const renderNode = (node: Node) => renderNodeWithOffset(node, artboardOffset, true, null);

  const effectiveFrameId = playMode && playFrameId ? playFrameId : activeFrameId;
  const framesToRender = playMode
    ? frames.filter((item) => item.id === effectiveFrameId)
    : frames;
  const hoverNode = hoverNodeId ? nodeById.get(hoverNodeId) ?? null : null;
  const editNode = editState ? nodeById.get(editState.nodeId) ?? null : null;
  const editPoints = editState?.points ?? null;
  const editingNode = textEdit ? nodeById.get(textEdit.id) ?? null : null;
  const textEditRect = editingNode ? getEditorRect(editingNode) : null;
  const handleRadius = 6 / (stageTransform.scale || 1);
  const handleStroke = 1 / (stageTransform.scale || 1);
  const pivotHandleRadius = 5 / (stageTransform.scale || 1);
  const pivotHandleStroke = 1 / (stageTransform.scale || 1);
  const rotationHandleOffset = 10 / (stageTransform.scale || 1);
  const rotationHandleRadius = 5 / (stageTransform.scale || 1);
  const pivotTarget =
    selectedNodeIds.length === 1 ? nodeById.get(selectedNodeIds[0]) ?? null : null;
  const pivotPoint = pivotTarget
    ? (() => {
        const pivot = getPivot(pivotTarget);
        return {
          x: pivotTarget.x + pivot.x + artboardOffset.x,
          y: pivotTarget.y + pivot.y + artboardOffset.y
        };
      })()
    : null;

  const updatePivot = (target: Node, point: { x: number; y: number }) => {
    const nextPivotX = point.x - artboardOffset.x - target.x;
    const nextPivotY = point.y - artboardOffset.y - target.y;
    onUpdateNode(target.id, { pivotX: nextPivotX, pivotY: nextPivotY });
  };

  const startRotateDrag = (target: Node) => {
    if (target.locked) return;
    const point = getFramePoint();
    if (!point) return;
    const pivot = getPivot(target);
    const pivotPointLocal = { x: target.x + pivot.x, y: target.y + pivot.y };
    const startAngle = Math.atan2(point.y - pivotPointLocal.y, point.x - pivotPointLocal.x);
    rotateDragRef.current = {
      nodeId: target.id,
      pivot: pivotPointLocal,
      startAngle,
      startRotation: target.rotation
    };
  };

  const updateEditPoint = (index: number, next: { x: number; y: number }) => {
    if (!editState) return;
    const target = nodeById.get(editState.nodeId);
    if (!target) return;
    const nextPoints = editState.points.map((point, idx) =>
      idx === index ? { ...point, x: next.x, y: next.y } : point
    );
    const update = applyEditPoints(target, nextPoints);
    onUpdateNode(target.id, update.patch);
    setEditState({ nodeId: target.id, points: update.points });
  };

  const renderHoverOverlay = (node: Node) => {
    const offset = artboardOffset;
    const stroke = '#6c4df7';
    const strokeWidth = 1.5 / (stageTransform.scale || 1);
    if (node.type === 'rect') {
      return (
        <Rect
          x={node.x + offset.x}
          y={node.y + offset.y}
          width={node.width}
          height={node.height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={[6, 4]}
          listening={false}
        />
      );
    }
    if (node.type === 'ellipse') {
      return (
        <Ellipse
          x={node.x + offset.x}
          y={node.y + offset.y}
          radiusX={node.width / 2}
          radiusY={node.height / 2}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
      );
    }
    if (node.type === 'line' && 'points' in node) {
      return (
        <Line
          x={node.x + offset.x}
          y={node.y + offset.y}
          points={node.points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
      );
    }
    if (node.type === 'path') {
      return (
        <Path
          x={node.x + offset.x}
          y={node.y + offset.y}
          data={'pathData' in node ? node.pathData : ''}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="transparent"
          listening={false}
        />
      );
    }
    return (
      <Rect
        x={node.x + offset.x}
        y={node.y + offset.y}
        width={node.width}
        height={node.height}
        stroke={stroke}
        strokeWidth={strokeWidth}
        dash={[6, 4]}
        listening={false}
      />
    );
  };

  return (
    <div
      className={`canvas-wrap CanvasStage ${spacePressed ? 'space-pan' : ''}`}
      data-selected-count={selectedNodeIds.length}
      data-onboarding="canvas"
      ref={containerRef}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const stage = stageRef.current;
        if (stage) {
          stage.setPointersPositions(event.nativeEvent as unknown as TouchEvent);
        }
        const point = getFramePoint();
        onDropFiles(files, point);
      }}
    >
      <div className="canvas-label">Canvas</div>
      {!playMode && <div className="ruler-corner" />}
      {!playMode && <canvas className="ruler-horizontal" ref={horizontalRulerRef} />}
      {!playMode && <canvas className="ruler-vertical" ref={verticalRulerRef} />}
      <div className="canvas-surface">
        {textEdit && editingNode && textEditRect && (
          <textarea
            ref={textAreaRef}
            className="canvas-text-editor"
            style={{
              left: textEditRect.left,
              top: textEditRect.top,
              width: textEditRect.width,
              height: textEditRect.height,
              fontSize: ('fontSize' in editingNode ? editingNode.fontSize : 16) * textEditRect.scale,
              fontFamily: 'fontFamily' in editingNode ? editingNode.fontFamily : 'Inter',
              fontWeight: 'fontWeight' in editingNode && editingNode.fontWeight ? editingNode.fontWeight : 400,
              lineHeight: 'lineHeight' in editingNode && editingNode.lineHeight ? editingNode.lineHeight : 1.2,
              textAlign: 'textAlign' in editingNode && editingNode.textAlign ? editingNode.textAlign : 'left'
            }}
            value={textEdit.value}
            onChange={(event) => setTextEdit((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            onBlur={() => finishTextEdit(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                finishTextEdit(true);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                finishTextEdit(false);
              }
            }}
          />
        )}
        <Stage
          width={stageSize.width}
          height={stageSize.height}
        ref={stageRef}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onMouseMove={handleStageMouseMove}
        draggable={isPanning}
        className="canvas-stage"
        onDragMove={() => {
          const stage = stageRef.current;
          if (!stage) return;
          setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
        }}
        >
        <Layer>
          {framesToRender.map((item) => {
            const offset = getArtboardOffset(item);
            const isActive = item.id === effectiveFrameId;
            return (
              <Group key={item.id} x={offset.x} y={offset.y}>
                <Rect
                  x={0}
                  y={0}
                  width={item.width}
                  height={item.height}
                  fill={item.background ?? '#ffffff'}
                  stroke="#d1d5db"
                  strokeWidth={1}
                  name="frame-bg"
                  frameId={item.id}
                  onContextMenu={(event: Konva.KonvaEventObject<PointerEvent>) => {
                    event.evt.preventDefault();
                    onOpenContextMenu({
                      x: event.evt.clientX,
                      y: event.evt.clientY,
                      targetId: item.id,
                      targetType: 'frame'
                    });
                  }}
                />
                {frameSelected && isActive && !playMode && (
                  <Rect
                    x={-2}
                    y={-2}
                    width={item.width + 4}
                    height={item.height + 4}
                    stroke="#6c4df7"
                    strokeWidth={2}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
        {!playMode && (
          <Layer>
            {framesToRender.map((item) => {
              const offset = getArtboardOffset(item);
              const isFlowStart = item.id === playFrameId;
              return (
                <Group
                  key={`${item.id}-label`}
                  x={offset.x}
                  y={offset.y}
                  scaleX={1 / stageTransform.scale}
                  scaleY={1 / stageTransform.scale}
                >
                  {isFlowStart && (
                    <Label x={0} y={-44} opacity={1}>
                      <Tag fill="#3b82f6" cornerRadius={6} />
                      <Text text="Start" fontSize={9} padding={4} fill="#ffffff" />
                    </Label>
                  )}
                  <Label
                    x={0}
                    y={-22}
                    opacity={1}
                    name="frame-label"
                    frameId={item.id}
                    listening={!playMode}
                    onClick={() => {
                      if (playMode) return;
                      onSelectFrame(item.id);
                    }}
                  >
                    <Tag
                      name="frame-label"
                      fill="#f5f3ff"
                      stroke="#6c4df7"
                      strokeWidth={1}
                      cornerRadius={6}
                      frameId={item.id}
                    />
                    <Text
                      name="frame-label"
                      text={`${item.name} - ${(item.duration / 1000).toFixed(1)}s`}
                      fontSize={10}
                      padding={4}
                      fill="#4c1d95"
                      frameId={item.id}
                    />
                  </Label>
                </Group>
              );
            })}
          </Layer>
        )}
        <Layer>
            {framesToRender.map((item) => {
              const offset = getArtboardOffset(item);
              const isActive = item.id === effectiveFrameId;
              const renderNodes = isActive ? nodes : item.nodes;
              return renderNodes
                .slice()
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((node) =>
                  renderNodeWithOffset(
                    node,
                    offset,
                    !playMode && isActive,
                    isActive ? null : item.id
                  )
                );
            })}
            {hoverNode &&
              !playMode &&
              activeTool === 'select' &&
              !editState &&
              !selectedNodeIds.includes(hoverNode.id) &&
              renderHoverOverlay(hoverNode)}
            {editNode && editPoints && !playMode && (activeTool === 'select' || activeTool === 'pen') && (
              <Group>
                <Line
                  points={editPoints.flatMap((point) => [
                    point.x + artboardOffset.x,
                    point.y + artboardOffset.y
                  ])}
                  stroke="#6c4df7"
                  strokeWidth={1 / (stageTransform.scale || 1)}
                  listening={false}
                />
                {hoverSegmentIndex != null && editPoints[hoverSegmentIndex] && editPoints[hoverSegmentIndex + 1] && (
                  <Line
                    points={[
                      editPoints[hoverSegmentIndex].x + artboardOffset.x,
                      editPoints[hoverSegmentIndex].y + artboardOffset.y,
                      editPoints[hoverSegmentIndex + 1].x + artboardOffset.x,
                      editPoints[hoverSegmentIndex + 1].y + artboardOffset.y
                    ]}
                    stroke="#2563eb"
                    strokeWidth={2 / (stageTransform.scale || 1)}
                    listening={false}
                  />
                )}
                {editPoints.map((point, index) => (
                  <Circle
                    key={`edit-point-${index}`}
                    name="edit-handle"
                    x={point.x + artboardOffset.x}
                    y={point.y + artboardOffset.y}
                    radius={handleRadius}
                    fill={hoverVertexIndex === index ? '#2563eb' : '#ffffff'}
                    stroke="#111111"
                    strokeWidth={handleStroke}
                    draggable
                    hitStrokeWidth={12 / (stageTransform.scale || 1)}
                    onDragMove={(event) => {
                      const nextX = event.target.x() - artboardOffset.x;
                      const nextY = event.target.y() - artboardOffset.y;
                      updateEditPoint(index, { x: nextX, y: nextY });
                    }}
                  />
                ))}
              </Group>
            )}
            {pivotTarget && pivotPoint && !playMode && !editState && activeTool === 'select' && (
              <Circle
                name="pivot-handle"
                x={pivotPoint.x}
                y={pivotPoint.y}
                radius={pivotHandleRadius}
                fill="#ffffff"
                stroke="#111111"
                strokeWidth={pivotHandleStroke}
                draggable
                onDragMove={(event) => {
                  updatePivot(pivotTarget, { x: event.target.x(), y: event.target.y() });
                }}
                onDragEnd={(event) => {
                  updatePivot(pivotTarget, { x: event.target.x(), y: event.target.y() });
                }}
              />
            )}
            {pivotTarget && !playMode && !editState && activeTool === 'select' && (
              <Group>
                {[
                  {
                    x: pivotTarget.x - rotationHandleOffset,
                    y: pivotTarget.y - rotationHandleOffset
                  },
                  {
                    x: pivotTarget.x + pivotTarget.width + rotationHandleOffset,
                    y: pivotTarget.y - rotationHandleOffset
                  },
                  {
                    x: pivotTarget.x - rotationHandleOffset,
                    y: pivotTarget.y + pivotTarget.height + rotationHandleOffset
                  },
                  {
                    x: pivotTarget.x + pivotTarget.width + rotationHandleOffset,
                    y: pivotTarget.y + pivotTarget.height + rotationHandleOffset
                  }
                ].map((point, index) => (
                  <Circle
                    key={`rotate-handle-${index}`}
                    name="rotate-handle"
                    x={point.x + artboardOffset.x}
                    y={point.y + artboardOffset.y}
                    radius={rotationHandleRadius}
                    fill="#ffffff"
                    stroke="#111111"
                    strokeWidth={pivotHandleStroke}
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                      startRotateDrag(pivotTarget);
                    }}
                  />
                ))}
              </Group>
            )}
            {!playMode && activeTool === 'pencil' && pencilPreview && (
              <Line
                points={pencilPreview}
                x={artboardOffset.x}
                y={artboardOffset.y}
                stroke="#111111"
                strokeWidth={2}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
            {!playMode && activeTool === 'pen' && penPreview && (
              <>
                <Path
                  data={penPreview.path}
                  x={artboardOffset.x}
                  y={artboardOffset.y}
                  stroke="#111111"
                  strokeWidth={2}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
                {penPreview.points.map((point, index) => (
                  <Circle
                    key={`pen-point-${index}`}
                    x={point.x + artboardOffset.x}
                    y={point.y + artboardOffset.y}
                    radius={3}
                    fill="#ffffff"
                    stroke="#111111"
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
              </>
            )}
            {/* Hide transform handles while editing vertices. */}
            {!playMode && !editState && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={lockAspect}
                enabledAnchors={
                  lockAspect
                    ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                    : [
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right',
                        'middle-left',
                        'middle-right',
                        'top-center',
                        'bottom-center'
                      ]
                }
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 4 || newBox.height < 4) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
        {webglEnabled && (
          <div
            className="webgl-layer"
            style={{
              transform: `translate(${stageTransform.x + artboardOffset.x * stageTransform.scale}px, ${stageTransform.y + artboardOffset.y * stageTransform.scale}px) scale(${stageTransform.scale})`,
              transformOrigin: 'top left'
            }}
          >
            <canvas
              ref={webglCanvasRef}
              className="webgl-overlay"
              width={webglFrame.width}
              height={webglFrame.height}
            />
          </div>
        )}
        {playMode && (
          <div
            className="play-layer"
            style={{
              transform: `translate(${stageTransform.x + artboardOffset.x * stageTransform.scale}px, ${stageTransform.y + artboardOffset.y * stageTransform.scale}px) scale(${stageTransform.scale})`,
              transformOrigin: 'top left'
            }}
          >
            <canvas
              ref={previewCanvasRef}
              className="play-overlay"
              width={frame.width}
              height={frame.height}
            />
          </div>
        )}
      </div>
      {emptyHint && !dismissEmptyHint && (
        <div className="canvas-hint">
          <div className="canvas-hint-title">Start by drawing a shape or importing an SVG.</div>
          <div className="canvas-hint-subtitle">Add a second scene to create motion.</div>
          <button
            className="canvas-hint-action"
            type="button"
            onClick={() => {
              setDismissEmptyHint(true);
              try {
                window.localStorage.setItem('dm_empty_hint_dismissed', '1');
              } catch {
                // ignore storage failures
              }
            }}
          >
            Okay
          </button>
        </div>
      )}
      {playHint && (
        <div className="canvas-hint play">
          <div className="canvas-hint-title">Play requires at least one transition. Add another scene.</div>
        </div>
      )}
      {spacePressed && (
        <div className="pan-indicator">
          <img src={handIcon} alt="" />
          Hand Pan
        </div>
      )}
    </div>
  );
};
