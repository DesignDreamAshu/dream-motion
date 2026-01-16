import type { DocumentModel, Node, SymbolDefinition, SymbolInstanceNode } from '@dream-motion/shared';

const applyOverride = (node: Node, overrides: SymbolInstanceNode['overrides']) => {
  const override = overrides.find((item) => item.nodeId === node.id);
  if (!override) return node;
  return { ...node, ...override.patch };
};

const expandSymbolInstance = (
  instance: SymbolInstanceNode,
  symbol: SymbolDefinition
): Node[] => {
  return symbol.nodes.map((child) => {
    const patched = applyOverride(child, instance.overrides);
    const next: Node = {
      ...patched,
      id: `${instance.id}:${patched.id}`,
      x: instance.x + patched.x,
      y: instance.y + patched.y,
      width: patched.width * instance.scaleX,
      height: patched.height * instance.scaleY,
      rotation: patched.rotation + instance.rotation,
      scaleX: patched.scaleX * instance.scaleX,
      scaleY: patched.scaleY * instance.scaleY,
      opacity: patched.opacity * instance.opacity,
      visible: patched.visible && instance.visible,
      zIndex: instance.zIndex
    };
    if (next.type === 'line' && 'points' in next) {
      const points = next.points.slice();
      for (let i = 0; i < points.length; i += 2) {
        points[i] = instance.x + points[i] * instance.scaleX;
        points[i + 1] = instance.y + points[i + 1] * instance.scaleY;
      }
      next.points = points;
    }
    return next;
  });
};

export const flattenSymbols = (document: DocumentModel): DocumentModel => {
  if (!document.symbols.length) return document;
  const symbols = new Map(document.symbols.map((symbol) => [symbol.id, symbol]));
  const frames = document.frames.map((frame) => {
    const nodes: Node[] = [];
    frame.nodes.forEach((node) => {
      if (node.type === 'symbol') {
        const symbol = symbols.get(node.symbolId);
        if (!symbol) return;
        nodes.push(...expandSymbolInstance(node, symbol));
      } else {
        nodes.push(node);
      }
    });
    return { ...frame, nodes };
  });
  return { ...document, frames };
};
