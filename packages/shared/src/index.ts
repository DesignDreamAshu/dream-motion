export type NodeType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'path'
  | 'text'
  | 'image'
  | 'group'
  | 'symbol'
  | 'mesh';

export type EasingPreset =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'spring'
  | 'bounce'
  | 'overshoot';

export type TransitionAnimation =
  | 'auto'
  | 'linear'
  | 'instant'
  | 'dissolve';

export type NodeBase = {
  id: string;
  name: string;
  type: NodeType;
  parentId: string | null;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible: boolean;
  fill: string | null;
  fillOpacity?: number | null;
  stroke: string | null;
  strokeWidth: number | null;
  strokeOpacity?: number | null;
  strokePosition?: 'center' | 'inside' | 'outside' | null;
  lineCap?: 'butt' | 'round' | 'square' | null;
  lineJoin?: 'miter' | 'round' | 'bevel' | null;
  cornerRadius: number | null;
  cornerRadiusTL?: number | null;
  cornerRadiusTR?: number | null;
  cornerRadiusBR?: number | null;
  cornerRadiusBL?: number | null;
  shadowColor?: string | null;
  shadowOpacity?: number | null;
  shadowBlur?: number | null;
  shadowOffsetX?: number | null;
  shadowOffsetY?: number | null;
  blurRadius?: number | null;
  zIndex: number;
  bind: BindInfo | null;
  pivotX?: number | null;
  pivotY?: number | null;
};

export type SymbolOverride = {
  nodeId: string;
  patch: Partial<NodeBase>;
};

export type LineNode = NodeBase & {
  type: 'line';
  points: number[];
};

export type PathNode = NodeBase & {
  type: 'path';
  pathData: string;
  pathPoints?: PathPoint[];
};

export type TextNode = NodeBase & {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string | null;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number | null;
  letterSpacing?: number | null;
};

export type ImageNode = NodeBase & {
  type: 'image';
  src: string;
};

export type ShapeNode = NodeBase & {
  type: 'rect' | 'ellipse';
};

export type GroupNode = NodeBase & {
  type: 'group';
};

export type SymbolInstanceNode = NodeBase & {
  type: 'symbol';
  symbolId: string;
  overrides: SymbolOverride[];
};

export type MeshNode = NodeBase & {
  type: 'mesh';
  vertices: number[];
  triangles: number[];
  weights: BoneWeight[][];
};

export type Node =
  | ShapeNode
  | LineNode
  | PathNode
  | TextNode
  | ImageNode
  | GroupNode
  | SymbolInstanceNode
  | MeshNode;

export type Bone = {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  length: number;
  rotation: number;
};

export type PathPoint = {
  x: number;
  y: number;
  out?: { x: number; y: number };
};

export type BoneWeight = {
  boneId: string;
  weight: number;
};

export type BindInfo = {
  boneId: string;
  offsetX: number;
  offsetY: number;
  offsetRotation: number;
};

export type Constraint =
  | {
      type: 'aim';
      boneId: string;
      targetX: number;
      targetY: number;
    }
  | {
      type: 'ik';
      chain: string[];
      targetX: number;
      targetY: number;
    };

export type Skeleton = {
  id: string;
  name: string;
  bones: Bone[];
  constraints: Constraint[];
};

export type Controller = {
  id: string;
  name: string;
  targetNodeId: string;
  property: MotionTrackProperty;
  min: number;
  max: number;
};

export type SymbolDefinition = {
  id: string;
  name: string;
  nodes: Node[];
};

export type Frame = {
  id: string;
  name: string;
  isHold: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string | null;
  duration: number;
  nodes: Node[];
  variants: FrameVariant[];
  responsiveRules: ResponsiveRule[];
};

export type ResponsiveRule = {
  id: string;
  minWidth: number;
  maxWidth: number;
  variantId: string;
};

export type FrameVariant = {
  id: string;
  name: string;
  width: number;
  height: number;
  nodes: Node[];
};

export type Transition = {
  id: string;
  fromFrameId: string;
  toFrameId: string;
  duration: number;
  delay: number;
  easing: EasingPreset;
  animation: TransitionAnimation;
  overrides: MotionOverride[];
  stagger: StaggerConfig;
};

export type MotionOverride = {
  nodeId: string;
  property: MotionTrackProperty;
  easing: EasingPreset;
};

export type StaggerMode = 'none' | 'order' | 'distance';

export type StaggerConfig = {
  mode: StaggerMode;
  amount: number;
};

export type DocumentModel = {
  version: 1;
  name: string;
  frames: Frame[];
  transitions: Transition[];
  startFrameId: string | null;
  symbols: SymbolDefinition[];
  stateMachine: StateMachine;
  collaboration: CollaborationState;
  skeletons: Skeleton[];
  controllers: Controller[];
  enterprise: EnterpriseControls;
  billing: BillingState;
  metadata: Record<string, unknown>;
  timeline: TimelineModel;
  lastPickedColor?: string | null;
};

export type InputType = 'boolean' | 'number' | 'string' | 'trigger';

export type StateMachineInput = {
  id: string;
  name: string;
  type: InputType;
  defaultValue: boolean | number | string | null;
};

export type State = {
  id: string;
  name: string;
  frameId: string;
};

export type StateTransition = {
  id: string;
  fromStateId: string;
  toStateId: string;
  inputId: string;
  condition: string;
};

export type StateMachine = {
  initialStateId: string | null;
  inputs: StateMachineInput[];
  states: State[];
  transitions: StateTransition[];
};

export type CollaborationState = {
  enabled: boolean;
  roomId: string | null;
  participants: string[];
};

export type EnterpriseControls = {
  roles: string[];
  permissions: string[];
  auditLog: string[];
};

export type BillingState = {
  plan: string;
  status: 'active' | 'trial' | 'past_due';
  seats: number;
};

export type MotionTrackProperty =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'scaleX'
  | 'scaleY'
  | 'opacity'
  | 'cornerRadius'
  | 'lineLength';

export type MotionKeyframe = {
  t: number;
  value: number;
};

export type TimelineProperty =
  | MotionTrackProperty
  | 'fill';

export type TimelineKeyframe = {
  id: string;
  t: number;
  value: number | string;
  easing?: EasingPreset;
};

export type TimelineTrack = {
  id: string;
  nodeId: string;
  property: TimelineProperty;
  keyframes: TimelineKeyframe[];
};

export type TimelineModel = {
  tracks: TimelineTrack[];
};

export type MotionTrack = {
  nodeId: string;
  property: MotionTrackProperty;
  from: number;
  to: number;
  duration: number;
  delay: number;
  easing: EasingPreset;
};

export type MotionTransition = {
  id: string;
  fromFrameId: string;
  toFrameId: string;
  duration: number;
  delay: number;
  tracks: MotionTrack[];
};

export type MotionModel = {
  version: 1;
  transitions: MotionTransition[];
};

export type ExportBundle = {
  scene: DocumentModel;
  motion: MotionModel;
};

export type DmxAsset = {
  id: string;
  type: 'svg' | 'png' | 'jpg';
  mimeType: string;
  name: string;
  byteSize: number;
  storage: 'embedded' | 'external';
  data?: string;
  externalRef?: string;
  hash?: string | null;
};

export type DmxEditorState = {
  activeTool: string;
  selectedFrameId: string | null;
  selectedLayerIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  playMode?: boolean;
  playStartFrameId?: string | null;
  panelMode: 'design' | 'animate';
};

export type DmxFrameVariant = {
  id: string;
  name: string;
  isBase: boolean;
};

export type DmxFrame = {
  id: string;
  name: string;
  orderIndex: number;
  durationMs: number;
  isHold: boolean;
  width: number;
  height: number;
  background: string;
  variants: DmxFrameVariant[];
  responsiveRules?: ResponsiveRule[];
  layersByVariant: Record<string, Node[]>;
};

export type DmxTransition = {
  id: string;
  fromFrameId: string;
  toFrameId: string;
  durationMs: number;
  delayMs: number;
  animationType: TransitionAnimation;
  easingPreset: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';
};

export type DmxDocument = {
  format: 'dmx';
  formatVersion: '1.0.0';
  app: { name: 'Dream Motion'; build: string };
  meta: {
    documentId: string;
    createdAt: string;
    updatedAt: string;
    checksum?: string | null;
  };
  settings: {
    canvas: { width: number; height: number; background: string };
    fps: number;
    grid: { enabled: boolean; size: number };
    guides: { enabled: boolean };
  };
  assets: Record<string, DmxAsset>;
  frames: DmxFrame[];
  transitions: DmxTransition[];
  playStartFrameId?: string | null;
  timeline?: TimelineModel;
  lastPickedColor?: string | null;
  editor?: DmxEditorState;
};

export const DEFAULT_FRAME_DURATION = 300;
export const DEFAULT_TRANSITION_DURATION = 300;
export const DEFAULT_TRANSITION_DELAY = 0;
export const DEFAULT_EASING: EasingPreset = 'ease';

export const supportedNodeTypes: NodeType[] = [
  'rect',
  'ellipse',
  'line',
  'path',
  'text',
  'image',
  'group',
  'symbol',
  'mesh'
];

export const motionProperties: MotionTrackProperty[] = [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'scaleX',
  'scaleY',
  'opacity',
  'cornerRadius',
  'lineLength'
];
