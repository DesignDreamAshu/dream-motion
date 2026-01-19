import type { Frame, Node } from '@dream-motion/shared';

const normalizeBase = (value: string) => value.replace(/\s+/g, ' ').trim();

export const getNextNameForBase = (frames: Frame[], baseName: string) => {
  const normalized = normalizeBase(baseName);
  const matcher = new RegExp(`^${normalized}\\s+(\\d+)$`, 'i');
  let maxIndex = 0;
  frames.forEach((frame) => {
    frame.nodes.forEach((node) => {
      const match = node.name.match(matcher);
      if (match) {
        maxIndex = Math.max(maxIndex, Number(match[1]));
      }
    });
  });
  return `${normalized} ${maxIndex + 1}`;
};

export const getBaseNameForNode = (node: Node) => {
  if (node.type === 'rect') return 'Rectangle';
  if (node.type === 'ellipse') return 'Ellipse';
  if (node.type === 'text') return 'Text';
  if (node.type === 'image') return 'Image';
  if (node.type === 'group') return 'Group';
  if (node.type === 'symbol') return 'Symbol';
  if (node.type === 'mesh') return 'Mesh';
  if (node.type === 'line') return 'Line';
  if (node.type === 'path') {
    const name = node.name.toLowerCase();
    if (name.includes('pencil')) return 'Pencil Path';
    if (name.includes('pen')) return 'Pen Path';
    if (name.includes('line')) return 'Line';
    return 'Path';
  }
  return 'Layer';
};

export const getNextNameForTool = (
  frames: Frame[],
  tool: 'rect' | 'ellipse' | 'line' | 'text' | 'pen' | 'pencil' | 'image'
) => {
  const base =
    tool === 'rect'
      ? 'Rectangle'
      : tool === 'ellipse'
      ? 'Ellipse'
      : tool === 'line'
      ? 'Line'
      : tool === 'text'
      ? 'Text'
      : tool === 'pen'
      ? 'Pen Path'
      : tool === 'pencil'
      ? 'Pencil Path'
      : 'Image';
  return getNextNameForBase(frames, base);
};
