import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Ellipse, Line, Path, Text, Image as KonvaImage, Transformer, Group, Label, Tag } from 'react-konva';
import Konva from 'konva';
import type { Frame, Node } from '@dream-motion/shared';
import handIcon from '../assets/Hand.svg';
import { createWebGLRenderer } from '../lib/webglRenderer';
import { renderToCanvas } from '@dream-motion/runtime';
import { createId } from '../lib/ids';

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

type CanvasStageProps = {
  frame: Frame;
  frames: Frame[];
  activeFrameId: string;
  nodes: Node[];
  selectedNodeIds: string[];
  frameSelected: boolean;
  symbols: { id: string; name: string; nodes: Node[] }[];
  onUpdateFramePosition: (id: string, x: number, y: number) => void;
  onDuplicateFrameAtPosition: (id: string, x: number, y: number) => void;
  onDeselectFrame: () => void;
  webglEnabled: boolean;
  webglFrame: Frame;
  webglNodes: Node[];
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
  onAddNodes: (nodes: Node[]) => void;
  onSelectFrame: (id: string) => void;
  onOpenContextMenu: (event: { x: number; y: number; targetId: string | null; targetType: 'node' | 'frame' }) => void;
  previewMode: boolean;
  activeTool: 'select' | 'rect' | 'ellipse' | 'text' | 'pen' | 'image';
  emptyHint: boolean;
  previewHint: boolean;
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
  onSelectFrame,
  onOpenContextMenu,
  previewMode,
  activeTool,
  emptyHint,
  previewHint,
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
  const [dismissEmptyHint, setDismissEmptyHint] = useState(false);
  const [stageTransform, setStageTransform] = useState({ scale: 1, x: 0, y: 0 });
  const rulerSize = previewMode ? 0 : 22;
  const horizontalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const verticalRulerRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<ReturnType<typeof createWebGLRenderer> | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    type: 'rect' | 'ellipse';
  } | null>(null);
  const frameDragRef = useRef<{
    active: boolean;
    startPointer: { x: number; y: number };
    startFrame: { x: number; y: number };
    frameId: string;
    axisLock: 'x' | 'y' | null;
    duplicating: boolean;
    origin: 'label' | 'empty';
    moved: boolean;
  } | null>(null);

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

  const getArtboardOffset = (target: Frame) => {
    const frameOffsetX = target.x ?? 0;
    const frameOffsetY = target.y ?? 0;
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
        if (previewMode) return;
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
  }, [stageRef, previewMode]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
  }, [stageRef]);

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
    if (!previewMode) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    renderToCanvas({
      canvas,
      nodes,
      background: frame.background ?? null
    });
  }, [previewMode, nodes, frame.width, frame.height, frame.background]);

  const nodeById = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

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

  const getFrameIdFromTarget = (event: Konva.KonvaEventObject<MouseEvent>) => {
    let current: Konva.Node | null = event.target;
    while (current) {
      if (current.hasName?.('frame-bg') || current.hasName?.('frame-label')) {
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
    if (previewMode) return;
    if (event.evt.button !== 0) return;
    if (spacePressed) {
      setIsPanning(true);
      stageRef.current?.draggable(true);
      const stage = stageRef.current;
      if (stage) {
        setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
      }
      return;
    }
    if (activeTool === 'rect' || activeTool === 'ellipse') {
      const point = getFramePoint();
      if (!point) return;
      if (point.x < 0 || point.y < 0 || point.x > frame.width || point.y > frame.height) {
        return;
      }
      const id = createId();
      const node: Node = {
        id,
        name: `${activeTool === 'rect' ? 'Rectangle' : 'Ellipse'}`,
        type: activeTool === 'rect' ? 'rect' : 'ellipse',
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
    if (activeTool !== 'select') return;
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const clickedOnEmpty = event.target === event.target.getStage();
    const frameIdFromTarget = getFrameIdFromTarget(event);
    const onFrameHit = Boolean(frameIdFromTarget);
    const onFrameLabel = Boolean(event.target?.hasName?.('frame-label'));
    if (pointer && (onFrameHit || (frameSelected && clickedOnEmpty))) {
      const targetFrameId = frameIdFromTarget ?? activeFrameId;
      if (onFrameHit) {
        onSelectFrame(targetFrameId);
      }
      frameDragRef.current = {
        active: true,
        startPointer: pointer,
        frameId: targetFrameId,
        startFrame: { x: (frameById.get(targetFrameId)?.x ?? 0), y: (frameById.get(targetFrameId)?.y ?? 0) },
        axisLock: null,
        duplicating: altPressed,
        origin: onFrameLabel ? 'label' : 'empty',
        moved: false
      };
      return;
    }
    if (clickedOnEmpty) {
      onSelectNode(null);
      onDeselectFrame();
    }
  };

  const handleStageMouseUp = () => {
    if (previewMode) return;
    setIsPanning(false);
    stageRef.current?.draggable(false);
    const stage = stageRef.current;
    if (stage) {
      setStageTransform({ scale: stage.scaleX(), x: stage.x(), y: stage.y() });
    }
    if (drawRef.current) {
      drawRef.current = null;
    }
    const dragState = frameDragRef.current;
    if (dragState?.active) {
      const draggedFrame = frameById.get(dragState.frameId);
      const finalX = draggedFrame?.x ?? 0;
      const finalY = draggedFrame?.y ?? 0;
      if (dragState.duplicating && dragState.moved) {
        onDuplicateFrameAtPosition(dragState.frameId, finalX, finalY);
        onUpdateFramePosition(dragState.frameId, dragState.startFrame.x, dragState.startFrame.y);
      }
      if (!dragState.moved && dragState.origin === 'empty') {
        onDeselectFrame();
      }
      frameDragRef.current = null;
    }
  };

  const handleStageMouseMove = () => {
    if (drawRef.current) {
      const point = getFramePoint();
      if (!point) return;
      const startX = drawRef.current.startX;
      const startY = drawRef.current.startY;
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

    onUpdateNode(id, {
      x: shape.x() - artboardOffset.x,
      y: shape.y() - artboardOffset.y,
      width: newWidth,
      height: newHeight,
      rotation: shape.rotation(),
      scaleX: 1,
      scaleY: 1
    });
  };

  const handleSelect = (id: string) => {
    if (previewMode || spacePressed) return;
    onSelectNode(id);
  };

  const renderNodeWithOffset = (
    node: Node,
    offset: { x: number; y: number },
    interactive: boolean,
    idPrefix: string | null
  ) => {
    const nodeId = idPrefix ? `${idPrefix}:${node.id}` : node.id;
    const common = {
      id: nodeId,
      key: nodeId,
      x: node.x + offset.x,
      y: node.y + offset.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      scaleX: node.scaleX,
      scaleY: node.scaleY,
      opacity: node.opacity,
      visible: node.visible,
      draggable: interactive && !previewMode && !node.locked,
      onClick: interactive ? () => handleSelect(node.id) : undefined,
      onTap: interactive ? () => handleSelect(node.id) : undefined,
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
      onDragEnd: interactive
        ? (event: Konva.KonvaEventObject<DragEvent>) =>
            onUpdateNode(node.id, {
              x: event.target.x() - offset.x,
              y: event.target.y() - offset.y
            })
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
    };

    switch (node.type) {
      case 'rect':
        return (
          <Rect
            {...common}
            cornerRadius={node.cornerRadius ?? 0}
            fill={node.fill ?? undefined}
            stroke={node.stroke ?? undefined}
            strokeWidth={node.strokeWidth ?? undefined}
            ref={bindRef}
          />
        );
      case 'ellipse':
        return (
          <Ellipse
            {...common}
            radiusX={node.width / 2}
            radiusY={node.height / 2}
            fill={node.fill ?? undefined}
            stroke={node.stroke ?? undefined}
            strokeWidth={node.strokeWidth ?? undefined}
            ref={bindRef}
          />
        );
      case 'line':
        return (
          <Line
            {...common}
            points={'points' in node ? node.points : []}
            stroke={node.stroke ?? '#111'}
            strokeWidth={node.strokeWidth ?? 1}
            ref={bindRef}
          />
        );
      case 'path':
        return (
          <Path
            {...common}
            data={'pathData' in node ? node.pathData : ''}
            fill={node.fill ?? undefined}
            stroke={node.stroke ?? undefined}
            strokeWidth={node.strokeWidth ?? undefined}
            ref={bindRef}
          />
        );
      case 'text':
        return (
          <Text
            {...common}
            text={'text' in node ? node.text : ''}
            fontSize={'fontSize' in node ? node.fontSize : 16}
            fontFamily={'fontFamily' in node ? node.fontFamily : 'Arial'}
            fontStyle={'fontWeight' in node && node.fontWeight ? String(node.fontWeight) : 'normal'}
            fill={node.fill ?? '#111'}
            ref={bindRef}
          />
        );
      case 'image':
        return <ImageShape node={node} common={common} bindRef={bindRef} />;
      case 'mesh': {
        const points = 'vertices' in node ? node.vertices : [];
        return (
          <Line
            {...common}
            points={points}
            closed
            fill={node.fill ?? undefined}
            stroke={node.stroke ?? '#94a3b8'}
            strokeWidth={node.strokeWidth ?? 1}
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

  const framesToRender = previewMode
    ? frames.filter((item) => item.id === activeFrameId)
    : frames;

  return (
    <div
      className={`canvas-wrap CanvasStage ${spacePressed ? 'space-pan' : ''}`}
      data-selected-count={selectedNodeIds.length}
      data-onboarding="canvas"
      ref={containerRef}
    >
      <div className="canvas-label">Canvas</div>
      {!previewMode && <div className="ruler-corner" />}
      {!previewMode && <canvas className="ruler-horizontal" ref={horizontalRulerRef} />}
      {!previewMode && <canvas className="ruler-vertical" ref={verticalRulerRef} />}
      <div className="canvas-surface">
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
            const isActive = item.id === activeFrameId;
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
                  onClick={() => onSelectFrame(item.id)}
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
                {frameSelected && isActive && (
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
        <Layer>
          {framesToRender.map((item) => {
            const offset = getArtboardOffset(item);
            return (
              <Group
                key={`${item.id}-label`}
                x={offset.x}
                y={offset.y}
                scaleX={1 / stageTransform.scale}
                scaleY={1 / stageTransform.scale}
              >
                <Label
                  x={0}
                  y={-22}
                  opacity={1}
                  name="frame-label"
                  frameId={item.id}
                  listening
                  onClick={() => onSelectFrame(item.id)}
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
        <Layer>
            {framesToRender.map((item) => {
              const offset = getArtboardOffset(item);
              const isActive = item.id === activeFrameId;
              const renderNodes = isActive ? nodes : item.nodes;
              return renderNodes
                .slice()
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((node) =>
                  renderNodeWithOffset(
                    node,
                    offset,
                    !previewMode && isActive,
                    isActive ? null : item.id
                  )
                );
            })}
            {!previewMode && (
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
        {previewMode && (
          <div
            className="preview-layer"
            style={{
              transform: `translate(${stageTransform.x + artboardOffset.x * stageTransform.scale}px, ${stageTransform.y + artboardOffset.y * stageTransform.scale}px) scale(${stageTransform.scale})`,
              transformOrigin: 'top left'
            }}
          >
            <canvas
              ref={previewCanvasRef}
              className="preview-overlay"
              width={frame.width}
              height={frame.height}
            />
          </div>
        )}
      </div>
      {previewMode && <div className="preview-banner">Preview Mode</div>}
      {emptyHint && !dismissEmptyHint && (
        <div className="canvas-hint">
          <div className="canvas-hint-title">Start by drawing a shape or importing an SVG.</div>
          <div className="canvas-hint-subtitle">Add a second scene to create motion.</div>
          <button
            className="canvas-hint-action"
            type="button"
            onClick={() => setDismissEmptyHint(true)}
          >
            Okay
          </button>
        </div>
      )}
      {previewHint && (
        <div className="canvas-hint preview">
          <div className="canvas-hint-title">Preview requires at least one transition. Add another scene.</div>
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
