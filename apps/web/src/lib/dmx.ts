import type {
  DocumentModel,
  DmxAsset,
  DmxDocument,
  DmxEditorState,
  DmxFrame,
  DmxTransition,
  Frame,
  Node,
  Transition
} from '@dream-motion/shared';
import { DEFAULT_EASING } from '@dream-motion/shared';
import { createId } from './ids';
import pako from 'pako';

const FORMAT = 'dmx';
const FORMAT_VERSION = '1.0.0';
const EMBED_THRESHOLD_BYTES = 200 * 1024;

type SaveOptions = {
  filename: string;
  embedLargeAssets: boolean;
  includeEditorState: boolean;
  editorState: DmxEditorState | null;
};

const estimateDataUrlBytes = (dataUrl: string) => {
  const match = dataUrl.match(/base64,(.*)$/);
  if (!match) return dataUrl.length;
  const base64 = match[1];
  return Math.floor((base64.length * 3) / 4);
};

const createAssetFromSrc = (
  src: string,
  embedLargeAssets: boolean,
  existing: Map<string, DmxAsset>
) => {
  const existingAsset = existing.get(src);
  if (existingAsset) return existingAsset;
  const isDataUrl = src.startsWith('data:');
  const byteSize = isDataUrl ? estimateDataUrlBytes(src) : src.length;
  const shouldEmbed = isDataUrl && (embedLargeAssets || byteSize <= EMBED_THRESHOLD_BYTES);
  const mimeMatch = isDataUrl ? src.match(/^data:([^;]+);/) : null;
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const type = mimeType.includes('svg')
    ? 'svg'
    : mimeType.includes('png')
    ? 'png'
    : mimeType.includes('jpeg') || mimeType.includes('jpg')
    ? 'jpg'
    : 'png';
  const asset: DmxAsset = {
    id: `asset_${createId()}`,
    type,
    mimeType,
    name: 'asset',
    byteSize,
    storage: shouldEmbed ? 'embedded' : 'external',
    data: shouldEmbed ? src : undefined,
    externalRef: shouldEmbed ? undefined : src
  };
  existing.set(src, asset);
  return asset;
};

const serializeNodes = (
  nodes: Node[],
  embedLargeAssets: boolean,
  assets: Map<string, DmxAsset>
) =>
  nodes.map((node) => {
    if (node.type !== 'image') return node;
    const asset = createAssetFromSrc(node.src, embedLargeAssets, assets);
    return {
      ...node,
      src: `asset://${asset.id}`
    };
  });

const serializeFrame = (
  frame: Frame,
  orderIndex: number,
  embedLargeAssets: boolean,
  assets: Map<string, DmxAsset>
): DmxFrame => {
  const variants = [
    { id: 'base', name: 'Base', isBase: true },
    ...frame.variants.map((variant) => ({ id: variant.id, name: variant.name, isBase: false }))
  ];
  const layersByVariant: Record<string, Node[]> = {
    base: serializeNodes(frame.nodes, embedLargeAssets, assets)
  };
  frame.variants.forEach((variant) => {
    layersByVariant[variant.id] = serializeNodes(variant.nodes, embedLargeAssets, assets);
  });
  return {
    id: frame.id,
    name: frame.name,
    orderIndex,
    durationMs: frame.duration,
    isHold: frame.isHold,
    width: frame.width,
    height: frame.height,
    background: frame.background ?? 'transparent',
    variants,
    responsiveRules: frame.responsiveRules,
    layersByVariant
  };
};

const serializeTransition = (transition: Transition): DmxTransition => ({
  id: transition.id,
  fromFrameId: transition.fromFrameId,
  toFrameId: transition.toFrameId,
  durationMs: transition.duration,
  delayMs: transition.delay,
  animationType: transition.animation ?? 'auto',
  easingPreset: transition.easing ?? DEFAULT_EASING
});

export const buildDmx = (document: DocumentModel, options: SaveOptions) => {
  const assets = new Map<string, DmxAsset>();
  const frames = document.frames.map((frame, index) =>
    serializeFrame(frame, index, options.embedLargeAssets, assets)
  );
  const dmx: DmxDocument = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    app: {
      name: 'Dream Motion',
      build: 'v1'
    },
    meta: {
      documentId: String(document.metadata?.documentId ?? createId()),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    settings: {
      canvas: {
        width: frames[0]?.width ?? 960,
        height: frames[0]?.height ?? 540,
        background: frames[0]?.background ?? 'transparent'
      },
      fps: 60,
      grid: { enabled: true, size: 8 },
      guides: { enabled: true }
    },
    assets: Object.fromEntries(Array.from(assets.values()).map((asset) => [asset.id, asset])),
    frames,
    transitions: document.transitions.map(serializeTransition),
    playStartFrameId: document.startFrameId,
    editor: options.includeEditorState ? options.editorState ?? undefined : undefined
  };
  return dmx;
};

export const migrateDmx = (dmx: DmxDocument): DmxDocument => dmx;

export const compressDmx = (payload: string) => {
  const data = new TextEncoder().encode(payload);
  return pako.gzip(data);
};

export const decompressDmx = (buffer: ArrayBuffer) => {
  const data = pako.ungzip(new Uint8Array(buffer));
  return new TextDecoder().decode(data);
};

const resolveAssetSrc = (asset: DmxAsset | undefined) => {
  if (!asset) return '';
  if (asset.storage === 'embedded' && asset.data) return asset.data;
  return asset.externalRef ?? '';
};

export const hydrateDocumentFromDmx = (dmx: DmxDocument): DocumentModel => {
  const frames: Frame[] = dmx.frames
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((frame) => {
      const baseNodes = frame.layersByVariant.base ?? [];
      const variants = frame.variants
        .filter((variant) => !variant.isBase)
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
          width: frame.width,
          height: frame.height,
          nodes: frame.layersByVariant[variant.id] ?? []
        }));
      const mappedBase = baseNodes.map((node) => {
        if (node.type !== 'image') return node;
        const assetId = node.src.replace('asset://', '');
        return { ...node, src: resolveAssetSrc(dmx.assets[assetId]) };
      });
      const mappedVariants = variants.map((variant) => ({
        ...variant,
        nodes: variant.nodes.map((node) => {
          if (node.type !== 'image') return node;
          const assetId = node.src.replace('asset://', '');
          return { ...node, src: resolveAssetSrc(dmx.assets[assetId]) };
        })
      }));
      return {
        id: frame.id,
        name: frame.name,
        isHold: frame.isHold ?? false,
        x: 0,
        y: 0,
        width: frame.width,
        height: frame.height,
        background: frame.background ?? null,
        duration: frame.durationMs ?? 300,
        nodes: mappedBase,
        variants: mappedVariants,
        responsiveRules: frame.responsiveRules ?? []
      };
    });

  const transitions: Transition[] = dmx.transitions.map((transition) => ({
    id: transition.id,
    fromFrameId: transition.fromFrameId,
    toFrameId: transition.toFrameId,
    duration: transition.durationMs,
    delay: transition.delayMs,
    easing:
      transition.easingPreset === 'easeIn'
        ? 'ease-in'
        : transition.easingPreset === 'easeOut'
        ? 'ease-out'
        : transition.easingPreset === 'easeInOut'
        ? 'ease'
        : transition.easingPreset === 'linear'
        ? 'linear'
        : DEFAULT_EASING,
    animation: transition.animationType ?? 'auto',
    overrides: [],
    stagger: { mode: 'none', amount: 0 }
  }));

  return {
    version: 1,
    name: dmx.app?.name ?? 'Untitled',
    frames,
    transitions,
    startFrameId:
      dmx.playStartFrameId ??
      dmx.editor?.playStartFrameId ??
      dmx.editor?.selectedFrameId ??
      frames[0]?.id ??
      '',
    symbols: [],
    stateMachine: {
      initialStateId: null,
      inputs: [],
      states: frames.map((frame) => ({
        id: createId(),
        name: frame.name,
        frameId: frame.id
      })),
      transitions: []
    },
    collaboration: { enabled: false, roomId: null, participants: [] },
    skeletons: [],
    controllers: [],
    enterprise: { seats: 1, roles: [], permissions: [] },
    billing: { status: 'inactive', plan: 'free', nextInvoiceDate: null },
    metadata: { documentId: dmx.meta?.documentId ?? createId() }
  };
};

export const buildEditorState = (input: {
  activeTool: string;
  selectedFrameId: string | null;
  selectedLayerIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  playMode: boolean;
  panelMode: 'design' | 'animate';
  playStartFrameId: string | null;
}): DmxEditorState => ({
  activeTool: input.activeTool,
  selectedFrameId: input.selectedFrameId,
  selectedLayerIds: input.selectedLayerIds,
  zoom: input.zoom,
  pan: input.pan,
  playMode: input.playMode,
  playStartFrameId: input.playStartFrameId,
  panelMode: input.panelMode
});
