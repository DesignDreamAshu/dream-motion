import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import type { Frame, Node, Transition, MotionTrackProperty, StateMachine, SymbolDefinition, Skeleton, Controller } from '@dream-motion/shared';
import LockIcon from '../assets/Lock.svg';
import UnlockIcon from '../assets/Unlock.svg';
import ColorDropperIcon from '../assets/ColorDropper.svg';
import AlignLeftIcon from '../assets/Alignment/Align-Left.svg';
import AlignRightIcon from '../assets/Alignment/Align-Right.svg';
import AlignTopIcon from '../assets/Alignment/Align-Top.svg';
import AlignBottomIcon from '../assets/Alignment/Align-Bottom.svg';
import AlignVerticalIcon from '../assets/Alignment/Align-Vertical.svg';
import AlignHorizontalIcon from '../assets/Alignment/Align-Horizontal.svg';

type PropertiesPanelProps = {
  node: Node | null;
  selectedNodes: Node[];
  frame: Frame | null;
  frameSelected: boolean;
  onUpdate: (id: string, patch: Partial<Node>) => void;
  onUpdateFrame: (
    id: string,
    patch: Partial<Pick<Frame, 'name' | 'width' | 'height' | 'background' | 'isHold'>>
  ) => void;
  transition: Transition | null;
  onUpdateTransition: (patch: Partial<Transition>) => void;
  onUpdateOverride: (nodeId: string, property: MotionTrackProperty, easing: Transition['easing'] | 'inherit') => void;
  activeVariantId: string | null;
  onSetVariant: (id: string | null) => void;
  onAddVariant: () => void;
  onAddResponsiveRule: () => void;
  onUpdateResponsiveRule: (ruleId: string, patch: Partial<Frame['responsiveRules'][number]>) => void;
  stateMachine: StateMachine;
  symbols: SymbolDefinition[];
  onUpdateSymbolOverride: (instanceId: string, childId: string, patch: Partial<Node>) => void;
  onAddStateMachineInput: () => void;
  onAddStateMachineState: () => void;
  onAddStateMachineTransition: () => void;
  onSetInitialState: (stateId: string) => void;
  skeletons: Skeleton[];
  onAddBone: () => void;
  onUpdateBone: (boneId: string, patch: Partial<Skeleton['bones'][number]>) => void;
  onAddConstraint: (constraint: Skeleton['constraints'][number]) => void;
  onBindNodeToBone: (nodeId: string, boneId: string) => void;
  onConvertNodeToMesh: (nodeId: string) => void;
  onAutoWeightMesh: (nodeId: string) => void;
  controllers: Controller[];
  onAddController: () => void;
  onUpdateController: (controllerId: string, patch: Partial<Controller>) => void;
  animateHint: boolean;
  playMode: boolean;
  panelMode: 'design' | 'animate';
  onChangePanelMode: (mode: 'design' | 'animate') => void;
  playStartFrameId: string;
  onSetPlayStartFrame: (id: string) => void;
  lockAspect: boolean;
  onToggleLockAspect: () => void;
  lockFrameAspect: boolean;
  onToggleLockFrameAspect: () => void;
  onExportSvg?: () => void;
  onExportPng?: (scale: number) => void;
  canExportSvg?: boolean;
  onAlignSelection: (xMode: 'left' | 'center' | 'right' | null, yMode: 'top' | 'middle' | 'bottom' | null) => void;
};

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeHex = (value: string | null | undefined) => {
  if (!value) return '#000000';
  return value.startsWith('#') ? value : `#${value}`;
};

const normalizeHexInput = (value: string) => {
  if (!value) return '#';
  return value.startsWith('#') ? value : `#${value}`;
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  selectedNodes,
  frame,
  frameSelected,
  onUpdate,
  onUpdateFrame,
  transition,
  onUpdateTransition,
  onUpdateOverride,
  activeVariantId,
  onSetVariant,
  onAddVariant,
  onAddResponsiveRule,
  onUpdateResponsiveRule,
  stateMachine,
  symbols,
  onUpdateSymbolOverride,
  onAddStateMachineInput,
  onAddStateMachineState,
  onAddStateMachineTransition,
  onSetInitialState,
  skeletons,
  onAddBone,
  onUpdateBone,
  onAddConstraint,
  onBindNodeToBone,
  onConvertNodeToMesh,
  onAutoWeightMesh,
  controllers,
  onAddController,
  onUpdateController,
  animateHint,
  playMode,
  panelMode,
  onChangePanelMode,
  playStartFrameId,
  onSetPlayStartFrame,
  lockAspect,
  onToggleLockAspect,
  lockFrameAspect,
  onToggleLockFrameAspect,
  onExportSvg,
  onExportPng,
  canExportSvg,
  onAlignSelection
}) => {
  const tab = panelMode;
  const showDesign = tab === 'design';
  const showAnimate = tab === 'animate';
  const showTransitionControls = tab === 'animate' && Boolean(transition);
  const nodeAspectRef = useRef<number | null>(null);
  const frameAspectRef = useRef<number | null>(null);
  const [exportRows, setExportRows] = useState<Array<{ id: string; format: 'png' | 'svg'; scale: number }>>([
    { id: 'export-1', format: 'png', scale: 1 }
  ]);

  useEffect(() => {
    if (!node || !lockAspect) return;
    if (node.width > 0 && node.height > 0) {
      nodeAspectRef.current = node.width / node.height;
    }
  }, [node?.id, lockAspect]);

  useEffect(() => {
    if (!frame || !lockFrameAspect) return;
    if (frame.width > 0 && frame.height > 0) {
      frameAspectRef.current = frame.width / frame.height;
    }
  }, [frame?.id, lockFrameAspect]);

  const transitionControls = transition ? (
    <div className="properties-grid">
      <div className="section-title">Transition</div>
      <label className="input-group PropertyField">
        Duration (ms)
        <Input
          type="number"
          value={transition.duration}
          readOnly={playMode}
          onChange={(event) =>
            onUpdateTransition({ duration: numberValue(event.target.value, transition.duration) })
          }
        />
      </label>
      <div className="variant-list">
        {[150, 300, 600, 1000].map((value) => (
          <Button key={value} onClick={() => onUpdateTransition({ duration: value })} disabled={playMode}>
            {value}ms
          </Button>
        ))}
      </div>
      <label className="input-group PropertyField">
        Animation
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" disabled={playMode}>
              {(transition.animation ?? 'auto') === 'auto'
                ? 'Auto Animate'
                : transition.animation === 'linear'
                ? 'Linear'
                : transition.animation === 'instant'
                ? 'Instant'
                : 'Dissolve'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onUpdateTransition({ animation: 'auto' })}>
              Auto Animate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onUpdateTransition({ animation: 'linear', easing: 'linear' })}>
              Linear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onUpdateTransition({ animation: 'instant' })}>
              Instant
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onUpdateTransition({ animation: 'dissolve' })}>
              Dissolve
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </label>
      {(transition.animation ?? 'auto') === 'auto' && (
        <label className="input-group PropertyField">
          Easing
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" disabled={playMode}>
                {transition.easing === 'ease-in'
                  ? 'Ease In'
                  : transition.easing === 'ease-out'
                  ? 'Ease Out'
                  : transition.easing === 'ease'
                  ? 'Ease In Out'
                  : transition.easing}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => onUpdateTransition({ easing: 'ease-in' })}>
                Ease In
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdateTransition({ easing: 'ease-out' })}>
                Ease Out
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdateTransition({ easing: 'ease' })}>
                Ease In Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
      )}
      {(transition.animation ?? 'auto') !== 'auto' && (
        <label className="input-group PropertyField is-readonly">
          Easing
          <Input value={(transition.animation ?? 'auto') === 'linear' ? 'Linear' : 'Disabled'} readOnly />
        </label>
      )}
    </div>
  ) : null;

  if (!node && !frame && !transition) {
    return (
      <div className={`panel right PropertiesPanel ${playMode ? 'is-readonly' : ''}`} data-panel={tab}>
        <div className="panel-label">Properties</div>
        <Tabs value={tab} onValueChange={(value) => onChangePanelMode(value as 'design' | 'animate')}>
          <TabsList className="panel-tabs ModeToggle">
            <Tooltip title="Edit visual state of the current frame" tooltipFor="preview">
              <TabsTrigger className="tab-btn ModeToggleTab" value="design">
                Design
              </TabsTrigger>
            </Tooltip>
            <Tooltip title="Edit motion between frames" tooltipFor="play">
              <TabsTrigger className="tab-btn ModeToggleTab" data-onboarding="animate-tab" value="animate">
                Animate
              </TabsTrigger>
            </Tooltip>
          </TabsList>
        </Tabs>
        <div className="section-title">Properties</div>
        <div className="notice">Select a layer to edit properties.</div>
      </div>
    );
  }

  if (!node && frame) {
    return (
      <div className={`panel right PropertiesPanel ${playMode ? 'is-readonly' : ''}`} data-panel={tab}>
        <div className="panel-label">Properties</div>
        <Tabs value={tab} onValueChange={(value) => onChangePanelMode(value as 'design' | 'animate')}>
          <TabsList className="panel-tabs ModeToggle">
            <Tooltip title="Edit visual state of the current frame" tooltipFor="preview">
              <TabsTrigger className="tab-btn ModeToggleTab" value="design">
                Design
              </TabsTrigger>
            </Tooltip>
            <Tooltip title="Edit motion between frames" tooltipFor="play">
              <TabsTrigger className="tab-btn ModeToggleTab" value="animate">
                Animate
              </TabsTrigger>
            </Tooltip>
          </TabsList>
        </Tabs>
        <div className="section-title">Properties</div>
        {showTransitionControls && transitionControls}
        <div className="properties-grid">
          <div className="section-title">Motion starting frame</div>
          <div className="flow-start-row">
            <Button onClick={() => onSetPlayStartFrame(frame.id)} disabled={playMode}>
              {frame.id === playStartFrameId
                ? 'Motion Starting Frame'
                : 'Set as Motion Starting Frame'}
            </Button>
            {frame.id === playStartFrameId && <span className="flow-start-badge">Start</span>}
          </div>
        </div>
        {showDesign && (
          <div className="properties-grid">
          <div className="input-row ratio-row">
            <label className="input-group PropertyField">
              Width
              <Input
                type="number"
                value={frame.width}
                readOnly={playMode}
                onChange={(event) => {
                  const nextWidth = numberValue(event.target.value, frame.width);
                  if (lockFrameAspect && frameAspectRef.current) {
                    const nextHeight = nextWidth / frameAspectRef.current;
                    onUpdateFrame(frame.id, { width: nextWidth, height: nextHeight });
                  } else {
                    onUpdateFrame(frame.id, { width: nextWidth });
                  }
                }}
              />
            </label>
            <Button
              className="ratio-lock"
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                const next = !lockFrameAspect;
                if (next && frame.width > 0 && frame.height > 0) {
                  frameAspectRef.current = frame.width / frame.height;
                }
                onToggleLockFrameAspect();
              }}
              disabled={playMode}
              aria-label={lockFrameAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              <img
                src={lockFrameAspect ? LockIcon : UnlockIcon}
                alt=""
                className="ratio-lock-icon"
              />
            </Button>
            <label className="input-group PropertyField">
              Height
              <Input
                type="number"
                value={frame.height}
                readOnly={playMode}
                onChange={(event) => {
                  const nextHeight = numberValue(event.target.value, frame.height);
                  if (lockFrameAspect && frameAspectRef.current) {
                    const nextWidth = nextHeight * frameAspectRef.current;
                    onUpdateFrame(frame.id, { width: nextWidth, height: nextHeight });
                  } else {
                    onUpdateFrame(frame.id, { height: nextHeight });
                  }
                }}
              />
            </label>
          </div>
          <div className="input-group PropertyField">
            Background
              <div className="color-input-row">
                <input
                  type="color"
                  className="color-input"
                  value={normalizeHex(frame.background ?? '#ffffff')}
                  disabled={playMode}
                  onChange={(event) => onUpdateFrame(frame.id, { background: event.target.value })}
                />
                <img className="color-picker-icon" src={ColorDropperIcon} alt="" />
                <Input
                  value={normalizeHexInput(frame.background ?? '#')}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdateFrame(frame.id, { background: normalizeHexInput(event.target.value) })
                }
              />
            </div>
          </div>
          <div className="input-group PropertyField">
            Controllers
            <div className="variant-list">
              <Button onClick={onAddController}>
                Add Controller
              </Button>
            </div>
            {controllers.map((controller) => (
              <div key={controller.id} className="responsive-rule">
                <Input
                  value={controller.name}
                  onChange={(event) => onUpdateController(controller.id, { name: event.target.value })}
                />
                <select
                  value={controller.property}
                  onChange={(event) =>
                    onUpdateController(controller.id, {
                      property: event.target.value as Controller['property']
                    })
                  }
                >
                  <option value="opacity">Opacity</option>
                  <option value="x">X</option>
                  <option value="y">Y</option>
                  <option value="rotation">Rotation</option>
                  <option value="scaleX">ScaleX</option>
                  <option value="scaleY">ScaleY</option>
                </select>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    );
  }

  if (!node && showTransitionControls) {
    return (
      <div className={`panel right PropertiesPanel ${playMode ? 'is-readonly' : ''}`} data-panel={tab}>
        <div className="panel-label">Properties</div>
        <Tabs value={tab} onValueChange={(value) => onChangePanelMode(value as 'design' | 'animate')}>
          <TabsList className="panel-tabs ModeToggle">
            <Tooltip title="Edit visual state of the current frame" tooltipFor="preview">
              <TabsTrigger className="tab-btn ModeToggleTab" value="design">
                Design
              </TabsTrigger>
            </Tooltip>
            <Tooltip title="Edit motion between frames" tooltipFor="play">
              <TabsTrigger className="tab-btn ModeToggleTab" value="animate">
                Animate
              </TabsTrigger>
            </Tooltip>
          </TabsList>
        </Tabs>
        <div className="section-title">Properties</div>
        {transitionControls}
      </div>
    );
  }

  if (!node) return null;

  const showDisabledTooltip = playMode;
  const wrapField = (content: React.ReactNode) => {
    if (!showDisabledTooltip) return content;
    return (
      <Tooltip title="Switch to Design mode to edit properties" tooltipFor="preview">
        {content}
      </Tooltip>
    );
  };

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const toPercent = (value: number) => Math.round(clamp(value, 0, 1) * 100);
  const fromPercent = (value: string, fallback: number) =>
    clamp(numberValue(value, fallback * 100) / 100, 0, 1);

  const alignDisabled = playMode || selectedNodes.length === 0;

  const flipNode = (axis: 'x' | 'y') => {
    if (playMode) return;
    if (axis === 'x') {
      onUpdate(node.id, { scaleX: node.scaleX * -1 });
    } else {
      onUpdate(node.id, { scaleY: node.scaleY * -1 });
    }
  };

  const fillOpacity = node.fillOpacity ?? 1;
  const strokeOpacity = node.strokeOpacity ?? 1;
  const strokePosition = node.strokePosition ?? 'center';
  const baseCornerRadius = node.cornerRadius ?? 0;
  const cornerTL = node.cornerRadiusTL ?? baseCornerRadius;
  const cornerTR = node.cornerRadiusTR ?? baseCornerRadius;
  const cornerBR = node.cornerRadiusBR ?? baseCornerRadius;
  const cornerBL = node.cornerRadiusBL ?? baseCornerRadius;
  const hasIndependentCorners =
    node.cornerRadiusTL != null ||
    node.cornerRadiusTR != null ||
    node.cornerRadiusBR != null ||
    node.cornerRadiusBL != null;
  const shadowOpacity = node.shadowOpacity ?? 0;
  const shadowBlur = node.shadowBlur ?? 0;
  const shadowOffsetX = node.shadowOffsetX ?? 0;
  const shadowOffsetY = node.shadowOffsetY ?? 0;
  const blurRadius = node.blurRadius ?? 0;

  return (
    <div className={`panel right PropertiesPanel ${playMode ? 'is-readonly' : ''}`} data-panel={tab}>
      <div className="panel-label">Properties</div>
      <Tabs value={tab} onValueChange={(value) => onChangePanelMode(value as 'design' | 'animate')}>
        <TabsList className="panel-tabs ModeToggle">
          <Tooltip title="Edit visual state of the current frame" tooltipFor="preview">
            <TabsTrigger className="tab-btn ModeToggleTab" value="design">
              Design
            </TabsTrigger>
          </Tooltip>
          <Tooltip title="Edit motion between frames" tooltipFor="play">
            <TabsTrigger className="tab-btn ModeToggleTab" value="animate">
              Animate
            </TabsTrigger>
          </Tooltip>
        </TabsList>
      </Tabs>
      <div className="section-title">Properties</div>
      {tab === 'animate' && animateHint && (
        <div className="notice">Move or edit an object in Frame 2 to define the end state.</div>
      )}
      {showTransitionControls && transitionControls}
      {showAnimate && node && transition && (
        <div className="properties-grid">
          <div className="section-title">Motion Overrides</div>
          {['x', 'y', 'width', 'height', 'rotation', 'scaleX', 'scaleY', 'opacity', 'cornerRadius', 'lineLength'].map((property) => {
            const override = transition.overrides.find(
              (item) => item.nodeId === node.id && item.property === property
            );
            return (
              <label key={property} className="input-group">
                {property}
                <select
                  value={override?.easing ?? 'inherit'}
                  onChange={(event) =>
                    onUpdateOverride(
                      node.id,
                      property as MotionTrackProperty,
                      event.target.value as Transition['easing'] | 'inherit'
                    )
                  }
                >
                  <option value="inherit">Use Transition</option>
                  <option value="ease">Ease</option>
                  <option value="linear">Linear</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="spring">Spring</option>
                  <option value="bounce">Bounce</option>
                  <option value="overshoot">Overshoot</option>
                </select>
              </label>
            );
          })}
        </div>
      )}
      {showAnimate && node && (
        <div className="properties-grid">
          <div className="section-title">Transform</div>
          <div className="input-row">
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                X
                <Input
                  type="number"
                  value={node.x}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { x: numberValue(event.target.value, node.x) })
                  }
                />
              </label>
            )}
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Y
                <Input
                  type="number"
                  value={node.y}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { y: numberValue(event.target.value, node.y) })
                  }
                />
              </label>
            )}
          </div>
          <div className="input-row ratio-row">
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Width
                <Input
                  type="number"
                  value={node.width}
                  readOnly={playMode}
                  onChange={(event) => {
                    const nextWidth = numberValue(event.target.value, node.width);
                    if (lockAspect && nodeAspectRef.current) {
                      const nextHeight = nextWidth / nodeAspectRef.current;
                      onUpdate(node.id, { width: nextWidth, height: nextHeight });
                    } else {
                      onUpdate(node.id, { width: nextWidth });
                    }
                  }}
                />
              </label>
            )}
            <Button
              className="ratio-lock"
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                const next = !lockAspect;
                if (next && node.width > 0 && node.height > 0) {
                  nodeAspectRef.current = node.width / node.height;
                }
                onToggleLockAspect();
              }}
              disabled={playMode}
              aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              <img src={lockAspect ? LockIcon : UnlockIcon} alt="" className="ratio-lock-icon" />
            </Button>
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Height
                <Input
                  type="number"
                  value={node.height}
                  readOnly={playMode}
                  onChange={(event) => {
                    const nextHeight = numberValue(event.target.value, node.height);
                    if (lockAspect && nodeAspectRef.current) {
                      const nextWidth = nextHeight * nodeAspectRef.current;
                      onUpdate(node.id, { width: nextWidth, height: nextHeight });
                    } else {
                      onUpdate(node.id, { height: nextHeight });
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div className="input-row">
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Rotation
                <Input
                  type="number"
                  value={node.rotation}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { rotation: numberValue(event.target.value, node.rotation) })
                  }
                />
              </label>
            )}
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Opacity
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((node.opacity ?? 1) * 100)}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, {
                      opacity: numberValue(event.target.value, (node.opacity ?? 1) * 100) / 100
                    })
                  }
                />
              </label>
            )}
          </div>
        </div>
      )}
      {showDesign && node && node.type === 'symbol' && (
        <div className="properties-grid">
          <div className="section-title">Component Overrides</div>
          {symbols
            .find((symbol) => symbol.id === node.symbolId)
            ?.nodes.map((child) => {
              const override = node.overrides.find((item) => item.nodeId === child.id);
              const fill = override?.patch.fill ?? child.fill ?? '';
              const opacity = override?.patch.opacity ?? child.opacity;
              return (
                <div key={child.id} className="responsive-rule">
                  <span>{child.name}</span>
                  <Input
                    value={fill}
                    onChange={(event) =>
                      onUpdateSymbolOverride(node.id, child.id, { fill: event.target.value })
                    }
                  />
                  <Input
                    type="number"
                    value={opacity}
                    onChange={(event) =>
                      onUpdateSymbolOverride(node.id, child.id, { opacity: Number(event.target.value) })
                    }
                  />
                </div>
              );
            })}
        </div>
      )}
      {showDesign && node && (
        <div className="properties-grid">
          <div className="section-title">Rigging</div>
          <label className="input-group">
            Bind to Bone
            <select
              value={node.bind?.boneId ?? ''}
              onChange={(event) => onBindNodeToBone(node.id, event.target.value)}
            >
              <option value="">None</option>
              {skeletons[0]?.bones.map((bone) => (
                <option key={bone.id} value={bone.id}>
                  {bone.name}
                </option>
              ))}
            </select>
          </label>
          <div className="variant-list">
            <Button onClick={() => onConvertNodeToMesh(node.id)}>
              Convert to Mesh
            </Button>
            {node.type === 'mesh' && (
              <Button onClick={() => onAutoWeightMesh(node.id)}>
                Auto Weights
              </Button>
            )}
          </div>
        </div>
      )}
      {showDesign && (
        <>
          <div className="properties-grid">
            <div className="section-title">Position</div>
            <div className="alignment-grid">
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection('left', null)} disabled={alignDisabled} aria-label="Align left">
            <img src={AlignLeftIcon} alt="" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection('right', null)} disabled={alignDisabled} aria-label="Align right">
            <img src={AlignRightIcon} alt="" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection(null, 'top')} disabled={alignDisabled} aria-label="Align top">
            <img src={AlignTopIcon} alt="" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection(null, 'bottom')} disabled={alignDisabled} aria-label="Align bottom">
            <img src={AlignBottomIcon} alt="" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection('center', null)} disabled={alignDisabled} aria-label="Align horizontal center">
            <img src={AlignHorizontalIcon} alt="" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAlignSelection(null, 'middle')} disabled={alignDisabled} aria-label="Align vertical center">
            <img src={AlignVerticalIcon} alt="" />
          </Button>
            </div>
            <div className="input-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              X
              <Input
                type="number"
                value={node.x}
                readOnly={playMode}
                onChange={(event) => onUpdate(node.id, { x: numberValue(event.target.value, node.x) })}
              />
            </label>
          )}
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Y
              <Input
                type="number"
                value={node.y}
                readOnly={playMode}
                onChange={(event) => onUpdate(node.id, { y: numberValue(event.target.value, node.y) })}
              />
            </label>
          )}
            </div>
            <div className="input-row rotation-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Rotation
              <Input
                type="number"
                value={node.rotation}
                readOnly={playMode}
                onChange={(event) => onUpdate(node.id, { rotation: numberValue(event.target.value, node.rotation) })}
              />
            </label>
          )}
          <div className="rotation-actions">
            <Button variant="ghost" size="sm" onClick={() => onUpdate(node.id, { rotation: node.rotation - 90 })} disabled={playMode}>L90</Button>
            <Button variant="ghost" size="sm" onClick={() => onUpdate(node.id, { rotation: node.rotation + 90 })} disabled={playMode}>R90</Button>
            <Button variant="ghost" size="sm" onClick={() => flipNode('x')} disabled={playMode}>FH</Button>
            <Button variant="ghost" size="sm" onClick={() => flipNode('y')} disabled={playMode}>FV</Button>
          </div>
            </div>
          </div>

          <div className="properties-grid">
            <div className="section-title">Layout</div>
            <div className="input-row ratio-row">
              {wrapField(
                <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                  Width
                  <Input
                    type="number"
                    value={node.width}
                    readOnly={playMode}
                    onChange={(event) => {
                      const nextWidth = numberValue(event.target.value, node.width);
                      if (lockAspect && nodeAspectRef.current) {
                        const nextHeight = nextWidth / nodeAspectRef.current;
                        onUpdate(node.id, { width: nextWidth, height: nextHeight });
                      } else {
                        onUpdate(node.id, { width: nextWidth });
                      }
                    }}
                  />
                </label>
              )}
              <Button
                className="ratio-lock"
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  const next = !lockAspect;
                  if (next && node.width > 0 && node.height > 0) {
                    nodeAspectRef.current = node.width / node.height;
                  }
                  onToggleLockAspect();
                }}
                disabled={playMode}
                aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              >
                <img
                  src={lockAspect ? LockIcon : UnlockIcon}
                  alt=""
                  className="ratio-lock-icon"
                />
              </Button>
              {wrapField(
                <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                  Height
                  <Input
                    type="number"
                    value={node.height}
                    readOnly={playMode}
                    onChange={(event) => {
                      const nextHeight = numberValue(event.target.value, node.height);
                      if (lockAspect && nodeAspectRef.current) {
                        const nextWidth = nextHeight * nodeAspectRef.current;
                        onUpdate(node.id, { width: nextWidth, height: nextHeight });
                      } else {
                        onUpdate(node.id, { height: nextHeight });
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

      {node.type === 'text' && (
        <div className="properties-grid">
          <div className="section-title">Text</div>
          <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
            Content
            <textarea
              className="Input"
              value={node.text}
              readOnly={playMode}
              onChange={(event) => onUpdate(node.id, { text: event.target.value })}
            />
          </label>
          <div className="input-row">
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Font size
                <Input
                  type="number"
                  value={node.fontSize}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { fontSize: numberValue(event.target.value, node.fontSize) })
                  }
                />
              </label>
            )}
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Weight
                <select
                  value={node.fontWeight ?? 400}
                  disabled={playMode}
                  onChange={(event) => onUpdate(node.id, { fontWeight: event.target.value })}
                >
                  {[400, 500, 600, 700].map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="input-row">
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Align
                <select
                  value={node.textAlign ?? 'left'}
                  disabled={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { textAlign: event.target.value as 'left' | 'center' | 'right' })
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
            )}
            {wrapField(
              <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
                Line height
                <Input
                  type="number"
                  value={node.lineHeight ?? 1.2}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, { lineHeight: numberValue(event.target.value, node.lineHeight ?? 1.2) })
                  }
                />
              </label>
            )}
          </div>
        </div>
      )}

          <div className="properties-grid">
            <div className="section-title">Appearance</div>
            <div className="input-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Opacity
              <Input
                type="number"
                min="0"
                max="100"
                value={toPercent(node.opacity)}
                readOnly={playMode}
                onChange={(event) => onUpdate(node.id, { opacity: fromPercent(event.target.value, node.opacity) })}
              />
            </label>
          )}
          {node.type === 'rect' && wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Corner radius
              <Input
                type="number"
                value={baseCornerRadius}
                readOnly={playMode}
                onChange={(event) =>
                  onUpdate(node.id, {
                    cornerRadius: numberValue(event.target.value, baseCornerRadius),
                    cornerRadiusTL: hasIndependentCorners ? cornerTL : null,
                    cornerRadiusTR: hasIndependentCorners ? cornerTR : null,
                    cornerRadiusBR: hasIndependentCorners ? cornerBR : null,
                    cornerRadiusBL: hasIndependentCorners ? cornerBL : null
                  })
                }
              />
            </label>
          )}
            </div>
            {node.type === 'rect' && (
              <div className="variant-list">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (hasIndependentCorners) {
                  onUpdate(node.id, {
                    cornerRadius: baseCornerRadius,
                    cornerRadiusTL: null,
                    cornerRadiusTR: null,
                    cornerRadiusBR: null,
                    cornerRadiusBL: null
                  });
                } else {
                  onUpdate(node.id, {
                    cornerRadiusTL: baseCornerRadius,
                    cornerRadiusTR: baseCornerRadius,
                    cornerRadiusBR: baseCornerRadius,
                    cornerRadiusBL: baseCornerRadius
                  });
                }
              }}
              disabled={playMode}
            >
              {hasIndependentCorners ? 'Uniform' : 'Independent'}
            </Button>
          </div>
            )}
            {node.type === 'rect' && hasIndependentCorners && (
              <div className="corner-grid">
            <label className="input-group">
              TL
              <Input
                type="number"
                value={cornerTL}
                onChange={(event) =>
                  onUpdate(node.id, { cornerRadiusTL: numberValue(event.target.value, cornerTL) })
                }
              />
            </label>
            <label className="input-group">
              TR
              <Input
                type="number"
                value={cornerTR}
                onChange={(event) =>
                  onUpdate(node.id, { cornerRadiusTR: numberValue(event.target.value, cornerTR) })
                }
              />
            </label>
            <label className="input-group">
              BR
              <Input
                type="number"
                value={cornerBR}
                onChange={(event) =>
                  onUpdate(node.id, { cornerRadiusBR: numberValue(event.target.value, cornerBR) })
                }
              />
            </label>
            <label className="input-group">
              BL
              <Input
                type="number"
                value={cornerBL}
                onChange={(event) =>
                  onUpdate(node.id, { cornerRadiusBL: numberValue(event.target.value, cornerBL) })
                }
              />
            </label>
              </div>
            )}
          </div>

          <div className="properties-grid">
            <div className="section-title">Fill</div>
            <div className="input-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Color
              <div className="color-input-row">
                <input
                  type="color"
                  className="color-input"
                  value={normalizeHex(node.fill ?? '#d9d9d9')}
                  disabled={playMode}
                  onChange={(event) => onUpdate(node.id, { fill: event.target.value })}
                />
                <img className="color-picker-icon" src={ColorDropperIcon} alt="" />
                <Input
                  value={normalizeHexInput(node.fill ?? '#')}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, {
                      fill: normalizeHexInput(event.target.value) === '#' ? null : normalizeHexInput(event.target.value)
                    })
                  }
                />
              </div>
            </label>
          )}
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Opacity
              <Input
                type="number"
                min="0"
                max="100"
                value={toPercent(fillOpacity)}
                readOnly={playMode}
                onChange={(event) =>
                  onUpdate(node.id, { fillOpacity: fromPercent(event.target.value, fillOpacity) })
                }
              />
            </label>
          )}
            </div>
            <div className="variant-list">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(node.id, { fill: node.fill ? null : '#d9d9d9' })}
            disabled={playMode}
          >
            {node.fill ? 'Remove Fill' : 'Add Fill'}
          </Button>
            </div>
          </div>

          <div className="properties-grid">
            <div className="section-title">Stroke</div>
            <div className="input-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Color
              <div className="color-input-row">
                <input
                  type="color"
                  className="color-input"
                  value={normalizeHex(node.stroke ?? '#111111')}
                  disabled={playMode}
                  onChange={(event) => onUpdate(node.id, { stroke: event.target.value })}
                />
                <img className="color-picker-icon" src={ColorDropperIcon} alt="" />
                <Input
                  value={normalizeHexInput(node.stroke ?? '#')}
                  readOnly={playMode}
                  onChange={(event) =>
                    onUpdate(node.id, {
                      stroke: normalizeHexInput(event.target.value) === '#' ? null : normalizeHexInput(event.target.value)
                    })
                  }
                />
              </div>
            </label>
          )}
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Width
              <Input
                type="number"
                min="0"
                value={node.strokeWidth ?? 0}
                readOnly={playMode}
                onChange={(event) => onUpdate(node.id, { strokeWidth: numberValue(event.target.value, node.strokeWidth ?? 0) })}
              />
            </label>
          )}
            </div>
            <div className="input-row">
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Opacity
              <Input
                type="number"
                min="0"
                max="100"
                value={toPercent(strokeOpacity)}
                readOnly={playMode}
                onChange={(event) =>
                  onUpdate(node.id, { strokeOpacity: fromPercent(event.target.value, strokeOpacity) })
                }
              />
            </label>
          )}
          {wrapField(
            <label className={`input-group PropertyField ${playMode ? 'is-readonly' : ''}`}>
              Position
              <select
                value={strokePosition}
                disabled={playMode}
                onChange={(event) =>
                  onUpdate(node.id, { strokePosition: event.target.value as Node['strokePosition'] })
                }
              >
                <option value="center">Center</option>
                <option value="inside">Inside</option>
                <option value="outside">Outside</option>
              </select>
            </label>
          )}
            </div>
            <div className="variant-list">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdate(node.id, { stroke: node.stroke ? null : '#111111', strokeWidth: node.stroke ? null : 1 })}
            disabled={playMode}
          >
            {node.stroke ? 'Remove Stroke' : 'Add Stroke'}
          </Button>
            </div>
          </div>

          <div className="properties-grid">
            <div className="section-title">Effects</div>
            <div className="input-row">
          <label className="input-group">
            Shadow Color
            <div className="color-input-row">
              <input
                type="color"
                className="color-input"
                value={normalizeHex(node.shadowColor ?? '#000000')}
                disabled={playMode}
                onChange={(event) => onUpdate(node.id, { shadowColor: event.target.value })}
              />
              <img className="color-picker-icon" src={ColorDropperIcon} alt="" />
              <Input
                value={normalizeHexInput(node.shadowColor ?? '#')}
                readOnly={playMode}
                onChange={(event) =>
                  onUpdate(node.id, {
                    shadowColor:
                      normalizeHexInput(event.target.value) === '#' ? null : normalizeHexInput(event.target.value)
                  })
                }
              />
            </div>
          </label>
          <label className="input-group">
            Shadow Opacity
            <Input
              type="number"
              min="0"
              max="100"
              value={toPercent(shadowOpacity)}
              readOnly={playMode}
              onChange={(event) =>
                onUpdate(node.id, { shadowOpacity: fromPercent(event.target.value, shadowOpacity) })
              }
            />
          </label>
            </div>
            <div className="input-row">
          <label className="input-group">
            Shadow Blur
            <Input
              type="number"
              min="0"
              value={shadowBlur}
              readOnly={playMode}
              onChange={(event) => onUpdate(node.id, { shadowBlur: numberValue(event.target.value, shadowBlur) })}
            />
          </label>
          <label className="input-group">
            Blur
            <Input
              type="number"
              min="0"
              value={blurRadius}
              readOnly={playMode}
              onChange={(event) => onUpdate(node.id, { blurRadius: numberValue(event.target.value, blurRadius) })}
            />
          </label>
            </div>
            <div className="input-row">
          <label className="input-group">
            Shadow X
            <Input
              type="number"
              value={shadowOffsetX}
              readOnly={playMode}
              onChange={(event) => onUpdate(node.id, { shadowOffsetX: numberValue(event.target.value, shadowOffsetX) })}
            />
          </label>
          <label className="input-group">
            Shadow Y
            <Input
              type="number"
              value={shadowOffsetY}
              readOnly={playMode}
              onChange={(event) => onUpdate(node.id, { shadowOffsetY: numberValue(event.target.value, shadowOffsetY) })}
            />
          </label>
            </div>
          </div>

          <div className="properties-grid">
            <div className="section-title">Export</div>
            {exportRows.map((row) => (
              <div key={row.id} className="export-row">
                <select
                  value={row.format}
                  onChange={(event) =>
                    setExportRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, format: event.target.value as 'png' | 'svg' }
                          : item
                      )
                    )
                  }
                >
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
                {row.format === 'png' ? (
                  <select
                    value={row.scale}
                    onChange={(event) =>
                      setExportRows((prev) =>
                        prev.map((item) =>
                          item.id === row.id
                            ? { ...item, scale: numberValue(event.target.value, 1) }
                            : item
                        )
                      )
                    }
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                  </select>
                ) : (
                  <span className="export-scale">1x</span>
                )}
                <Button
                  onClick={() => {
                    if (row.format === 'svg') {
                      onExportSvg?.();
                    } else {
                      onExportPng?.(row.scale);
                    }
                  }}
                  disabled={row.format === 'svg' ? !canExportSvg : false}
                >
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExportRows((prev) => prev.filter((item) => item.id !== row.id))
                  }
                  disabled={exportRows.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div className="variant-list">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExportRows((prev) => [
                    ...prev,
                    { id: `export-${Date.now()}`, format: 'png', scale: 1 }
                  ])
                }
              >
                Add Export
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
