import { create } from 'zustand';
import type {
  DocumentModel,
  Frame,
  Node,
  Transition,
  MotionTrackProperty,
  EasingPreset
} from '@dream-motion/shared';
import {
  DEFAULT_EASING,
  DEFAULT_FRAME_DURATION,
  DEFAULT_TRANSITION_DELAY,
  DEFAULT_TRANSITION_DURATION
} from '@dream-motion/shared';
import { createId } from '../lib/ids';
import { importSvgText, importImageFile } from '../lib/importers';
import { generateMotionModel } from '../lib/autoMotion';
import { flattenSymbols } from '../lib/symbols';
import { sceneSchema, motionSchema } from '@dream-motion/schema';

const getNextFrameName = (frames: Frame[]) => {
  const matchers = frames
    .map((frame) => frame.name.match(/^Frame (\d+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match));
  const maxIndex = matchers.reduce((max, match) => Math.max(max, Number(match[1])), 0);
  return `Frame ${maxIndex + 1}`;
};

const createFrame = (name: string, width: number, height: number, nodes: Node[] = [], isHold = false): Frame => ({
  id: createId(),
  name,
  isHold,
  x: 0,
  y: 0,
  width,
  height,
  background: '#ffffff',
  duration: DEFAULT_FRAME_DURATION,
  nodes,
  variants: [],
  responsiveRules: []
});

const createTransition = (fromFrameId: string, toFrameId: string): Transition => ({
  id: createId(),
  fromFrameId,
  toFrameId,
  duration: DEFAULT_TRANSITION_DURATION,
  delay: DEFAULT_TRANSITION_DELAY,
  easing: DEFAULT_EASING,
  animation: 'auto',
  overrides: [],
  stagger: {
    mode: 'none',
    amount: 0
  }
});

const rebuildTransitions = (frames: Frame[], transitions: Transition[]): Transition[] => {
  const next: Transition[] = [];
  const validFrameIds = new Set(frames.map((frame) => frame.id));
  const existingByFrom = new Map<string, Transition>();
  transitions.forEach((transition) => {
    if (validFrameIds.has(transition.fromFrameId) && validFrameIds.has(transition.toFrameId)) {
      existingByFrom.set(transition.fromFrameId, transition);
    }
  });
  for (let i = 0; i < frames.length - 1; i += 1) {
    const from = frames[i].id;
    const to = frames[i + 1].id;
    const existing = existingByFrom.get(from);
    next.push(existing ?? createTransition(from, to));
  }
  return next;
};

const createDefaultDocument = (): DocumentModel => {
  const frame = createFrame('Frame 1', 960, 540);
  return {
    version: 1,
    name: 'Untitled',
    frames: [frame],
    transitions: [],
    startFrameId: frame.id,
    symbols: [],
    stateMachine: {
      initialStateId: null,
      inputs: [],
      states: [
        {
          id: createId(),
          name: 'State 1',
          frameId: frame.id
        }
      ],
      transitions: []
    },
    collaboration: {
      enabled: false,
      roomId: null,
      participants: []
    },
    skeletons: [
      {
        id: createId(),
        name: 'Rig 1',
        bones: [],
        constraints: []
      }
    ],
    controllers: [],
    enterprise: {
      roles: ['Owner', 'Editor', 'Viewer'],
      permissions: ['view', 'edit', 'export'],
      auditLog: []
    },
    billing: {
      plan: 'starter',
      status: 'trial',
      seats: 3
    },
    metadata: {}
  };
};

type StoreState = {
  document: DocumentModel;
  activeFrameId: string;
  selectedNodeIds: string[];
  frameSelected: boolean;
  activeVariantId: string | null;
  previewMode: boolean;
  isPlaying: boolean;
  previewTime: number;
  warnings: string[];
  lastError: string | null;
  history: {
    past: HistorySnapshot[];
    future: HistorySnapshot[];
  };
  setActiveFrame: (id: string) => void;
  setActiveVariant: (id: string | null) => void;
  setDocument: (doc: DocumentModel) => void;
  setFrameSelected: (value: boolean) => void;
  selectNode: (id: string | null) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
  moveNode: (dragId: string, targetId: string) => void;
  addNodes: (nodes: Node[]) => void;
  deleteNode: (id: string) => void;
  updateFrame: (
    id: string,
    patch: Partial<Pick<Frame, 'name' | 'width' | 'height' | 'background' | 'isHold'>>
  ) => void;
  updateFrameName: (id: string, name: string) => void;
  updateFramePosition: (id: string, x: number, y: number) => void;
  resetDocument: () => void;
  bringNodeToFront: (id: string) => void;
  sendNodeToBack: (id: string) => void;
  addFrame: () => void;
  addHoldFrame: () => void;
  duplicateFrame: () => void;
  duplicateFrameAtPosition: (id: string, x: number, y: number) => void;
  addVariant: () => void;
  addResponsiveRule: () => void;
  updateResponsiveRule: (ruleId: string, patch: Partial<Frame['responsiveRules'][number]>) => void;
  toggleCollaboration: () => void;
  updateSymbolOverride: (instanceId: string, childId: string, patch: Partial<Node>) => void;
  addStateMachineInput: () => void;
  addStateMachineState: () => void;
  addStateMachineTransition: () => void;
  setInitialState: (stateId: string) => void;
  addBone: () => void;
  updateBone: (boneId: string, patch: Partial<DocumentModel['skeletons'][number]['bones'][number]>) => void;
  addConstraint: (constraint: DocumentModel['skeletons'][number]['constraints'][number]) => void;
  bindNodeToBone: (nodeId: string, boneId: string) => void;
  convertNodeToMesh: (nodeId: string) => void;
  autoWeightMesh: (nodeId: string) => void;
  addController: () => void;
  updateController: (controllerId: string, patch: Partial<DocumentModel['controllers'][number]>) => void;
  updateEnterprise: (patch: Partial<DocumentModel['enterprise']>) => void;
  updateBilling: (patch: Partial<DocumentModel['billing']>) => void;
  createSymbolFromNode: (nodeId: string) => void;
  insertSymbolInstance: (symbolId: string) => void;
  deleteFrame: (id: string) => void;
    moveFrame: (id: string, direction: 'left' | 'right') => void;
    connectTransition: (fromFrameId: string, toFrameId: string) => string | null;
    updateTransition: (id: string, patch: Partial<Transition>) => void;
  updateTransitionOverride: (id: string, nodeId: string, property: MotionTrackProperty, easing: EasingPreset | 'inherit') => void;
  togglePreview: () => void;
  setPlaying: (value: boolean) => void;
  setPreviewTime: (value: number) => void;
  importSvg: (svgText: string) => void;
  importImage: (file: File) => Promise<void>;
  exportRuntime: () => { scene: DocumentModel; motion: ReturnType<typeof generateMotionModel> } | null;
  undo: () => void;
  redo: () => void;
};

const initialDocument = createDefaultDocument();

const MAX_HISTORY = 50;

type HistorySnapshot = {
  document: DocumentModel;
  activeFrameId: string;
  selectedNodeIds: string[];
  frameSelected: boolean;
  activeVariantId: string | null;
};

const cloneDocument = (document: DocumentModel): DocumentModel => {
  if (typeof structuredClone === 'function') {
    return structuredClone(document);
  }
  return JSON.parse(JSON.stringify(document)) as DocumentModel;
};

const createSnapshot = (state: StoreState): HistorySnapshot => ({
  document: cloneDocument(state.document),
  activeFrameId: state.activeFrameId,
  selectedNodeIds: [...state.selectedNodeIds],
  frameSelected: state.frameSelected,
  activeVariantId: state.activeVariantId
});

export const useDocumentStore = create<StoreState>((set, get) => {
  const commitDocument = (nextDocument: DocumentModel, extra?: Partial<StoreState>) => {
    const state = get();
    const snapshot = createSnapshot(state);
    const past = [...state.history.past, snapshot];
    if (past.length > MAX_HISTORY) past.shift();
    set({
      ...extra,
      document: nextDocument,
      history: { past, future: [] }
    });
  };

  const restoreSnapshot = (snapshot: HistorySnapshot, history: StoreState['history']) => {
    set({
      document: cloneDocument(snapshot.document),
      activeFrameId: snapshot.activeFrameId,
      selectedNodeIds: snapshot.selectedNodeIds,
      frameSelected: snapshot.frameSelected,
      activeVariantId: snapshot.activeVariantId,
      history
    });
  };

  return ({
  document: initialDocument,
  activeFrameId: initialDocument.startFrameId,
  selectedNodeIds: [],
  frameSelected: false,
  activeVariantId: null,
  previewMode: false,
  isPlaying: false,
  previewTime: 0,
  warnings: [],
  lastError: null,
  history: { past: [], future: [] },
  setActiveFrame: (id) => set({ activeFrameId: id, selectedNodeIds: [], frameSelected: false, activeVariantId: null }),
  setActiveVariant: (id) => set({ activeVariantId: id }),
  setDocument: (doc) =>
    set({
      document: doc,
      activeFrameId: doc.startFrameId,
      selectedNodeIds: [],
      frameSelected: false,
      activeVariantId: null,
      history: { past: [], future: [] }
    }),
  setFrameSelected: (value) => set({ frameSelected: value }),
  selectNode: (id) => set({ selectedNodeIds: id ? [id] : [], frameSelected: false }),
  updateNode: (id, patch) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      return {
        ...frame,
        nodes: frame.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
      };
    });
    commitDocument({ ...document, frames });
  },
  addNodes: (nodes) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const startIndex = frame.nodes.length;
      return {
        ...frame,
        nodes: [...frame.nodes, ...nodes.map((node, index) => ({ ...node, zIndex: startIndex + index }))]
      };
    });
    commitDocument({ ...document, frames });
  },
  deleteNode: (id) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = frame.nodes.filter((node) => node.id !== id);
      return { ...frame, nodes: nodes.map((node, index) => ({ ...node, zIndex: index })) };
    });
    commitDocument({ ...document, frames }, { selectedNodeIds: [] });
  },
  updateFrame: (id, patch) => {
    const { document } = get();
    const frames = document.frames.map((frame) =>
      frame.id === id ? { ...frame, ...patch } : frame
    );
    commitDocument({ ...document, frames });
  },
  updateFrameName: (id, name) => {
    const { document } = get();
    const frames = document.frames.map((frame) =>
      frame.id === id ? { ...frame, name } : frame
    );
    commitDocument({ ...document, frames });
  },
  resetDocument: () => {
    const doc = createDefaultDocument();
    set({
      document: doc,
      activeFrameId: doc.startFrameId,
      selectedNodeIds: [],
      frameSelected: false,
      activeVariantId: null,
      previewMode: false,
      isPlaying: false,
      previewTime: 0,
      warnings: [],
      lastError: null,
      history: { past: [], future: [] }
    });
  },
  updateFramePosition: (id, x, y) => {
    const { document } = get();
    const frames = document.frames.map((frame) =>
      frame.id === id ? { ...frame, x, y } : frame
    );
    commitDocument({ ...document, frames });
  },
  moveNode: (dragId, targetId) => {
    const { document, activeFrameId } = get();
    if (dragId === targetId) return;
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = [...frame.nodes].sort((a, b) => a.zIndex - b.zIndex);
      const fromIndex = nodes.findIndex((node) => node.id === dragId);
      const toIndex = nodes.findIndex((node) => node.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return frame;
      const [moved] = nodes.splice(fromIndex, 1);
      nodes.splice(toIndex, 0, moved);
      return { ...frame, nodes: nodes.map((node, i) => ({ ...node, zIndex: i })) };
    });
    commitDocument({ ...document, frames });
  },
  bringNodeToFront: (id) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = [...frame.nodes].sort((a, b) => a.zIndex - b.zIndex);
      const index = nodes.findIndex((node) => node.id === id);
      if (index === -1) return frame;
      const [node] = nodes.splice(index, 1);
      nodes.push(node);
      return { ...frame, nodes: nodes.map((item, i) => ({ ...item, zIndex: i })) };
    });
    commitDocument({ ...document, frames });
  },
  sendNodeToBack: (id) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = [...frame.nodes].sort((a, b) => a.zIndex - b.zIndex);
      const index = nodes.findIndex((node) => node.id === id);
      if (index === -1) return frame;
      const [node] = nodes.splice(index, 1);
      nodes.unshift(node);
      return { ...frame, nodes: nodes.map((item, i) => ({ ...item, zIndex: i })) };
    });
    commitDocument({ ...document, frames });
  },
  addFrame: () => {
    const { document, activeFrameId } = get();
    const current = document.frames.find((frame) => frame.id === activeFrameId);
    if (!current) return;
    const nextFrame = createFrame(`Frame ${document.frames.length + 1}`, current.width, current.height, current.nodes.map((node) => ({ ...node })));
    const frames = [...document.frames, nextFrame];
    const transitions = rebuildTransitions(frames, document.transitions);
    commitDocument(
      { ...document, frames, transitions },
      { activeFrameId: nextFrame.id, selectedNodeIds: [] }
    );
  },
  addHoldFrame: () => {
    const { document, activeFrameId } = get();
    const index = document.frames.findIndex((frame) => frame.id === activeFrameId);
    if (index === -1) return;
    const current = document.frames[index];
    const holdFrame = createFrame(
      `Hold ${current.name}`,
      current.width,
      current.height,
      current.nodes.map((node) => ({ ...node })),
      true
    );
    const frames = [...document.frames];
    frames.splice(index + 1, 0, holdFrame);
    const transitions = rebuildTransitions(frames, document.transitions);
    commitDocument(
      { ...document, frames, transitions },
      { activeFrameId: holdFrame.id }
    );
  },
  addVariant: () => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const variant = {
        id: createId(),
        name: `${frame.name} Variant ${frame.variants.length + 1}`,
        width: frame.width,
        height: frame.height,
        nodes: frame.nodes.map((node) => ({ ...node }))
      };
      return { ...frame, variants: [...frame.variants, variant] };
    });
    commitDocument({ ...document, frames });
  },
  addResponsiveRule: () => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      if (!frame.variants.length) return frame;
      const rule = {
        id: createId(),
        minWidth: 0,
        maxWidth: frame.width,
        variantId: frame.variants[0].id
      };
      return { ...frame, responsiveRules: [...frame.responsiveRules, rule] };
    });
    commitDocument({ ...document, frames });
  },
  updateResponsiveRule: (ruleId, patch) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const responsiveRules = frame.responsiveRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule
      );
      return { ...frame, responsiveRules };
    });
    commitDocument({ ...document, frames });
  },
  toggleCollaboration: () => {
    const { document } = get();
    const enabled = !document.collaboration.enabled;
    const collaboration = {
      ...document.collaboration,
      enabled,
      roomId: enabled ? `room-${createId()}` : null
    };
    commitDocument({ ...document, collaboration });
  },
  updateSymbolOverride: (instanceId, childId, patch) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = frame.nodes.map((node) => {
        if (node.id !== instanceId || node.type !== 'symbol') return node;
        const overrides = node.overrides.filter((item) => item.nodeId !== childId);
        overrides.push({ nodeId: childId, patch });
        return { ...node, overrides };
      });
      return { ...frame, nodes };
    });
    commitDocument({ ...document, frames });
  },
  addStateMachineInput: () => {
    const { document } = get();
    const input = {
      id: createId(),
      name: `Input ${document.stateMachine.inputs.length + 1}`,
      type: 'boolean' as const,
      defaultValue: false
    };
    commitDocument({
      ...document,
      stateMachine: {
        ...document.stateMachine,
        inputs: [...document.stateMachine.inputs, input]
      }
    });
  },
  addStateMachineState: () => {
    const { document, activeFrameId } = get();
    const state = {
      id: createId(),
      name: `State ${document.stateMachine.states.length + 1}`,
      frameId: activeFrameId
    };
    commitDocument({
      ...document,
      stateMachine: {
        ...document.stateMachine,
        states: [...document.stateMachine.states, state],
        initialStateId: document.stateMachine.initialStateId ?? state.id
      }
    });
  },
  addStateMachineTransition: () => {
    const { document } = get();
    const fromState = document.stateMachine.states[0];
    const toState = document.stateMachine.states[1];
    const input = document.stateMachine.inputs[0];
    if (!fromState || !toState || !input) return;
    const transition = {
      id: createId(),
      fromStateId: fromState.id,
      toStateId: toState.id,
      inputId: input.id,
      condition: 'true'
    };
    commitDocument({
      ...document,
      stateMachine: {
        ...document.stateMachine,
        transitions: [...document.stateMachine.transitions, transition]
      }
    });
  },
  setInitialState: (stateId) => {
    const { document } = get();
    commitDocument({
      ...document,
      stateMachine: {
        ...document.stateMachine,
        initialStateId: stateId
      }
    });
  },
  addBone: () => {
    const { document } = get();
    const skeleton = document.skeletons[0];
    if (!skeleton) return;
    const bone = {
      id: createId(),
      name: `Bone ${skeleton.bones.length + 1}`,
      parentId: null,
      x: 100,
      y: 100,
      length: 80,
      rotation: 0
    };
    const skeletons = document.skeletons.map((item) =>
      item.id === skeleton.id ? { ...item, bones: [...item.bones, bone] } : item
    );
    commitDocument({ ...document, skeletons });
  },
  updateBone: (boneId, patch) => {
    const { document } = get();
    const skeletons = document.skeletons.map((skeleton) => ({
      ...skeleton,
      bones: skeleton.bones.map((bone) => (bone.id === boneId ? { ...bone, ...patch } : bone))
    }));
    commitDocument({ ...document, skeletons });
  },
  addConstraint: (constraint) => {
    const { document } = get();
    const skeleton = document.skeletons[0];
    if (!skeleton) return;
    const skeletons = document.skeletons.map((item) =>
      item.id === skeleton.id ? { ...item, constraints: [...item.constraints, constraint] } : item
    );
    commitDocument({ ...document, skeletons });
  },
  bindNodeToBone: (nodeId, boneId) => {
    const { document, activeFrameId } = get();
    const skeleton = document.skeletons[0];
    if (!boneId) {
      const frames = document.frames.map((frame) => {
        if (frame.id !== activeFrameId) return frame;
        const nodes = frame.nodes.map((node) =>
          node.id === nodeId ? { ...node, bind: null } : node
        );
        return { ...frame, nodes };
      });
      commitDocument({ ...document, frames });
      return;
    }
    const bone = skeleton?.bones.find((item) => item.id === boneId);
    if (!bone) return;
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = frame.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          bind: {
            boneId,
            offsetX: node.x - bone.x,
            offsetY: node.y - bone.y,
            offsetRotation: node.rotation - bone.rotation
          }
        };
      });
      return { ...frame, nodes };
    });
    commitDocument({ ...document, frames });
  },
  convertNodeToMesh: (nodeId) => {
    const { document, activeFrameId } = get();
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = frame.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const vertices = [
          0, 0,
          node.width, 0,
          node.width, node.height,
          0, node.height
        ];
        const triangles = [0, 1, 2, 0, 2, 3];
        return {
          ...node,
          type: 'mesh',
          vertices,
          triangles,
          weights: Array(4).fill([])
        };
      });
      return { ...frame, nodes };
    });
    commitDocument({ ...document, frames });
  },
  autoWeightMesh: (nodeId) => {
    const { document, activeFrameId } = get();
    const skeleton = document.skeletons[0];
    if (!skeleton || !skeleton.bones.length) return;
    const bone = skeleton.bones[0];
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      const nodes = frame.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== 'mesh') return node;
        const vertexCount = node.vertices.length / 2;
        const weights = Array.from({ length: vertexCount }, () => [{ boneId: bone.id, weight: 1 }]);
        return { ...node, weights };
      });
      return { ...frame, nodes };
    });
    commitDocument({ ...document, frames });
  },
  addController: () => {
    const { document, activeFrameId } = get();
    const target = document.frames.find((frame) => frame.id === activeFrameId)?.nodes[0];
    if (!target) return;
    const controller = {
      id: createId(),
      name: `Controller ${document.controllers.length + 1}`,
      targetNodeId: target.id,
      property: 'opacity' as const,
      min: 0,
      max: 1
    };
    commitDocument({ ...document, controllers: [...document.controllers, controller] });
  },
  updateController: (controllerId, patch) => {
    const { document } = get();
    const controllers = document.controllers.map((controller) =>
      controller.id === controllerId ? { ...controller, ...patch } : controller
    );
    commitDocument({ ...document, controllers });
  },
  updateEnterprise: (patch) => {
    const { document } = get();
    commitDocument({ ...document, enterprise: { ...document.enterprise, ...patch } });
  },
  updateBilling: (patch) => {
    const { document } = get();
    commitDocument({ ...document, billing: { ...document.billing, ...patch } });
  },
  createSymbolFromNode: (nodeId) => {
    const { document, activeFrameId } = get();
    const frame = document.frames.find((item) => item.id === activeFrameId);
    if (!frame) return;
    const node = frame.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const symbolId = createId();
    const symbolNode = { ...node, x: 0, y: 0 };
    const symbol = {
      id: symbolId,
      name: `${node.name} Component`,
      nodes: [{ ...symbolNode, id: createId() }]
    };
    const instance: Node = {
      ...node,
      type: 'symbol',
      symbolId,
      overrides: [],
      bind: null
    };
    const frames = document.frames.map((item) => {
      if (item.id !== activeFrameId) return item;
      return {
        ...item,
        nodes: item.nodes.map((n) => (n.id === nodeId ? instance : n))
      };
    });
    commitDocument({ ...document, frames, symbols: [...document.symbols, symbol] });
  },
  insertSymbolInstance: (symbolId) => {
    const { document, activeFrameId } = get();
    const symbol = document.symbols.find((item) => item.id === symbolId);
    if (!symbol) return;
    const node: Node = {
      id: createId(),
      name: symbol.name,
      type: 'symbol',
      parentId: null,
      locked: false,
      x: 40,
      y: 40,
      width: 120,
      height: 120,
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
      symbolId,
      overrides: [],
      bind: null
    };
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      return {
        ...frame,
        nodes: [...frame.nodes, { ...node, zIndex: frame.nodes.length }]
      };
    });
    commitDocument({ ...document, frames });
  },
  duplicateFrame: () => {
    const { document, activeFrameId } = get();
    const index = document.frames.findIndex((frame) => frame.id === activeFrameId);
    if (index === -1) return;
    const current = document.frames[index];
    const clone = createFrame(
      getNextFrameName(document.frames),
      current.width,
      current.height,
      current.nodes.map((node) => ({ ...node }))
    );
    clone.x = current.x;
    clone.y = current.y;
    const frames = [...document.frames];
    frames.splice(index + 1, 0, clone);
    const transitions = rebuildTransitions(frames, document.transitions);
    commitDocument(
      { ...document, frames, transitions },
      { activeFrameId: clone.id }
    );
  },
  duplicateFrameAtPosition: (id, x, y) => {
    const { document } = get();
    const index = document.frames.findIndex((frame) => frame.id === id);
    if (index === -1) return;
    const current = document.frames[index];
    const clone = createFrame(
      getNextFrameName(document.frames),
      current.width,
      current.height,
      current.nodes.map((node) => ({ ...node }))
    );
    clone.x = x;
    clone.y = y;
    const frames = [...document.frames];
    frames.splice(index + 1, 0, clone);
    const transitions = rebuildTransitions(frames, document.transitions);
    commitDocument(
      { ...document, frames, transitions },
      { activeFrameId: clone.id }
    );
  },
  deleteFrame: (id) => {
    const { document, activeFrameId } = get();
    if (document.frames.length <= 1) return;
    const frames = document.frames.filter((frame) => frame.id !== id);
    const transitions = rebuildTransitions(frames, document.transitions);
    const nextActive = activeFrameId === id ? frames[0].id : activeFrameId;
    commitDocument(
      { ...document, frames, transitions },
      { activeFrameId: nextActive }
    );
  },
  moveFrame: (id, direction) => {
    const { document } = get();
    const index = document.frames.findIndex((frame) => frame.id === id);
    if (index === -1) return;
    const swapIndex = direction === 'left' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= document.frames.length) return;
    const frames = [...document.frames];
    const [frame] = frames.splice(index, 1);
    frames.splice(swapIndex, 0, frame);
    const transitions = rebuildTransitions(frames, document.transitions);
    commitDocument({ ...document, frames, transitions });
  },
  connectTransition: (fromFrameId, toFrameId) => {
    const { document } = get();
    if (fromFrameId === toFrameId) return null;
    const existing = document.transitions.find((transition) => transition.fromFrameId === fromFrameId);
    if (existing) {
      const transitions = document.transitions.map((transition) =>
        transition.id === existing.id ? { ...transition, toFrameId } : transition
      );
      commitDocument({ ...document, transitions });
      return existing.id;
    }
    const nextTransition = {
      ...createTransition(fromFrameId, toFrameId),
      animation: 'auto'
    };
    commitDocument({ ...document, transitions: [...document.transitions, nextTransition] });
    return nextTransition.id;
  },
  updateTransition: (id, patch) => {
    const { document } = get();
    const transitions = document.transitions.map((transition) =>
      transition.id === id ? { ...transition, ...patch } : transition
    );
    commitDocument({ ...document, transitions });
  },
  updateTransitionOverride: (id, nodeId, property, easing) => {
    const { document } = get();
    const transitions = document.transitions.map((transition) => {
      if (transition.id !== id) return transition;
      const overrides = transition.overrides.filter(
        (override) => !(override.nodeId === nodeId && override.property === property)
      );
      if (easing !== 'inherit') {
        overrides.push({ nodeId, property, easing });
      }
      return { ...transition, overrides };
    });
    commitDocument({ ...document, transitions });
  },
  togglePreview: () => {
    const { previewMode } = get();
    set({ previewMode: !previewMode, isPlaying: false, previewTime: 0 });
  },
  setPlaying: (value) => set({ isPlaying: value }),
  setPreviewTime: (value) => set({ previewTime: value }),
  undo: () => {
    const state = get();
    const past = state.history.past;
    if (!past.length) return;
    const previous = past[past.length - 1];
    const current = createSnapshot(state);
    const future = [current, ...state.history.future];
    const nextHistory = { past: past.slice(0, -1), future };
    restoreSnapshot(previous, nextHistory);
  },
  redo: () => {
    const state = get();
    const future = state.history.future;
    if (!future.length) return;
    const next = future[0];
    const current = createSnapshot(state);
    const past = [...state.history.past, current];
    if (past.length > MAX_HISTORY) past.shift();
    const nextHistory = { past, future: future.slice(1) };
    restoreSnapshot(next, nextHistory);
  },
  importSvg: (svgText) => {
    const { document, activeFrameId } = get();
    const result = importSvgText(svgText);
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      return {
        ...frame,
        width: result.width || frame.width,
        height: result.height || frame.height,
        nodes: result.nodes.map((node, index) => ({ ...node, zIndex: index }))
      };
    });
    commitDocument(
      { ...document, frames },
      { warnings: result.warnings }
    );
  },
  importImage: async (file) => {
    const { document, activeFrameId } = get();
    const node = await importImageFile(file);
    const frames = document.frames.map((frame) => {
      if (frame.id !== activeFrameId) return frame;
      return {
        ...frame,
        nodes: [...frame.nodes, { ...node, zIndex: frame.nodes.length }]
      };
    });
    commitDocument({ ...document, frames });
  },
  exportRuntime: () => {
    const { document } = get();
    const normalized = {
      ...document,
      frames: document.frames.map((frame) => ({
        ...frame,
        x: frame.x ?? 0,
        y: frame.y ?? 0
      }))
    };
    const flattened = flattenSymbols(normalized);
    const motion = generateMotionModel(flattened);
    const sceneParse = sceneSchema.safeParse(flattened);
    const motionParse = motionSchema.safeParse(motion);
    if (!sceneParse.success || !motionParse.success) {
      const errors = [
        ...(sceneParse.success ? [] : sceneParse.error.errors.map((err) => err.message)),
        ...(motionParse.success ? [] : motionParse.error.errors.map((err) => err.message))
      ];
      set({ warnings: errors, lastError: errors.join(' | ') });
      return null;
    }
    set({ warnings: [], lastError: null });
    return { scene: flattened, motion };
  }
  });
});
