import React, { useEffect, useMemo, useState } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Button } from './ui/button';

type TourStep = {
  id: string;
  title: string;
  body: string;
  targetSelector: string;
};

const steps: TourStep[] = [
  {
    id: 'new-file',
    title: 'Start a new file',
    body: 'Dream Motion creates Frame 1 automatically.',
    targetSelector: '[data-onboarding="new-file"]'
  },
  {
    id: 'tool-rect',
    title: 'Draw your first shape',
    body: 'Use Rectangle (R) to place a shape on the canvas.',
    targetSelector: '[data-onboarding="tool-rect"]'
  },
  {
    id: 'add-scene',
    title: 'Create Frame 2',
    body: 'A second scene is required to generate motion.',
    targetSelector: '[data-onboarding="add-scene"]'
  },
  {
    id: 'move-shape',
    title: 'Move the shape in Frame 2',
    body: 'Change position or opacity to define the end state.',
    targetSelector: '[data-onboarding="canvas"]'
  },
  {
    id: 'select-transition',
    title: 'Select the motion',
    body: 'Click the scene block to edit duration and easing.',
    targetSelector: '[data-onboarding="scene-block"]'
  },
  {
    id: 'animate-tab',
    title: 'Edit motion settings',
    body: 'Set duration, delay, and motion preset here.',
    targetSelector: '[data-onboarding="animate-tab"]'
  },
  {
    id: 'play',
    title: 'Play the animation',
    body: 'Press Space to play/pause in Play mode.',
    targetSelector: '[data-onboarding="play"]'
  },
  {
    id: 'export',
    title: 'Export runtime',
    body: 'Export creates code output matching playback.',
    targetSelector: '[data-onboarding="import-export"]'
  }
];

type OnboardingTourProps = {
  onComplete: () => void;
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const { document: doc } = useDocumentStore();

  const frame1 = doc.frames[0];
  const frame2 = doc.frames[1];
  const hasFrame1Nodes = Boolean(frame1 && frame1.nodes.length > 0);
  const hasSecondFrame = doc.frames.length > 1;

  const hasMotionChange = useMemo(() => {
    if (!frame1 || !frame2) return false;
    const frame1Nodes = new Map(frame1.nodes.map((node) => [node.id, node]));
    return frame2.nodes.some((node) => {
      const base = frame1Nodes.get(node.id);
      if (!base) return false;
      return (
        base.x !== node.x ||
        base.y !== node.y ||
        base.width !== node.width ||
        base.height !== node.height ||
        base.rotation !== node.rotation ||
        base.opacity !== node.opacity ||
        base.scaleX !== node.scaleX ||
        base.scaleY !== node.scaleY
      );
    });
  }, [frame1, frame2]);

  const stepRequirement = useMemo(() => {
    if (step.id === 'tool-rect') {
      return {
        complete: hasFrame1Nodes,
        message: hasFrame1Nodes ? 'Nice! Shape added.' : 'Add a rectangle on the canvas to continue.'
      };
    }
    if (step.id === 'add-scene') {
      return {
        complete: hasSecondFrame,
        message: hasSecondFrame ? 'Great! Frame 2 added.' : 'Add a second scene to continue.'
      };
    }
    if (step.id === 'move-shape') {
      return {
        complete: hasMotionChange,
        message: hasMotionChange
          ? 'Perfect! The end state is different now.'
          : 'Move the shape in Frame 2 to create motion.'
      };
    }
    return { complete: true, message: '' };
  }, [step.id, hasFrame1Nodes, hasSecondFrame, hasMotionChange]);

  const canAdvance = stepRequirement.complete;

  const rect = useMemo(() => {
    const target = window.document.querySelector(step.targetSelector);
    if (!target) return null;
    return (target as HTMLElement).getBoundingClientRect();
  }, [step]);

  useEffect(() => {
    const handleResize = () => setStepIndex((prev) => prev);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNext = () => {
    if (stepIndex >= steps.length - 1) {
      onComplete();
      return;
    }
    setStepIndex(stepIndex + 1);
  };

  const handleSkip = () => onComplete();

  const highlightStyle = rect
    ? {
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12
      }
    : undefined;

  return (
    <div className="OnboardingOverlay">
      {rect && <div className="OnboardingSpotlight" style={highlightStyle} />}
      <div className="OnboardingCard">
        <div className="OnboardingHeader">
          <div className="OnboardingTitle">{step.title}</div>
          <Button className="OnboardingSkip" onClick={handleSkip}>
            Skip
          </Button>
        </div>
        <div className="OnboardingBody">{step.body}</div>
        {stepRequirement.message && (
          <div className={`OnboardingStatus ${stepRequirement.complete ? 'is-complete' : ''}`}>
            {stepRequirement.message}
          </div>
        )}
        <div className="OnboardingActions">
          <Button className="primary" onClick={handleNext} disabled={!canAdvance} aria-disabled={!canAdvance}>
            {stepIndex === steps.length - 1 ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
