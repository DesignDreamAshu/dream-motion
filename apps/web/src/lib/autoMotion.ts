import type {
  DocumentModel,
  MotionModel,
  MotionTrack,
  MotionTransition,
  Node,
  MotionTrackProperty,
  Transition
} from '@dream-motion/shared';
import { motionProperties } from '@dream-motion/shared';

const enterOffset = 12;

const indexNodes = (nodes: Node[]) => {
  const map = new Map<string, Node>();
  nodes.forEach((node) => map.set(node.id, node));
  return map;
};

const createTrack = (
  nodeId: string,
  property: MotionTrack['property'],
  from: number,
  to: number,
  duration: number,
  delay: number,
  easing: MotionTrack['easing']
): MotionTrack => ({
  nodeId,
  property,
  from,
  to,
  duration,
  delay,
  easing
});

const addIfChanged = (
  tracks: MotionTrack[],
  nodeId: string,
  property: MotionTrack['property'],
  from: number,
  to: number,
  duration: number,
  delay: number,
  easing: MotionTrack['easing']
) => {
  if (from === to) return;
  tracks.push(createTrack(nodeId, property, from, to, duration, delay, easing));
};

export const generateMotionModel = (document: DocumentModel): MotionModel => {
  const transitions: MotionTransition[] = document.transitions.map((transition) => {
    const fromFrame = document.frames.find((f) => f.id === transition.fromFrameId);
    const toFrame = document.frames.find((f) => f.id === transition.toFrameId);

    if (!fromFrame || !toFrame) {
      return {
        id: transition.id,
        fromFrameId: transition.fromFrameId,
        toFrameId: transition.toFrameId,
        duration: transition.duration,
        delay: transition.delay,
        tracks: []
      };
    }

    const animation = transition.animation ?? 'auto';
    const baseEasing = animation === 'linear' ? 'linear' : transition.easing;
    const trackDuration = animation === 'instant' ? 0 : transition.duration;
    const trackDelay = animation === 'instant' ? 0 : transition.delay;

    const tracks: MotionTrack[] = [];
    const overrideMap = new Map<string, Transition['overrides'][number]>();
    transition.overrides.forEach((override) => {
      overrideMap.set(`${override.nodeId}:${override.property}`, override);
    });
    const fromNodes = indexNodes(fromFrame.nodes);
    const toNodes = indexNodes(toFrame.nodes);

    const fromByName = new Map<string, Node[]>();
    const toByName = new Map<string, Node[]>();

    fromNodes.forEach((node) => {
      const list = fromByName.get(node.name) ?? [];
      list.push(node);
      fromByName.set(node.name, list);
    });
    toNodes.forEach((node) => {
      const list = toByName.get(node.name) ?? [];
      list.push(node);
      toByName.set(node.name, list);
    });

    const usedFrom = new Set<string>();
    const usedTo = new Set<string>();
    const pairs: Array<{
      fromNode?: Node;
      toNode?: Node;
      match: 'name' | 'id' | 'enter' | 'exit';
    }> = [];

    fromByName.forEach((fromList, name) => {
      const toList = toByName.get(name);
      if (!toList) return;
      const orderedFrom = fromList.slice().sort((a, b) => a.zIndex - b.zIndex);
      const orderedTo = toList.slice().sort((a, b) => a.zIndex - b.zIndex);
      const count = Math.min(orderedFrom.length, orderedTo.length);
      for (let i = 0; i < count; i += 1) {
        const fromNode = orderedFrom[i];
        const toNode = orderedTo[i];
        usedFrom.add(fromNode.id);
        usedTo.add(toNode.id);
        pairs.push({ fromNode, toNode, match: 'name' });
      }
    });

    fromNodes.forEach((fromNode, id) => {
      if (usedFrom.has(id)) return;
      const toNode = toNodes.get(id);
      if (!toNode || usedTo.has(id)) return;
      usedFrom.add(id);
      usedTo.add(id);
      pairs.push({ fromNode, toNode, match: 'id' });
    });

    fromNodes.forEach((fromNode, id) => {
      if (usedFrom.has(id)) return;
      pairs.push({ fromNode, match: 'exit' });
    });

    toNodes.forEach((toNode, id) => {
      if (usedTo.has(id)) return;
      pairs.push({ toNode, match: 'enter' });
    });

    const orderedPairs = pairs.sort((a, b) => {
      const aNode = a.toNode ?? a.fromNode;
      const bNode = b.toNode ?? b.fromNode;
      if (!aNode || !bNode) return 0;
      return aNode.zIndex - bNode.zIndex;
    });

    const frameCenter = {
      x: toFrame.width / 2,
      y: toFrame.height / 2
    };

    const getStaggerDelay = (index: number, node: Node | undefined) => {
      if (transition.stagger.mode === 'none' || transition.stagger.amount <= 0) return 0;
      if (transition.stagger.mode === 'order') {
        return index * transition.stagger.amount;
      }
      if (transition.stagger.mode === 'distance' && node) {
        const dx = node.x + node.width / 2 - frameCenter.x;
        const dy = node.y + node.height / 2 - frameCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return (distance / 100) * transition.stagger.amount;
      }
      return 0;
    };

    orderedPairs.forEach(({ fromNode, toNode, match }, index) => {
      const node = toNode ?? fromNode;
      const staggerDelay = getStaggerDelay(index, node ?? undefined);

      if (fromNode && toNode) {
        if (animation === 'dissolve' && fromNode.id !== toNode.id) {
          tracks.push(
            createTrack(
              fromNode.id,
              'opacity',
              fromNode.opacity,
              0,
              trackDuration,
              trackDelay + staggerDelay,
              baseEasing
            )
          );
          tracks.push(
            createTrack(
              toNode.id,
              'opacity',
              0,
              toNode.opacity,
              trackDuration,
              trackDelay + staggerDelay,
              baseEasing
            )
          );
          return;
        }
        const properties =
          animation === 'dissolve' ? (['opacity'] as MotionTrackProperty[]) : motionProperties;
        properties.forEach((property: MotionTrackProperty) => {
          if (property === 'cornerRadius') {
            const fromValue = fromNode.cornerRadius ?? 0;
            const toValue = toNode.cornerRadius ?? 0;
            if (fromValue !== toValue) {
              const override = overrideMap.get(`${toNode.id}:${property}`);
              const easing = animation === 'linear' ? 'linear' : override ? override.easing : baseEasing;
              addIfChanged(
                tracks,
                toNode.id,
                property,
                fromValue,
                toValue,
                trackDuration,
                trackDelay + staggerDelay,
                easing
              );
            }
            return;
          }
          if (property === 'lineLength') {
            const fromPoints = fromNode.type === 'line' ? fromNode.points : undefined;
            const toPoints = toNode.type === 'line' ? toNode.points : undefined;
            if (fromPoints && toPoints && fromPoints.length >= 4 && toPoints.length >= 4) {
              const fromDx = fromPoints[2] - fromPoints[0];
              const fromDy = fromPoints[3] - fromPoints[1];
              const toDx = toPoints[2] - toPoints[0];
              const toDy = toPoints[3] - toPoints[1];
              const fromLen = Math.sqrt(fromDx * fromDx + fromDy * fromDy);
              const toLen = Math.sqrt(toDx * toDx + toDy * toDy);
              if (fromLen !== toLen) {
                const override = overrideMap.get(`${toNode.id}:${property}`);
                const easing = animation === 'linear' ? 'linear' : override ? override.easing : baseEasing;
                addIfChanged(
                  tracks,
                  toNode.id,
                  property,
                  fromLen,
                  toLen,
                  trackDuration,
                  trackDelay + staggerDelay,
                  easing
                );
              }
            }
            return;
          }
          const override = overrideMap.get(`${toNode.id}:${property}`);
          const easing = animation === 'linear' ? 'linear' : override ? override.easing : baseEasing;
          addIfChanged(
            tracks,
            toNode.id,
            property,
            Number(fromNode[property]),
            Number(toNode[property]),
            trackDuration,
            trackDelay + staggerDelay,
            easing
          );
        });
        if (match === 'name' && fromNode.id !== toNode.id && animation !== 'dissolve') {
          tracks.push(
            createTrack(
              fromNode.id,
              'opacity',
              fromNode.opacity,
              0,
              0,
              0,
              'linear'
            )
          );
        }
        return;
      }

      if (!fromNode && toNode) {
        if (animation === 'instant') {
          return;
        }
        if (animation === 'dissolve') {
          tracks.push(
            createTrack(
              toNode.id,
              'opacity',
              0,
              toNode.opacity,
              trackDuration,
              trackDelay + staggerDelay,
              baseEasing
            )
          );
          return;
        }
        tracks.push(
          createTrack(
            toNode.id,
            'opacity',
            0,
            toNode.opacity,
            trackDuration,
            trackDelay + staggerDelay,
            baseEasing
          )
        );
        tracks.push(
          createTrack(
            toNode.id,
            'y',
            toNode.y + enterOffset,
            toNode.y,
            trackDuration,
            trackDelay + staggerDelay,
            baseEasing
          )
        );
        return;
      }

      if (fromNode && !toNode) {
        if (animation === 'instant') {
          tracks.push(
            createTrack(
              fromNode.id,
              'opacity',
              fromNode.opacity,
              0,
              0,
              0,
              'linear'
            )
          );
          return;
        }
        if (animation === 'dissolve') {
          tracks.push(
            createTrack(
              fromNode.id,
              'opacity',
              fromNode.opacity,
              0,
              trackDuration,
              trackDelay + staggerDelay,
              baseEasing
            )
          );
          return;
        }
        tracks.push(
          createTrack(
            fromNode.id,
            'opacity',
            fromNode.opacity,
            0,
            trackDuration,
            trackDelay + staggerDelay,
            baseEasing
          )
        );
        tracks.push(
          createTrack(
            fromNode.id,
            'y',
            fromNode.y,
            fromNode.y - enterOffset,
            trackDuration,
            trackDelay + staggerDelay,
            baseEasing
          )
        );
      }
    });

    return {
      id: transition.id,
      fromFrameId: transition.fromFrameId,
      toFrameId: transition.toFrameId,
      duration: transition.duration,
      delay: transition.delay,
      tracks
    };
  });

  return {
    version: 1,
    transitions
  };
};
