import React, { useEffect, useRef } from 'react';
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

type PropertiesPanelProps = {
  node: Node | null;
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
  previewMode: boolean;
  panelMode: 'design' | 'animate';
  onChangePanelMode: (mode: 'design' | 'animate') => void;
  lockAspect: boolean;
  onToggleLockAspect: () => void;
  lockFrameAspect: boolean;
  onToggleLockFrameAspect: () => void;
};

const numberValue = (value: string, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
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
  previewMode,
  panelMode,
  onChangePanelMode,
  lockAspect,
  onToggleLockAspect,
  lockFrameAspect,
  onToggleLockFrameAspect
}) => {
  const tab = panelMode;
  const showTransitionControls = tab === 'animate' && Boolean(transition);
  const nodeAspectRef = useRef<number | null>(null);
  const frameAspectRef = useRef<number | null>(null);

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
          readOnly={previewMode}
          onChange={(event) =>
            onUpdateTransition({ duration: numberValue(event.target.value, transition.duration) })
          }
        />
      </label>
      <div className="variant-list">
        {[150, 300, 600, 1000].map((value) => (
          <Button key={value} onClick={() => onUpdateTransition({ duration: value })} disabled={previewMode}>
            {value}ms
          </Button>
        ))}
      </div>
      <label className="input-group PropertyField">
        Animation
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" disabled={previewMode}>
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
              <Button variant="ghost" disabled={previewMode}>
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

  if (!node && !frameSelected && !transition) {
    return (
      <div className={`panel right PropertiesPanel ${previewMode ? 'is-readonly' : ''}`} data-panel={tab}>
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

  if (!node && frame && frameSelected) {
    return (
      <div className={`panel right PropertiesPanel ${previewMode ? 'is-readonly' : ''}`} data-panel={tab}>
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
          <div className="input-group PropertyField">
            Frame Name
            <Input
              value={frame.name}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdateFrame(frame.id, { name: event.target.value })}
            />
          </div>
          <div className="input-group PropertyField">
            Hold Frame
            <select
              value={frame.isHold ? 'yes' : 'no'}
              disabled={tab === 'animate' || previewMode}
              onChange={(event) => onUpdateFrame(frame.id, { isHold: event.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div className="input-group PropertyField">
            Variants
            <div className="variant-list">
              <Button
                className={activeVariantId ? '' : 'primary'}
                onClick={() => onSetVariant(null)}
              >
                Base
              </Button>
              {frame.variants.map((variant) => (
                <Button
                  key={variant.id}
                  className={activeVariantId === variant.id ? 'primary' : ''}
                  onClick={() => onSetVariant(variant.id)}
                >
                  {variant.name}
                </Button>
              ))}
              <Button onClick={onAddVariant}>
                Add Variant
              </Button>
            </div>
          </div>
          <div className="input-group PropertyField">
            Responsive Rules
            <div className="variant-list">
              {frame.responsiveRules.map((rule) => (
                <div key={rule.id} className="responsive-rule">
                  <Input
                    type="number"
                    value={rule.minWidth}
                    onChange={(event) =>
                      onUpdateResponsiveRule(rule.id, { minWidth: Number(event.target.value) })
                    }
                  />
                  <span>to</span>
                  <Input
                    type="number"
                    value={rule.maxWidth}
                    onChange={(event) =>
                      onUpdateResponsiveRule(rule.id, { maxWidth: Number(event.target.value) })
                    }
                  />
                  <select
                    value={rule.variantId}
                    onChange={(event) =>
                      onUpdateResponsiveRule(rule.id, { variantId: event.target.value })
                    }
                  >
                    {frame.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <Button onClick={onAddResponsiveRule} disabled={!frame.variants.length}>
                Add Rule
              </Button>
            </div>
          </div>
          <div className="input-row ratio-row">
            <label className="input-group PropertyField">
              Width
              <Input
                type="number"
                value={frame.width}
                readOnly={tab === 'animate' || previewMode}
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
              disabled={tab === 'animate' || previewMode}
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
                readOnly={tab === 'animate' || previewMode}
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
            <Input
              value={frame.background ?? ''}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdateFrame(frame.id, { background: event.target.value })}
            />
          </div>
          <div className="input-group PropertyField">
            State Machine
            <div className="notice">
              {stateMachine.states.length} states, {stateMachine.transitions.length} transitions
            </div>
            <div className="variant-list">
              <Button onClick={onAddStateMachineInput}>
                Add Input
              </Button>
              <Button onClick={onAddStateMachineState}>
                Add State
              </Button>
              <Button onClick={onAddStateMachineTransition}>
                Add Transition
              </Button>
            </div>
            <div className="properties-grid">
              <div className="notice">Inputs</div>
              {stateMachine.inputs.map((input) => (
                <div key={input.id} className="responsive-rule">
                  <span>{input.name}</span>
                  <span>{input.type}</span>
                  <span>{String(input.defaultValue ?? '')}</span>
                </div>
              ))}
              <div className="notice">States</div>
              {stateMachine.states.map((state) => (
                <div key={state.id} className="responsive-rule">
                  <span>{state.name}</span>
                  <Button
                    className={stateMachine.initialStateId === state.id ? 'primary' : ''}
                    onClick={() => onSetInitialState(state.id)}
                  >
                    {stateMachine.initialStateId === state.id ? 'Initial' : 'Set Initial'}
                  </Button>
                </div>
              ))}
              <div className="notice">Transitions</div>
              {stateMachine.transitions.map((transition) => (
                <div key={transition.id} className="responsive-rule">
                  <span>{transition.fromStateId}</span>
                  <span>{transition.toStateId}</span>
                  <span>{transition.inputId}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="input-group PropertyField">
            Rig Bones
            <div className="variant-list">
              <Button onClick={onAddBone}>
                Add Bone
              </Button>
            </div>
            {skeletons[0]?.bones.map((bone) => (
              <div key={bone.id} className="responsive-rule">
                <Input
                  value={bone.name}
                  onChange={(event) => onUpdateBone(bone.id, { name: event.target.value })}
                />
                <Input
                  type="number"
                  value={bone.length}
                  onChange={(event) => onUpdateBone(bone.id, { length: Number(event.target.value) })}
                />
              </div>
            ))}
            <div className="variant-list">
              <Button
                onClick={() =>
                  onAddConstraint({
                    type: 'aim',
                    boneId: skeletons[0]?.bones[0]?.id ?? '',
                    targetX: 200,
                    targetY: 200
                  })
                }
                disabled={!skeletons[0]?.bones.length}
              >
                Add Aim
              </Button>
              <Button
                onClick={() =>
                  onAddConstraint({
                    type: 'ik',
                    chain: skeletons[0]?.bones.slice(0, 3).map((bone) => bone.id) ?? [],
                    targetX: 220,
                    targetY: 220
                  })
                }
                disabled={(skeletons[0]?.bones.length ?? 0) < 2}
              >
                Add IK
              </Button>
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
      </div>
    );
  }

  if (!node && showTransitionControls) {
    return (
      <div className={`panel right PropertiesPanel ${previewMode ? 'is-readonly' : ''}`} data-panel={tab}>
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

  const showDisabledTooltip = tab === 'animate' || previewMode;
  const wrapField = (content: React.ReactNode) => {
    if (!showDisabledTooltip) return content;
    return (
      <Tooltip title="Switch to Design mode to edit properties" tooltipFor="preview">
        {content}
      </Tooltip>
    );
  };

  return (
    <div className={`panel right PropertiesPanel ${previewMode ? 'is-readonly' : ''}`} data-panel={tab}>
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
      {node && transition && (
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
      {node && node.type === 'symbol' && (
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
      {node && (
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
      <div className="input-row">
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            X
            <Input
              type="number"
              value={node.x}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { x: numberValue(event.target.value, node.x) })}
            />
          </label>
        )}
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Y
            <Input
              type="number"
              value={node.y}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { y: numberValue(event.target.value, node.y) })}
            />
          </label>
        )}
      </div>
      <div className="input-row ratio-row">
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Width
            <Input
              type="number"
              value={node.width}
              readOnly={tab === 'animate' || previewMode}
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
          disabled={tab === 'animate' || previewMode}
          aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
        >
          <img
            src={lockAspect ? LockIcon : UnlockIcon}
            alt=""
            className="ratio-lock-icon"
          />
        </Button>
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Height
            <Input
              type="number"
              value={node.height}
              readOnly={tab === 'animate' || previewMode}
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
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Rotation
            <Input
              type="number"
              value={node.rotation}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { rotation: numberValue(event.target.value, node.rotation) })}
            />
          </label>
        )}
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Opacity
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={node.opacity}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { opacity: numberValue(event.target.value, node.opacity) })}
            />
          </label>
        )}
      </div>
      <div className="input-row">
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Fill
            <Input
              value={node.fill ?? ''}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { fill: event.target.value || null })}
            />
          </label>
        )}
        {wrapField(
          <label className={`input-group PropertyField ${tab === 'animate' || previewMode ? 'is-readonly' : ''}`}>
            Stroke
            <Input
              value={node.stroke ?? ''}
              readOnly={tab === 'animate' || previewMode}
              onChange={(event) => onUpdate(node.id, { stroke: event.target.value || null })}
            />
          </label>
        )}
      </div>
    </div>
  );
};
