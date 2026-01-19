
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import polygonClipping from 'polygon-clipping';
import type { DocumentModel, Node } from '@dream-motion/shared';
import { evaluateTransition } from '@dream-motion/runtime';
import { dmxSchema } from '@dream-motion/schema';
import { generateMotionModel } from './lib/autoMotion';
import { importImageFile } from './lib/importers';
import {
  buildDmx,
  buildEditorState,
  compressDmx,
  decompressDmx,
  hydrateDocumentFromDmx,
  migrateDmx
} from './lib/dmx';
import { createId } from './lib/ids';
import { getBaseNameForNode, getNextNameForBase, getNextNameForTool } from './lib/naming';
import { useDocumentStore } from './store/documentStore';
import { CanvasStage } from './components/CanvasStage';
import { LayersPanel } from './components/LayersPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FramesBar } from './components/FramesBar';
import { TopBar } from './components/TopBar';
import { OnboardingTour } from './components/OnboardingTour';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Toast, ToastViewport } from './components/ui/toast';
import { TooltipProvider } from './components/ui/tooltip';
import templates from './assets/templates.json';
import library from './assets/library.json';

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain' });
  const link = window.document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const downloadJson = (filename: string, data: unknown) =>
  downloadText(filename, JSON.stringify(data, null, 2));

const downloadBinary = (filename: string, bytes: Uint8Array) => {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const link = window.document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const cloneDocumentModel = (doc: DocumentModel) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(doc);
  }
  return JSON.parse(JSON.stringify(doc));
};

const App: React.FC = () => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const dmxInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const clipboardRef = useRef<
    { kind: 'nodes'; nodes: Node[] } | { kind: 'frame'; frameId: string } | null
  >(null);
  const toastTimerRef = useRef<number | null>(null);
  const lastCreatedNodeIdRef = useRef<string | null>(null);

  const [webglEnabled, setWebglEnabled] = useState(false);
  const [activeTool, setActiveTool] = useState<
    'select' | 'frame' | 'rect' | 'ellipse' | 'line' | 'text' | 'pen' | 'pencil' | 'image' | 'connector'
  >('select');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'info' | 'warning' | 'error'>('info');
  const [panelMode, setPanelMode] = useState<'design' | 'animate'>('design');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    targetId: string | null;
    targetType: 'node' | 'frame';
  }>({ open: false, x: 0, y: 0, targetId: null, targetType: 'node' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [clipboardCount, setClipboardCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [currentDmxFilename, setCurrentDmxFilename] = useState<string | null>(null);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('project.dmx');
  const [saveEmbedLargeAssets, setSaveEmbedLargeAssets] = useState(false);
  const [saveIncludeEditorState, setSaveIncludeEditorState] = useState(true);
  const [lockAspect, setLockAspect] = useState(true);
  const [lockFrameAspect, setLockFrameAspect] = useState(true);
  const [pendingImagePoint, setPendingImagePoint] = useState<{ x: number; y: number } | null>(null);
  const [playbackLoop, setPlaybackLoop] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    const stored = window.localStorage.getItem('dm_onboarding_done');
    if (!stored) setShowOnboarding(true);
  }, []);

  const showToast = (message: string, variant: 'info' | 'warning' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    setToastVariant(variant);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const {
    document,
    activeFrameId,
    selectedNodeIds,
    frameSelected,
    activeVariantId,
    playMode,
    isPlaying,
    playTime,
    warnings,
    lastError,
    history,
    setActiveFrame,
    setFrameSelected,
    setActiveVariant,
    setDocument,
    resetDocument,
    selectNode,
    updateNode,
    updateNodes,
    moveNode,
    addNodes,
    deleteNode,
    updateFrame,
    updateFrameName,
    updateFramePosition,
    bringNodeToFront,
    sendNodeToBack,
    createSymbolFromNode,
    insertSymbolInstance,
    updateTransitionOverride,
    addFrame,
    addHoldFrame,
    duplicateFrame,
    duplicateFrameAtPosition,
    addVariant,
    addResponsiveRule,
    updateResponsiveRule,
    toggleCollaboration,
    updateSymbolOverride,
    addStateMachineInput,
    addStateMachineState,
    addStateMachineTransition,
    setInitialState,
    addBone,
    updateBone,
    addConstraint,
    bindNodeToBone,
    convertNodeToMesh,
    autoWeightMesh,
    connectTransition,
    addController,
    updateController,
    updateEnterprise,
    updateBilling,
    deleteFrame,
    moveFrame,
    updateTransition,
    setPlayMode,
    setPlayStartFrame,
    setPlaying,
    setPlayTime,
    updateDocumentName,
    updateDocumentMetadata,
    importSvg,
    exportRuntime,
    undo,
    redo
  } = useDocumentStore();

  const handleAddNodes = (nodes: Node[]) => {
    if (!nodes.length) return;
    addNodes(nodes);
    lastCreatedNodeIdRef.current = nodes[nodes.length - 1].id;
  };

  const activeFrame =
    document.frames.find((frame) => frame.id === activeFrameId) ?? document.frames[0];
  const activeVariant =
    activeFrame.variants.find((variant) => variant.id === activeVariantId) ?? null;
  const displayFrame = activeVariant
    ? {
        ...activeFrame,
        name: `${activeFrame.name} - ${activeVariant.name}`,
        x: activeFrame.x,
        y: activeFrame.y,
        width: activeVariant.width,
        height: activeVariant.height,
        nodes: activeVariant.nodes
      }
    : activeFrame;
  const playStartFrameId = document.startFrameId || document.frames[0]?.id || '';
  const playFrame =
    document.frames.find((frame) => frame.id === playStartFrameId) ?? displayFrame;
  const selectedNode = displayFrame.nodes.find((node) => node.id === selectedNodeIds[0]) ?? null;
  const selectedNodes = selectedNodeIds
    .map((id) => displayFrame.nodes.find((node) => node.id === id))
    .filter((node): node is Node => Boolean(node));
  const nodeById = useMemo(() => {
    const map = new Map<string, Node>();
    displayFrame.nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [displayFrame.nodes]);
  const selectedTransition = selectedTransitionId
    ? document.transitions.find((item) => item.id === selectedTransitionId) ?? null
    : null;
  const transition =
    selectedTransition ??
    document.transitions.find((item) => item.fromFrameId === activeFrame.id) ??
    null;
  const playTransition =
    selectedTransition ??
    document.transitions.find((item) => item.fromFrameId === playStartFrameId) ??
    null;
  const isStarred = Boolean(document.metadata?.starred);

  const getNextNodeName = (node: Node) =>
    getNextNameForBase(document.frames, getBaseNameForNode(node));

  const duplicateNodeWithOffset = (node: Node, offsetX: number) => {
    const clone: Node = {
      ...node,
      id: createId(),
      name: getNextNodeName(node),
      x: node.x + offsetX,
      y: node.y,
      locked: false
    };
    handleAddNodes([clone]);
    selectNode(clone.id);
  };

  const alignSelection = (
    xMode: 'left' | 'center' | 'right' | null,
    yMode: 'top' | 'middle' | 'bottom' | null
  ) => {
    if (!selectedNodes.length) return;
    const bounds =
      selectedNodes.length >= 2
        ? (() => {
            let minX = selectedNodes[0].x;
            let minY = selectedNodes[0].y;
            let maxX = selectedNodes[0].x + selectedNodes[0].width;
            let maxY = selectedNodes[0].y + selectedNodes[0].height;
            selectedNodes.forEach((node) => {
              minX = Math.min(minX, node.x);
              minY = Math.min(minY, node.y);
              maxX = Math.max(maxX, node.x + node.width);
              maxY = Math.max(maxY, node.y + node.height);
            });
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          })()
        : activeFrame
        ? { x: 0, y: 0, width: activeFrame.width, height: activeFrame.height }
        : null;
    if (!bounds) {
      showToast('No alignment container found', 'warning');
      return;
    }
    const updates = selectedNodes.map((node) => {
      const patch: Partial<Node> = {};
      if (xMode === 'left') patch.x = bounds.x;
      if (xMode === 'center') patch.x = bounds.x + (bounds.width - node.width) / 2;
      if (xMode === 'right') patch.x = bounds.x + bounds.width - node.width;
      if (yMode === 'top') patch.y = bounds.y;
      if (yMode === 'middle') patch.y = bounds.y + (bounds.height - node.height) / 2;
      if (yMode === 'bottom') patch.y = bounds.y + bounds.height - node.height;
      return { id: node.id, patch };
    });
    updateNodes(updates);
  };

  const motion = useMemo(() => generateMotionModel(document), [document]);
  const motionTransition = motion.transitions.find((item) => item.id === playTransition?.id);
  const playDuration = motionTransition
    ? Math.max(
        motionTransition.duration,
        ...motionTransition.tracks.map((track) => track.delay + track.duration)
      )
    : 0;

  const playNodes: Node[] =
    playMode && playTransition
      ? evaluateTransition({
          scene: document,
          motion,
          transitionId: playTransition.id,
          timeMs: playTime
        })
      : displayFrame.nodes;

  const hasOnlyOneFrame = document.frames.length <= 1;
  const hasNoObjects = displayFrame.nodes.length === 0;
  const needsSecondFrameHint = hasOnlyOneFrame && !hasNoObjects;
  const showPlayRequiresTransition = playMode && document.transitions.length === 0;
  const hasSecondFrame = document.frames.length >= 2;
  const framesUnchanged = useMemo(() => {
    if (document.frames.length < 2) return false;
    const [first, second] = document.frames;
    if (!first || !second) return false;
    if (first.nodes.length !== second.nodes.length) return false;
    const map = new Map(first.nodes.map((node) => [node.id, node]));
    return second.nodes.every((node) => {
      const base = map.get(node.id);
      if (!base) return false;
      return JSON.stringify(base) === JSON.stringify(node);
    });
  }, [document.frames]);

  const timelineDuration = useMemo(() => {
    if (!document.frames.length) return 0;
    return document.frames.reduce((total, frame) => {
      const transitionForFrame = document.transitions.find((item) => item.fromFrameId === frame.id);
      return total + (transitionForFrame?.duration ?? 1000);
    }, 0);
  }, [document.frames, document.transitions]);
  const effectiveTimelineDuration = selectedTransition?.duration ?? timelineDuration;
  const playTotalMs = playTransition?.duration ?? 0;
  const playProgress = playTotalMs > 0 ? Math.min(1, playTime / playTotalMs) : 0;

  useEffect(() => {
    if (!playMode || !playTransition) return;
    if (!isPlaying) return;
    let raf = 0;
    let start = 0;

    const tick = (timestamp: number) => {
      if (!start) start = timestamp - playTime / playbackSpeed;
      const elapsed = (timestamp - start) * playbackSpeed;
      setPlayTime(elapsed);
      if (playDuration > 0 && elapsed >= playDuration) {
        if (playbackLoop) {
          start = timestamp;
          setPlayTime(0);
        } else {
          setPlaying(false);
          setPlayTime(playDuration);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    playMode,
    isPlaying,
    playTransition?.id,
    playDuration,
    playbackSpeed,
    playbackLoop,
    playTime,
    setPlaying,
    setPlayTime
  ]);

  useEffect(() => {
    if (!playMode) {
      setPlayTime(0);
    }
  }, [playMode, setPlayTime]);

  useEffect(() => {
    if (!selectedTransitionId) return;
    const exists = document.transitions.some((item) => item.id === selectedTransitionId);
    if (!exists) setSelectedTransitionId(null);
  }, [document.transitions, selectedTransitionId]);


  const handleImportSvg = async () => {
    importInputRef.current?.click();
  };

  const handleImportImage = async () => {
    imageInputRef.current?.click();
  };

  const placeImageNode = async (file: File, point: { x: number; y: number } | null) => {
    try {
      const node = await importImageFile(file);
      const name = getNextNameForTool(document.frames, 'image');
      const maxSize = 300;
      const scale = Math.min(1, maxSize / Math.max(node.width, node.height));
      const width = node.width * scale;
      const height = node.height * scale;
      const center = point ?? { x: displayFrame.width / 2, y: displayFrame.height / 2 };
      handleAddNodes([
        {
          ...node,
          name,
          x: center.x - width / 2,
          y: center.y - height / 2,
          width,
          height,
          zIndex: displayFrame.nodes.length
        }
      ]);
      selectNode(node.id);
    } catch (error) {
      showToast('Unable to import image', 'error');
    }
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSvg =
      file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (isSvg) {
      const text = await file.text();
      importSvg(text);
    } else {
      await placeImageNode(file, null);
    }
    event.target.value = '';
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (pendingImagePoint) {
      await placeImageNode(file, pendingImagePoint);
      setPendingImagePoint(null);
    } else {
      await placeImageNode(file, null);
    }
    event.target.value = '';
  };

  const handleDropFiles = async (files: FileList, point: { x: number; y: number } | null) => {
    const file = files[0];
    if (!file) return;
    const isSvg =
      file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    if (isSvg) {
      const text = await file.text();
      importSvg(text);
      return;
    }
    await placeImageNode(file, point);
  };
  const getEditorSnapshot = () =>
    buildEditorState({
      activeTool,
      selectedFrameId: activeFrameId ?? null,
      selectedLayerIds: selectedNodeIds,
      zoom: stageRef.current?.scaleX() ?? 1,
      pan: {
        x: stageRef.current?.x() ?? 0,
        y: stageRef.current?.y() ?? 0
      },
      playMode,
      panelMode,
      playStartFrameId
    });

  const normalizeDmxName = (input: string) => {
    const trimmed = input.trim() || 'project.dmx';
    return trimmed.toLowerCase().endsWith('.dmx') ? trimmed : `${trimmed}.dmx`;
  };

  const saveDmxFile = (
    filename: string,
    options: { embedLargeAssets: boolean; includeEditorState: boolean }
  ) => {
    const dmx = buildDmx(document, {
      filename,
      embedLargeAssets: options.embedLargeAssets,
      includeEditorState: options.includeEditorState,
      editorState: options.includeEditorState ? getEditorSnapshot() : null
    });
    const payload = JSON.stringify(dmx);
    const compressed = compressDmx(payload);
    downloadBinary(filename, compressed);
    setCurrentDmxFilename(filename);
    showToast('Saved .dmx');
  };

  const handleOpenDmx = () => {
    showToast('Open a .dmx project');
    dmxInputRef.current?.click();
  };

  const handleDmxChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      let jsonText = '';
      try {
        jsonText = decompressDmx(buffer);
      } catch {
        jsonText = new TextDecoder().decode(new Uint8Array(buffer));
      }
      const raw = JSON.parse(jsonText);
      if (!raw || raw.format !== 'dmx') {
        showToast('Invalid .dmx file', 'error');
        return;
      }
      if (raw.formatVersion !== '1.0.0') {
        showToast('Unsupported .dmx version', 'error');
        return;
      }
      const parsed = dmxSchema.safeParse(raw);
      if (!parsed.success) {
        showToast('Invalid .dmx file', 'error');
        return;
      }
      const migrated = migrateDmx(parsed.data);
      const doc = hydrateDocumentFromDmx(migrated);
      setDocument(doc);
      setPlayMode(false);
      setPlaying(false);
      setPlayTime(0);
      const editor = migrated.editor;
      if (editor?.selectedFrameId) {
        setActiveFrame(editor.selectedFrameId);
      }
      if (editor?.selectedLayerIds?.length) {
        selectNode(editor.selectedLayerIds[0]);
      } else if (editor?.selectedFrameId) {
        setFrameSelected(true);
      }
      if (editor?.panelMode) {
        setPanelMode(editor.panelMode);
      }
      const nextTool = editor?.activeTool;
      const toolOptions = [
        'select',
        'frame',
        'rect',
        'ellipse',
        'line',
        'text',
        'pen',
        'pencil',
        'image',
        'connector'
      ] as const;
      if (nextTool && toolOptions.includes(nextTool as (typeof toolOptions)[number])) {
        setActiveTool(nextTool as (typeof toolOptions)[number]);
      }
      if (editor?.zoom && stageRef.current) {
        window.setTimeout(() => {
          const stage = stageRef.current;
          if (!stage) return;
          stage.scale({ x: editor.zoom, y: editor.zoom });
          stage.position({ x: editor.pan.x, y: editor.pan.y });
          stage.batchDraw();
        }, 0);
      }
      setCurrentDmxFilename(file.name);
      showToast('Project loaded');
    } catch (error) {
      showToast('Invalid .dmx file', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const handleSave = () => {
    if (!currentDmxFilename) {
      const nextName = normalizeDmxName('project.dmx');
      setSaveAsName(nextName);
      setSaveAsOpen(true);
      return;
    }
    saveDmxFile(currentDmxFilename, {
      embedLargeAssets: saveEmbedLargeAssets,
      includeEditorState: saveIncludeEditorState
    });
  };

  const handleSaveAs = () => {
    const nextName = normalizeDmxName(currentDmxFilename ?? 'project.dmx');
    setSaveAsName(nextName);
    setSaveAsOpen(true);
  };

  const handleSaveAsConfirm = () => {
    const filename = normalizeDmxName(saveAsName);
    saveDmxFile(filename, {
      embedLargeAssets: saveEmbedLargeAssets,
      includeEditorState: saveIncludeEditorState
    });
    setSaveAsOpen(false);
  };

  const handleRenameFile = () => {
    const next = window.prompt('Rename file', document.name);
    if (!next) return;
    updateDocumentName(next.trim() || document.name);
  };

  const handleDuplicateFile = () => {
    const copy = cloneDocumentModel(document);
    copy.name = `${document.name} Copy`;
    copy.metadata = {
      ...copy.metadata,
      documentId: createId()
    };
    setDocument(copy);
    setCurrentDmxFilename(null);
    showToast('File duplicated');
  };

  const handleMoveFile = () => {
    showToast('Move to is available in V2', 'warning');
  };

  const handleVersionHistory = () => {
    showToast('Version history is available in V2', 'warning');
  };

  const handleToggleStar = () => {
    const isStarred = Boolean(document.metadata?.starred);
    updateDocumentMetadata({ starred: !isStarred });
  };

  const handleExportRuntime = async () => {
    setExportError(null);
    setExportStatus('Exporting runtime...');
    const bundle = exportRuntime();
    if (!bundle) {
      setExportError('Export failed. See warnings.');
      setExportStatus(null);
      return;
    }
    downloadJson('scene.json', bundle.scene);
    downloadJson('motion.json', bundle.motion);
    const demoHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dream Motion Runtime Demo</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f2f2f2; }
      .wrap { display: grid; place-items: center; height: 100vh; }
      canvas { background: #ffffff; border: 1px solid #d9d9d9; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <canvas id="stage" width="${bundle.scene.frames[0]?.width ?? 960}" height="${bundle.scene.frames[0]?.height ?? 540}"></canvas>
    </div>
    <script src="runtime.js"></script>
    <script>
      const scene = ${JSON.stringify(bundle.scene)};
      const motion = ${JSON.stringify(bundle.motion)};
      const transition = motion.transitions[0];
      const canvas = window.document.getElementById('stage');
      if (!transition) {
        console.warn('No transitions found.');
      } else if (window.DreamMotionRuntime) {
        const player = window.DreamMotionRuntime.createPlayer({
          canvas,
          scene,
          motion,
          transitionId: transition.id,
          loop: true
        });
        player.play();
      } else {
        console.error('runtime.js not loaded.');
      }
    </script>
  </body>
</html>`;
    downloadText('demo.html', demoHtml);
    setExportStatus('Downloading files... Check browser downloads.');
    try {
      const runtimeText = await fetch('/runtime.js').then((res) => res.text());
      downloadText('runtime.js', runtimeText);
      setExportStatus('Export complete.');
    } catch (error) {
      downloadText('runtime.js', '// Runtime bundle not found. Run npm run export-runtime.');
      setExportError('runtime.js not found. Run npm run export-runtime.');
      setExportStatus('Export completed with runtime.js warning.');
    }
  };

  const handleExportPng = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const link = window.document.createElement('a');
    link.href = dataUrl;
    link.download = 'frame.png';
    link.click();
  };

  const handleExportSvg = () => {
    setExportError(null);
    if (!selectedNode) {
      setExportError('Select a shape to export SVG.');
      return;
    }
    if (!['rect', 'ellipse', 'path'].includes(selectedNode.type)) {
      setExportError('SVG export supports rectangles, ellipses, and paths.');
      return;
    }
    const width = Math.max(1, selectedNode.width * Math.abs(selectedNode.scaleX || 1));
    const height = Math.max(1, selectedNode.height * Math.abs(selectedNode.scaleY || 1));
    const fill = selectedNode.fill ?? 'none';
    const stroke = selectedNode.stroke ?? 'none';
    const strokeWidth = selectedNode.strokeWidth ?? 0;
    const rotation = selectedNode.rotation ?? 0;
    let body = '';
    if (selectedNode.type === 'rect') {
      const rx = selectedNode.cornerRadius ?? 0;
      body = `<rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (selectedNode.type === 'ellipse') {
      body = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    } else if (selectedNode.type === 'path') {
      const pathData = 'pathData' in selectedNode ? selectedNode.pathData : '';
      body = `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
    if (rotation) {
      body = `<g transform="rotate(${rotation} ${width / 2} ${height / 2})">${body}</g>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
    downloadText('shape.svg', svg);
    setExportStatus('Exported SVG.');
  };

  const handleExportNodePng = (scale = 1) => {
    setExportError(null);
    if (!selectedNode) {
      setExportError('Select a layer to export.');
      return;
    }
    const stage = stageRef.current;
    if (!stage) return;
    const target = stage.findOne(`#${selectedNode.id}`) as Konva.Node | null;
    if (!target) {
      setExportError('Selected layer not found on canvas.');
      return;
    }
    const dataUrl = target.toDataURL({ pixelRatio: scale });
    const link = window.document.createElement('a');
    link.href = dataUrl;
    const safeName = selectedNode.name ? selectedNode.name.replace(/\s+/g, '-').toLowerCase() : 'layer';
    link.download = `${safeName}@${scale}x.png`;
    link.click();
  };

  const handleOpenPreferences = () => {
    showToast('Preferences are available in V2', 'warning');
  };
  const getBooleanNodes = () => {
    if (selectedNodeIds.length !== 2) return null;
    const nodes = selectedNodeIds
      .map((id) => activeFrame.nodes.find((node) => node.id === id))
      .filter((node): node is Node => Boolean(node));
    if (nodes.length !== 2) return null;
    const supported = nodes.every((node) => node.type === 'rect' || node.type === 'ellipse');
    if (!supported) return null;
    return nodes;
  };

  const handleBooleanOperation = (operation: 'union' | 'subtract' | 'intersect' | 'exclude') => {
    setExportError(null);
    const nodes = getBooleanNodes();
    if (!nodes) {
      setExportError('Select two rectangles or ellipses to use boolean operations.');
      return;
    }
    const [a, b] = nodes;
    const toPolygon = (node: Node, segments = 32) => {
      const width = node.width * Math.abs(node.scaleX || 1);
      const height = node.height * Math.abs(node.scaleY || 1);
      const centerX = node.x + width / 2;
      const centerY = node.y + height / 2;
      const angle = ((node.rotation || 0) * Math.PI) / 180;
      const rotate = (x: number, y: number) => {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = x - centerX;
        const dy = y - centerY;
        return {
          x: centerX + dx * cos - dy * sin,
          y: centerY + dx * sin + dy * cos
        };
      };
      if (node.type === 'rect') {
        const points = [
          rotate(node.x, node.y),
          rotate(node.x + width, node.y),
          rotate(node.x + width, node.y + height),
          rotate(node.x, node.y + height)
        ];
        return [points.map((pt) => [pt.x, pt.y])];
      }
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < segments; i += 1) {
        const theta = (i / segments) * Math.PI * 2;
        const px = centerX + (width / 2) * Math.cos(theta);
        const py = centerY + (height / 2) * Math.sin(theta);
        points.push(rotate(px, py));
      }
      return [points.map((pt) => [pt.x, pt.y])];
    };
    const polyA = toPolygon(a);
    const polyB = toPolygon(b);
    let result: number[][][][] = [];
    switch (operation) {
      case 'union':
        result = polygonClipping.union([polyA], [polyB]);
        break;
      case 'subtract':
        result = polygonClipping.difference([polyA], [polyB]);
        break;
      case 'intersect':
        result = polygonClipping.intersection([polyA], [polyB]);
        break;
      case 'exclude':
        result = polygonClipping.xor([polyA], [polyB]);
        break;
      default:
        result = [];
    }
    if (!result.length) {
      setExportError('Boolean result is empty.');
      return;
    }
    const allPoints = result.flatMap((poly) => poly.flat());
    const xs = allPoints.map((pt) => pt[0]);
    const ys = allPoints.map((pt) => pt[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const toPath = (ring: number[][]) =>
      ring
        .map((pt, index) =>
          `${index === 0 ? 'M' : 'L'} ${(pt[0] - minX).toFixed(2)} ${(pt[1] - minY).toFixed(2)}`
        )
        .join(' ') + ' Z';
    const pathData = result
      .map((poly) => poly.map((ring) => toPath(ring)).join(' '))
      .join(' ');
    deleteNode(a.id);
    deleteNode(b.id);
    const resultNode: Node = {
      id: createId(),
      name: getNextNameForBase(document.frames, 'Boolean Result'),
      type: 'path',
      parentId: null,
      locked: false,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: Math.max(a.opacity, b.opacity),
      visible: true,
      fill: a.fill ?? '#111111',
      stroke: a.stroke ?? null,
      strokeWidth: a.strokeWidth ?? null,
      cornerRadius: null,
      zIndex: Math.max(a.zIndex, b.zIndex),
      bind: null,
      pathData
    };
    handleAddNodes([resultNode]);
    selectNode(resultNode.id);
    setExportStatus('Boolean operation applied.');
  };

  const booleanEligible = Boolean(getBooleanNodes());
  const svgExportEnabled = Boolean(
    selectedNode && ['rect', 'ellipse', 'path'].includes(selectedNode.type)
  );

  const handleQueueRender = () => {
    alert('Queue render is not available in V1.');
  };

  const handlePublish = () => {
    alert('Publish preview is not available in V1.');
  };

  const handleOpenTemplates = () => {
    const names = templates.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
    const input = prompt(`Templates:\n${names}\nEnter number`, '1');
    if (!input) return;
    const index = Number(input) - 1;
    const template = templates[index];
    if (!template) return;
    const frame1 = {
      id: `tpl-${Date.now()}-1`,
      name: 'Frame 1',
      isHold: false,
      x: 0,
      y: 0,
      width: 960,
      height: 540,
      background: '#ffffff',
      duration: 300,
      nodes: [],
      variants: [],
      responsiveRules: []
    };
    const frame2 = {
      ...frame1,
      id: `tpl-${Date.now()}-2`,
      name: 'Frame 2'
    };
    const doc = {
      ...document,
      name: template.name,
      frames: [frame1, frame2],
      transitions: [],
      startFrameId: frame1.id
    };
    setDocument(doc);
  };

  const handleOpenAssets = async () => {
    const names = library.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
    const input = prompt(`Assets:\n${names}\nEnter number`, '1');
    if (!input) return;
    const index = Number(input) - 1;
    const asset = library[index];
    if (!asset) return;
    if (asset.type === 'svg') {
      const text = await fetch(asset.path).then((res) => res.text());
      importSvg(text);
    }
  };

  const openContextMenu = (input: {
    x: number;
    y: number;
    targetId: string | null;
    targetType: 'node' | 'frame';
  }) => {
    setContextMenu({ open: true, ...input });
  };

  const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, open: false }));

  const contextTargetNode = contextMenu.targetId
    ? activeFrame.nodes.find((node) => node.id === contextMenu.targetId) ?? null
    : null;

  const handleCopySelected = () => {
    if (frameSelected) {
      clipboardRef.current = { kind: 'frame', frameId: activeFrame.id };
      setClipboardCount(1);
      return;
    }
    if (!selectedNode) return;
    clipboardRef.current = { kind: 'nodes', nodes: [{ ...selectedNode }] };
    setClipboardCount(clipboardRef.current.nodes.length);
  };

  const handlePasteSelected = () => {
    if (!clipboardRef.current) return;
    if (clipboardRef.current.kind === 'frame') {
      const source = document.frames.find((frame) => frame.id === clipboardRef.current?.frameId);
      if (!source) {
        setExportError('Copied frame no longer exists.');
        return;
      }
      duplicateFrameAtPosition(source.id, source.x + 250, source.y);
      return;
    }
    const clones = clipboardRef.current.nodes.map((node, index) => ({
      ...node,
      id: createId(),
      name: getNextNodeName(node),
      x: node.x + 40 + index * 4,
      y: node.y,
      locked: false
    }));
    handleAddNodes(clones);
  };

  const handleDuplicateSelected = () => {
    if (frameSelected) {
      duplicateFrame();
      return;
    }
    const target = selectedNode ?? displayFrame.nodes.find((node) => node.id === lastCreatedNodeIdRef.current);
    if (!target) return;
    duplicateNodeWithOffset(target, 40);
  };

  const handleDeleteSelected = () => {
    if (frameSelected) {
      deleteFrame(activeFrame.id);
      setFrameSelected(false);
      return;
    }
    if (!selectedNode) return;
    deleteNode(selectedNode.id);
  };

  const handleReplayOnboarding = () => {
    window.localStorage.removeItem('dm_onboarding_done');
    setShowOnboarding(true);
  };

  const handleDuplicateNode = () => {
    if (contextMenu.targetType === 'frame') {
      const targetId = contextMenu.targetId ?? activeFrame.id;
      const targetFrame = document.frames.find((item) => item.id === targetId);
      duplicateFrameAtPosition(targetId, targetFrame?.x ?? 0, targetFrame?.y ?? 0);
      closeContextMenu();
      return;
    }
    if (!contextTargetNode) return;
    duplicateNodeWithOffset(contextTargetNode, 40);
    closeContextMenu();
  };

  const handleDeleteContext = () => {
    if (contextMenu.targetType === 'frame') {
      const targetId = contextMenu.targetId ?? activeFrame.id;
      deleteFrame(targetId);
      closeContextMenu();
      return;
    }
    if (!contextTargetNode) return;
    deleteNode(contextTargetNode.id);
    closeContextMenu();
  };

  const handleRename = () => {
    if (contextMenu.targetType === 'frame') {
      const targetId = contextMenu.targetId ?? activeFrame.id;
      const targetFrame = document.frames.find((item) => item.id === targetId) ?? activeFrame;
      const next = prompt('Rename frame', targetFrame.name);
      if (next) updateFrameName(targetId, next);
      closeContextMenu();
      return;
    }
    if (!contextTargetNode) return;
    const next = prompt('Rename layer', contextTargetNode.name);
    if (next) updateNode(contextTargetNode.id, { name: next });
    closeContextMenu();
  };

  const handleCopy = () => {
    if (contextMenu.targetType === 'frame') {
      const targetId = contextMenu.targetId ?? activeFrame.id;
      clipboardRef.current = { kind: 'frame', frameId: targetId };
      setClipboardCount(1);
      closeContextMenu();
      return;
    }
    if (!contextTargetNode) return;
    clipboardRef.current = { kind: 'nodes', nodes: [{ ...contextTargetNode }] };
    setClipboardCount(clipboardRef.current.nodes.length);
    closeContextMenu();
  };

  const handlePaste = () => {
    if (!clipboardRef.current) return;
    if (clipboardRef.current.kind === 'frame') {
      const source = document.frames.find((frame) => frame.id === clipboardRef.current?.frameId);
      if (!source) {
        setExportError('Copied frame no longer exists.');
        closeContextMenu();
        return;
      }
      duplicateFrameAtPosition(source.id, source.x + 250, source.y);
      closeContextMenu();
      return;
    }
    const clones = clipboardRef.current.nodes.map((node, index) => ({
      ...node,
      id: createId(),
      name: getNextNodeName(node),
      x: node.x + 40 + index * 4,
      y: node.y,
      locked: false
    }));
    handleAddNodes(clones);
    closeContextMenu();
  };

  const handleFlip = (axis: 'horizontal' | 'vertical') => {
    if (!contextTargetNode) return;
    if (axis === 'horizontal') {
      updateNode(contextTargetNode.id, {
        scaleX: contextTargetNode.scaleX * -1,
        x: contextTargetNode.x + contextTargetNode.width
      });
    } else {
      updateNode(contextTargetNode.id, {
        scaleY: contextTargetNode.scaleY * -1,
        y: contextTargetNode.y + contextTargetNode.height
      });
    }
    closeContextMenu();
  };

  const handleCreateComponent = () => {
    if (!contextTargetNode) return;
    createSymbolFromNode(contextTargetNode.id);
    closeContextMenu();
  };

  const handleInsertComponent = () => {
    if (!document.symbols.length) return;
    const names = document.symbols.map((item, index) => `${index + 1}. ${item.name}`).join('\n');
    const input = prompt(`Insert Component:\n${names}\nEnter number`, '1');
    if (!input) return;
    const index = Number(input) - 1;
    const symbol = document.symbols[index];
    if (!symbol) return;
    insertSymbolInstance(symbol.id);
    closeContextMenu();
  };

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (!contextMenu.open) return;
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.open]);

  useEffect(() => {
    if (activeVariantId) return;
    if (!activeFrame.responsiveRules.length) return;
    const applyRules = () => {
      const width = window.innerWidth;
      const match = activeFrame.responsiveRules.find(
        (rule) => width >= rule.minWidth && width <= rule.maxWidth
      );
      if (match) setActiveVariant(match.variantId);
    };
    applyRules();
    window.addEventListener('resize', applyRules);
    return () => window.removeEventListener('resize', applyRules);
  }, [activeFrame.responsiveRules, activeVariantId, setActiveVariant]);

  const handlePlay = () => {
    if (!playMode) setPlayMode(true);
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);
  const handlePlayFromStart = () => {
    if (!playMode) setPlayMode(true);
    setPlayTime(0);
    setPlaying(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (isTyping) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase();
        if (key === 'z' && event.shiftKey) {
          event.preventDefault();
          redo();
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          undo();
          return;
        }
        if (key === 'n') {
          event.preventDefault();
          resetDocument();
          return;
        }
        if (key === 'c') {
          event.preventDefault();
          handleCopySelected();
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          handlePasteSelected();
          return;
        }
        if (key === 'd') {
          event.preventDefault();
          handleDuplicateSelected();
          return;
        }
      }
      if (event.code === 'Space') {
        if (!playMode) return;
        event.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteSelected();
        return;
      }
      if (playMode) return;
      if (event.key.length === 1) {
        const key = event.key.toLowerCase();
        if (key === 'v') setActiveTool('select');
        if (key === 'f') setActiveTool('frame');
        if (key === 'r') setActiveTool('rect');
        if (key === 'o') setActiveTool('ellipse');
        if (key === 'l') setActiveTool('line');
        if (key === 't') setActiveTool('text');
        if (key === 'p' && event.shiftKey) setActiveTool('pencil');
        if (key === 'p' && !event.shiftKey) setActiveTool('pen');
        if (key === 'i') setActiveTool('image');
        if (key === 'c') setActiveTool('connector');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCopySelected,
    handleDeleteSelected,
    handleDuplicateSelected,
    handlePasteSelected,
    handlePause,
    handlePlay,
    isPlaying,
    playMode,
    resetDocument
  ]);

  const commandMenus = useMemo<Record<string, CommandItem[]>>(() => {
    const exportMenu: CommandItem[] = [
      {
        id: 'export-runtime',
        label: 'Export Runtime',
        group: 'Export',
        keywords: ['export', 'runtime', 'json', 'embed', 'webflow'],
        enabled: true,
        onSelect: handleExportRuntime
      },
      {
        id: 'export-png',
        label: 'Export PNG',
        group: 'Export',
        keywords: ['export', 'png', 'image', 'frame'],
        enabled: true,
        onSelect: handleExportPng
      },
      {
        id: 'export-svg',
        label: 'Export SVG (Selected)',
        group: 'Export',
        keywords: ['export', 'svg', 'vector', 'shape'],
        enabled: svgExportEnabled,
        reason: svgExportEnabled ? undefined : 'Select a rectangle, ellipse, or path',
        onSelect: handleExportSvg
      },
      {
        id: 'export-mp4',
        label: 'Export MP4/GIF',
        group: 'Export',
        keywords: ['export', 'mp4', 'gif', 'video'],
        enabled: false,
        reason: 'Coming soon'
      }
    ];

    const performanceMenu: CommandItem[] = [
      {
        id: 'renderer-canvas',
        label: 'Renderer: Canvas2D',
        group: 'Performance',
        keywords: ['renderer', 'canvas', 'performance'],
        enabled: true,
        onSelect: () => setWebglEnabled(false)
      },
      {
        id: 'renderer-webgl',
        label: 'Renderer: WebGL',
        group: 'Performance',
        keywords: ['renderer', 'webgl', 'performance'],
        enabled: false,
        reason: 'Available in V2'
      }
    ];

    const rootMenu: CommandItem[] = [
      {
        id: 'file-new',
        label: 'New File',
        group: 'File',
        keywords: ['new', 'file', 'document', 'create'],
        shortcut: 'Ctrl/Cmd + N',
        enabled: true,
        onSelect: resetDocument
      },
      {
        id: 'file-open',
        label: 'Open...',
        group: 'File',
        keywords: ['open', 'file'],
        enabled: true,
        onSelect: handleOpenDmx
      },
      {
        id: 'file-save',
        label: 'Save',
        group: 'File',
        keywords: ['save'],
        enabled: true,
        onSelect: handleSave
      },
      {
        id: 'file-save-as',
        label: 'Save As...',
        group: 'File',
        keywords: ['save', 'save as'],
        enabled: true,
        onSelect: handleSaveAs
      },
      {
        id: 'file-export',
        label: 'Export >',
        group: 'File',
        keywords: ['export', 'runtime', 'png', 'gif', 'mp4'],
        enabled: true,
        submenu: 'export'
      },
      {
        id: 'edit-undo',
        label: 'Undo',
        group: 'Edit',
        keywords: ['undo'],
        shortcut: 'Ctrl/Cmd + Z',
        enabled: history.past.length > 0,
        reason: history.past.length > 0 ? undefined : 'Nothing to undo',
        onSelect: undo
      },
      {
        id: 'edit-redo',
        label: 'Redo',
        group: 'Edit',
        keywords: ['redo'],
        shortcut: 'Ctrl/Cmd + Shift + Z',
        enabled: history.future.length > 0,
        reason: history.future.length > 0 ? undefined : 'Nothing to redo',
        onSelect: redo
      },
      {
        id: 'edit-cut',
        label: 'Cut',
        group: 'Edit',
        keywords: ['cut'],
        shortcut: 'Ctrl/Cmd + X',
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'edit-copy',
        label: 'Copy',
        group: 'Edit',
        keywords: ['copy'],
        shortcut: 'Ctrl/Cmd + C',
        enabled: Boolean(selectedNode || frameSelected),
        reason: selectedNode || frameSelected ? undefined : 'Select a layer or frame first',
        onSelect: handleCopySelected
      },
      {
        id: 'edit-paste',
        label: 'Paste',
        group: 'Edit',
        keywords: ['paste'],
        shortcut: 'Ctrl/Cmd + V',
        enabled: clipboardCount > 0,
        reason: clipboardCount > 0 ? undefined : 'Copy a layer or frame first',
        onSelect: handlePasteSelected
      },
      {
        id: 'edit-duplicate',
        label: 'Duplicate',
        group: 'Edit',
        keywords: ['duplicate', 'copy'],
        shortcut: 'Ctrl/Cmd + D',
        enabled: Boolean(selectedNode || frameSelected),
        reason: selectedNode || frameSelected ? undefined : 'Select a layer or frame',
        onSelect: handleDuplicateSelected
      },
      {
        id: 'edit-delete',
        label: 'Delete',
        group: 'Edit',
        keywords: ['delete', 'remove'],
        enabled: Boolean(selectedNode || frameSelected),
        reason: selectedNode || frameSelected ? undefined : 'Select a layer or frame',
        onSelect: handleDeleteSelected
      },
      {
        id: 'view-zoom-in',
        label: 'Zoom In',
        group: 'View',
        keywords: ['zoom in'],
        shortcut: 'Ctrl/Cmd + +',
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'view-zoom-out',
        label: 'Zoom Out',
        group: 'View',
        keywords: ['zoom out'],
        shortcut: 'Ctrl/Cmd + -',
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'view-reset-zoom',
        label: 'Reset Zoom (100%)',
        group: 'View',
        keywords: ['zoom', 'reset'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'view-grid',
        label: 'Toggle Grid',
        group: 'View',
        keywords: ['grid'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'view-guides',
        label: 'Toggle Guides',
        group: 'View',
        keywords: ['guides'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'arrange-forward',
        label: 'Bring Forward',
        group: 'Canvas / Arrange',
        keywords: ['arrange', 'forward'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'arrange-backward',
        label: 'Send Backward',
        group: 'Canvas / Arrange',
        keywords: ['arrange', 'backward'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'arrange-front',
        label: 'Bring to Front',
        group: 'Canvas / Arrange',
        keywords: ['arrange', 'front'],
        enabled: Boolean(selectedNode),
        reason: selectedNode ? undefined : 'Select a layer first',
        onSelect: () => selectedNode && bringNodeToFront(selectedNode.id)
      },
      {
        id: 'arrange-back',
        label: 'Send to Back',
        group: 'Canvas / Arrange',
        keywords: ['arrange', 'back'],
        enabled: Boolean(selectedNode),
        reason: selectedNode ? undefined : 'Select a layer first',
        onSelect: () => selectedNode && sendNodeToBack(selectedNode.id)
      },
      {
        id: 'arrange-group',
        label: 'Group Selection',
        group: 'Canvas / Arrange',
        keywords: ['group'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'arrange-ungroup',
        label: 'Ungroup',
        group: 'Canvas / Arrange',
        keywords: ['ungroup'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'boolean-union',
        label: 'Boolean Union',
        group: 'Canvas / Arrange',
        keywords: ['boolean', 'union', 'combine'],
        enabled: booleanEligible,
        reason: booleanEligible ? undefined : 'Select two rectangles or ellipses',
        onSelect: () => handleBooleanOperation('union')
      },
      {
        id: 'boolean-subtract',
        label: 'Boolean Subtract',
        group: 'Canvas / Arrange',
        keywords: ['boolean', 'subtract', 'difference'],
        enabled: booleanEligible,
        reason: booleanEligible ? undefined : 'Select two rectangles or ellipses',
        onSelect: () => handleBooleanOperation('subtract')
      },
      {
        id: 'boolean-intersect',
        label: 'Boolean Intersect',
        group: 'Canvas / Arrange',
        keywords: ['boolean', 'intersect'],
        enabled: booleanEligible,
        reason: booleanEligible ? undefined : 'Select two rectangles or ellipses',
        onSelect: () => handleBooleanOperation('intersect')
      },
      {
        id: 'boolean-exclude',
        label: 'Boolean Exclude',
        group: 'Canvas / Arrange',
        keywords: ['boolean', 'exclude', 'xor'],
        enabled: booleanEligible,
        reason: booleanEligible ? undefined : 'Select two rectangles or ellipses',
        onSelect: () => handleBooleanOperation('exclude')
      },
      {
        id: 'play-toggle',
        label: isPlaying ? 'Pause' : 'Play',
        group: 'Playback',
        keywords: ['play', 'pause'],
        shortcut: 'Space',
        enabled: true,
        onSelect: () => (isPlaying ? handlePause() : handlePlay())
      },
      {
        id: 'play-restart',
        label: 'Restart',
        group: 'Playback',
        keywords: ['restart', 'playback'],
        enabled: true,
        onSelect: () => {
          if (!playMode) setPlayMode(true);
          setPlayTime(0);
          setPlaying(true);
        }
      },
      {
        id: 'play-loop',
        label: 'Loop Toggle',
        group: 'Playback',
        keywords: ['loop'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'pref-shortcuts',
        label: 'Keyboard Shortcuts',
        group: 'Preferences',
        keywords: ['keyboard', 'shortcuts'],
        enabled: true,
        onSelect: () => setShortcutsOpen(true)
      },
      {
        id: 'pref-performance',
        label: 'Performance >',
        group: 'Preferences',
        keywords: ['performance', 'renderer'],
        enabled: true,
        submenu: 'performance'
      },
      {
        id: 'pref-theme',
        label: 'Theme (Dark/Light)',
        group: 'Preferences',
        keywords: ['theme', 'dark', 'light'],
        enabled: false,
        reason: 'Coming soon'
      },
      {
        id: 'help-tutorial',
        label: 'Quick Tutorial',
        group: 'Help & Account',
        keywords: ['tutorial', 'onboarding'],
        enabled: true,
        onSelect: handleReplayOnboarding
      },
      {
        id: 'help-docs',
        label: 'Documentation',
        group: 'Help & Account',
        keywords: ['docs', 'documentation', 'help'],
        enabled: true,
        onSelect: () => setDocsOpen(true)
      },
      {
        id: 'help-report',
        label: 'Report Issue',
        group: 'Help & Account',
        keywords: ['report', 'issue', 'bug'],
        enabled: true,
        onSelect: () => setReportOpen(true)
      }
    ];

    return {
      root: rootMenu,
      export: exportMenu,
      performance: performanceMenu
    };
  }, [
    booleanEligible,
    clipboardCount,
    frameSelected,
    handleCopySelected,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleExportPng,
    handleExportSvg,
    handleExportRuntime,
    handleBooleanOperation,
    handleOpenDmx,
    handlePasteSelected,
    handleSave,
    handleSaveAs,
    handlePlay,
    handlePause,
    handleReplayOnboarding,
    history,
    isPlaying,
    playMode,
    resetDocument,
    redo,
    selectedNode,
    svgExportEnabled,
    setPlayMode,
    bringNodeToFront,
    sendNodeToBack,
    setWebglEnabled,
    undo
  ]);
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={`app AppRoot ${playMode ? 'is-play' : ''} ${panelMode === 'design' ? 'is-design' : ''} ${panelMode === 'animate' ? 'is-animate' : ''}`}
        data-mode={panelMode}
        data-play={playMode ? 'on' : 'off'}
      >
        <TopBar
          playMode={playMode}
          isPlaying={isPlaying}
          fileName={document.name}
          isStarred={isStarred}
          onRenameFile={handleRenameFile}
          onDuplicateFile={handleDuplicateFile}
          onMoveFile={handleMoveFile}
          onToggleStar={handleToggleStar}
          onOpenVersionHistory={handleVersionHistory}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onOpenFile={handleOpenDmx}
          onExportDmx={handleSaveAs}
          onPlay={handlePlay}
          onPlayFromStart={handlePlayFromStart}
          onPause={handlePause}
          onImportSvg={handleImportSvg}
          onExportRuntime={handleExportRuntime}
          onExportPng={handleExportPng}
          onExportSvg={handleExportSvg}
          collaborationEnabled={document.collaboration.enabled}
          onToggleShare={toggleCollaboration}
          webglEnabled={webglEnabled}
          onToggleWebgl={() => setWebglEnabled((prev) => !prev)}
          onOpenTemplates={handleOpenTemplates}
          onOpenAssets={handleOpenAssets}
          onOpenAdmin={() => setAdminOpen(true)}
          onOpenBilling={() => setBillingOpen(true)}
          onOpenPreferences={handleOpenPreferences}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          activeTool={activeTool}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            if (tool === 'connector') {
              setPanelMode('animate');
            }
            if (tool === 'image') {
              setPendingImagePoint({
                x: displayFrame.width / 2,
                y: displayFrame.height / 2
              });
              imageInputRef.current?.click();
            }
          }}
          onNewFile={resetDocument}
          onRenameFileInline={(name) => updateDocumentName(name)}
          playbackLoop={playbackLoop}
          playbackSpeed={playbackSpeed}
          onToggleLoop={() => setPlaybackLoop((prev) => !prev)}
          onSetPlaybackSpeed={setPlaybackSpeed}
        />

        <LayersPanel
          frames={document.frames}
          activeFrameId={activeFrame.id}
          selectedNodeId={selectedNode?.id ?? null}
          onSelect={selectNode}
          onSelectFrame={(id) => {
            setActiveFrame(id);
            selectNode(null);
            setFrameSelected(true);
          }}
          onRename={(id, name) => updateNode(id, { name })}
          onMove={moveNode}
          onToggleLock={(id) => {
            const node = nodeById.get(id);
            if (!node) return;
            updateNode(id, { locked: !node.locked });
          }}
          onToggleVisible={(id) => {
            const node = nodeById.get(id);
            if (!node) return;
            updateNode(id, { visible: !node.visible });
          }}
          onOpenContextMenu={openContextMenu}
        />

        <CanvasStage
          frame={playMode ? playFrame : displayFrame}
          frames={document.frames}
          activeFrameId={activeFrame.id}
          playFrameId={playStartFrameId}
          nodes={playNodes}
          selectedNodeIds={selectedNodeIds}
          frameSelected={frameSelected}
          symbols={document.symbols}
          onUpdateFramePosition={updateFramePosition}
          onDuplicateFrameAtPosition={duplicateFrameAtPosition}
          onSelectNode={selectNode}
          onUpdateNode={updateNode}
          onAddNodes={handleAddNodes}
          onToolComplete={() => {
            if (activeTool !== 'select' && activeTool !== 'frame' && activeTool !== 'connector') {
              setActiveTool('select');
            }
          }}
          onDropFiles={handleDropFiles}
          onRequestImagePlace={(point) => {
            setPendingImagePoint(point);
            imageInputRef.current?.click();
          }}
          onSelectFrame={(id) => {
            setActiveFrame(id);
            selectNode(null);
            setFrameSelected(true);
          }}
          onDeselectFrame={() => setFrameSelected(false)}
          onOpenContextMenu={openContextMenu}
          playMode={playMode}
          activeTool={activeTool}
          emptyHint={hasNoObjects}
          playHint={showPlayRequiresTransition}
          stageRef={stageRef}
          webglEnabled={webglEnabled}
          webglFrame={playMode ? playFrame : displayFrame}
          webglNodes={playNodes}
          lockAspect={lockAspect}
        />

        <PropertiesPanel
          node={selectedNode}
          selectedNodes={selectedNodes}
          frame={displayFrame}
          frameSelected={frameSelected}
          onUpdate={updateNode}
          onUpdateFrame={updateFrame}
          transition={selectedTransition ?? transition}
          onUpdateOverride={(nodeId, property, easing) =>
            transition ? updateTransitionOverride(transition.id, nodeId, property, easing) : undefined
          }
          onUpdateTransition={(patch) => {
            if (!transition) return;
            updateTransition(transition.id, patch);
          }}
          activeVariantId={activeVariantId}
          onSetVariant={setActiveVariant}
          onAddVariant={addVariant}
          onAddResponsiveRule={addResponsiveRule}
          onUpdateResponsiveRule={updateResponsiveRule}
          stateMachine={document.stateMachine}
          symbols={document.symbols}
          onUpdateSymbolOverride={updateSymbolOverride}
          onAddStateMachineInput={addStateMachineInput}
          onAddStateMachineState={addStateMachineState}
          onAddStateMachineTransition={addStateMachineTransition}
          onSetInitialState={setInitialState}
          skeletons={document.skeletons}
          onAddBone={addBone}
          onUpdateBone={updateBone}
          onAddConstraint={addConstraint}
          onBindNodeToBone={bindNodeToBone}
          onConvertNodeToMesh={convertNodeToMesh}
          onAutoWeightMesh={autoWeightMesh}
          controllers={document.controllers}
          onAddController={addController}
          onUpdateController={updateController}
          animateHint={hasSecondFrame && framesUnchanged}
          playMode={playMode}
          panelMode={panelMode}
          onChangePanelMode={setPanelMode}
          playStartFrameId={playStartFrameId}
          onSetPlayStartFrame={setPlayStartFrame}
          lockAspect={lockAspect}
          onToggleLockAspect={() => setLockAspect((prev) => !prev)}
          lockFrameAspect={lockFrameAspect}
          onToggleLockFrameAspect={() => setLockFrameAspect((prev) => !prev)}
          onExportSvg={handleExportSvg}
          onExportPng={handleExportNodePng}
          canExportSvg={svgExportEnabled}
          onAlignSelection={alignSelection}
        />

        <FramesBar
          frames={document.frames}
          transitions={document.transitions}
          activeFrameId={activeFrame.id}
          onSelect={(id) => {
            setActiveFrame(id);
            selectNode(null);
            setFrameSelected(true);
          }}
          onAdd={addFrame}
          onAddHold={addHoldFrame}
          onDuplicate={duplicateFrame}
          onDelete={deleteFrame}
          onMove={moveFrame}
          onUpdateTransition={updateTransition}
          playTime={playTime}
          timelineDuration={effectiveTimelineDuration}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={(timeMs) => setPlayTime(timeMs)}
          showEmptyHint={needsSecondFrameHint}
          panelMode={panelMode}
          selectedTransitionId={selectedTransition?.id ?? null}
          onSelectTransition={(id) => {
            setSelectedTransitionId(id);
            setPanelMode('animate');
          }}
          onConnectFrames={(fromId, toId) => {
            const id = connectTransition(fromId, toId);
            if (id) {
              setSelectedTransitionId(id);
              setPanelMode('animate');
            }
          }}
        />

        <input
          ref={importInputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          style={{ display: 'none' }}
          onChange={handleImportChange}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <input
          ref={dmxInputRef}
          type="file"
          accept=".dmx"
          style={{ display: 'none' }}
          onChange={handleDmxChange}
        />

        {(warnings.length > 0 || lastError) && (
          <div className="panel right" style={{ gridColumn: '3', gridRow: '2' }}>
            <div className="section-title">Warnings</div>
            {warnings.map((warning, index) => (
              <div key={`${warning}-${index}`} className="notice">
                {warning}
              </div>
            ))}
            {lastError && <div className="error-toast">{lastError}</div>}
          </div>
        )}

        {contextMenu.open && (
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <Button
              variant="menuitem"
              onClick={() => {
                if (contextTargetNode) convertNodeToMesh(contextTargetNode.id);
                closeContextMenu();
              }}
              disabled={!contextTargetNode}
            >
              Convert to Mesh
            </Button>
            <Button
              variant="menuitem"
              onClick={handleCreateComponent}
              disabled={!contextTargetNode}
            >
              Create Component
            </Button>
            <Button
              variant="menuitem"
              onClick={handleInsertComponent}
              disabled={!document.symbols.length}
            >
              Insert Component
            </Button>
            <Button
              variant="menuitem"
              onClick={handleDuplicateNode}
              disabled={!contextTargetNode}
            >
              Duplicate
            </Button>
            <Button
              variant="menuitem"
              onClick={handleDeleteContext}
              disabled={
                contextMenu.targetType === 'frame'
                  ? document.frames.length <= 1
                  : !contextTargetNode
              }
            >
              Delete
            </Button>
            <Button variant="menuitem" onClick={handleRename}>
              Rename
            </Button>
            <Button
              variant="menuitem"
              onClick={() => {
                if (!contextTargetNode) return;
                updateNode(contextTargetNode.id, { locked: !contextTargetNode.locked });
                closeContextMenu();
              }}
              disabled={!contextTargetNode}
            >
              {contextTargetNode?.locked ? 'Unlock' : 'Lock'}
            </Button>
            <Button
              variant="menuitem"
              onClick={() => {
                if (!contextTargetNode) return;
                updateNode(contextTargetNode.id, { visible: !contextTargetNode.visible });
                closeContextMenu();
              }}
              disabled={!contextTargetNode}
            >
              {contextTargetNode?.visible ? 'Hide' : 'Unhide'}
            </Button>
            <Button
              variant="menuitem"
              onClick={handleCopy}
              disabled={
                contextMenu.targetType === 'frame'
                  ? document.frames.length === 0
                  : !contextTargetNode
              }
            >
              Copy
            </Button>
            <Button variant="menuitem" onClick={handlePaste} disabled={!clipboardRef.current}>
              Paste
            </Button>
            <Button
              variant="menuitem"
              onClick={() => {
                if (contextTargetNode) bringNodeToFront(contextTargetNode.id);
                closeContextMenu();
              }}
              disabled={!contextTargetNode}
            >
              Bring to Front
            </Button>
            <Button
              variant="menuitem"
              onClick={() => {
                if (contextTargetNode) sendNodeToBack(contextTargetNode.id);
                closeContextMenu();
              }}
              disabled={!contextTargetNode}
            >
              Send to Back
            </Button>
            <Button variant="menuitem" disabled>
              Group / Ungroup
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleBooleanOperation('union')}
              disabled={!booleanEligible}
            >
              Boolean Union
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleBooleanOperation('subtract')}
              disabled={!booleanEligible}
            >
              Boolean Subtract
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleBooleanOperation('intersect')}
              disabled={!booleanEligible}
            >
              Boolean Intersect
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleBooleanOperation('exclude')}
              disabled={!booleanEligible}
            >
              Boolean Exclude
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleFlip('horizontal')}
              disabled={!contextTargetNode}
            >
              Flip Horizontal
            </Button>
            <Button
              variant="menuitem"
              onClick={() => handleFlip('vertical')}
              disabled={!contextTargetNode}
            >
              Flip Vertical
            </Button>
          </div>
        )}

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} menus={commandMenus} />

        {playMode && (
          <div className="play-shell">
            <div className="play-toolbar">
              <Button onClick={isPlaying ? handlePause : handlePlay}>
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <button
                type="button"
                className="play-close"
                onClick={() => {
                  setPlayMode(false);
                  setPlaying(false);
                  setPlayTime(0);
                }}
                aria-label="Close play mode"
              >
                X
              </button>
            </div>
            <div className="play-spacer" />
            <div className="play-timebar">
              <div className="play-timebar-track">
                <div
                  className="play-timebar-fill"
                  style={{ width: `${playProgress * 100}%` }}
                />
              </div>
              <div className="play-timebar-labels">
                <span>0.00s</span>
                <span>{(playTotalMs / 1000).toFixed(2)}s</span>
              </div>
            </div>
          </div>
        )}

        {saveAsOpen && (
          <div className="modal">
            <div className="modal-card">
              <div className="section-title">Save As (.dmx)</div>
              <div className="notice">Save project as .dmx</div>
              <label className="input-group">
                Filename
                <Input value={saveAsName} onChange={(event) => setSaveAsName(event.target.value)} />
              </label>
              <label className="input-group">
                <input
                  type="checkbox"
                  checked={saveEmbedLargeAssets}
                  onChange={(event) => setSaveEmbedLargeAssets(event.target.checked)}
                />
                Embed large assets (may increase file size)
              </label>
              <label className="input-group">
                <input
                  type="checkbox"
                  checked={saveIncludeEditorState}
                  onChange={(event) => setSaveIncludeEditorState(event.target.checked)}
                />
                Include editor state
              </label>
              <div className="variant-list">
                <Button onClick={handleSaveAsConfirm}>Save</Button>
                <Button variant="ghost" onClick={() => setSaveAsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {shortcutsOpen && (
          <div className="modal" onClick={() => setShortcutsOpen(false)}>
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <div className="section-title">Keyboard Shortcuts</div>
                <Button variant="ghost" onClick={() => setShortcutsOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="shortcuts-list">
                <div className="notice">Command Palette</div>
                <div className="responsive-rule">Actions... - Ctrl/Cmd + K</div>
                <div className="notice">Playback</div>
                <div className="responsive-rule">Play/Pause - Space (Play Mode)</div>
                <div className="notice">Tools</div>
                <div className="responsive-rule">Select - V</div>
                <div className="responsive-rule">Frame - F</div>
                <div className="responsive-rule">Rectangle - R</div>
                <div className="responsive-rule">Ellipse - O</div>
                <div className="responsive-rule">Line - L</div>
                <div className="responsive-rule">Text - T</div>
                <div className="responsive-rule">Pen - P</div>
                <div className="responsive-rule">Pencil - Shift + P</div>
                <div className="responsive-rule">Image - I</div>
                <div className="responsive-rule">Connector - C</div>
              </div>
            </div>
          </div>
        )}

        {docsOpen && (
          <div className="modal">
            <div className="modal-card">
              <div className="section-title">Documentation</div>
              <div className="notice">
                Dream Motion V1 documentation will live here. For now, follow the in-app
                onboarding and tooltips.
              </div>
              <div className="variant-list">
                <Button onClick={() => setDocsOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        {reportOpen && (
          <div className="modal">
            <div className="modal-card">
              <div className="section-title">Report Issue</div>
              <label className="input-group">
                What went wrong?
                <textarea className="Input" rows={4} placeholder="Describe the issue..." />
              </label>
              <div className="variant-list">
                <Button onClick={() => setReportOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        {adminOpen && (
          <div className="modal">
            <div className="modal-card">
              <div className="section-title">Enterprise Controls</div>
              <label className="input-group">
                Roles (comma separated)
                <Input
                  value={document.enterprise.roles.join(', ')}
                  onChange={(event) =>
                    updateEnterprise({
                      roles: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>
              <label className="input-group">
                Permissions (comma separated)
                <Input
                  value={document.enterprise.permissions.join(', ')}
                  onChange={(event) =>
                    updateEnterprise({
                      permissions: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                />
              </label>
              <label className="input-group">
                Audit Log Entry
                <Input
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const value = (event.target as HTMLInputElement).value.trim();
                    if (!value) return;
                    updateEnterprise({ auditLog: [...document.enterprise.auditLog, value] });
                    (event.target as HTMLInputElement).value = '';
                  }}
                />
              </label>
              <div className="variant-list">
                <Button onClick={() => setAdminOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        {billingOpen && (
          <div className="modal">
            <div className="modal-card">
              <div className="section-title">Billing</div>
              <label className="input-group">
                Plan
                <Input
                  value={document.billing.plan}
                  onChange={(event) => updateBilling({ plan: event.target.value })}
                />
              </label>
              <label className="input-group">
                Status
                <select
                  value={document.billing.status}
                  onChange={(event) =>
                    updateBilling({ status: event.target.value as typeof document.billing.status })
                  }
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="past_due">Past Due</option>
                </select>
              </label>
              <label className="input-group">
                Seats
                <Input
                  type="number"
                  value={document.billing.seats}
                  onChange={(event) => updateBilling({ seats: Number(event.target.value) })}
                />
              </label>
              <div className="variant-list">
                <Button onClick={() => setBillingOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}

        <ToastViewport>
          {toastMessage && <Toast variant={toastVariant}>{toastMessage}</Toast>}
          {exportStatus && <Toast>{exportStatus}</Toast>}
          {exportError && <Toast variant="error">{exportError}</Toast>}
        </ToastViewport>

        {showOnboarding && (
          <OnboardingTour
            onComplete={() => {
              window.localStorage.setItem('dm_onboarding_done', '1');
              setShowOnboarding(false);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default App;
