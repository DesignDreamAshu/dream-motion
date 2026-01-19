import React, { useEffect, useMemo, useState } from 'react';
import type { Frame, Node } from '@dream-motion/shared';
import layerIcon from '../assets/Layer.svg';
import eyeIcon from '../assets/Eye-Show_Password.svg';
import eyeOffIcon from '../assets/Eye_Off-Hide_Password-1.svg';
import lockIcon from '../assets/Lock.svg';
import unlockIcon from '../assets/Unlock.svg';
import arrowDownIcon from '../assets/Arrow Down.svg';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

type LayersPanelProps = {
  frames: Frame[];
  activeFrameId: string;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onSelectFrame: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (dragId: string, targetId: string) => void;
  onToggleLock: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onOpenContextMenu: (event: { x: number; y: number; targetId: string | null; targetType: 'node' | 'frame' }) => void;
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  frames,
  activeFrameId,
  selectedNodeId,
  onSelect,
  onSelectFrame,
  onRename,
  onMove,
  onToggleLock,
  onToggleVisible,
  onOpenContextMenu
}) => {
  const [dragState, setDragState] = useState<{ id: string; frameId: string } | null>(null);
  const [expandedFrames, setExpandedFrames] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpandedFrames((prev) => {
      const next = new Set(prev);
      frames.forEach((frame) => next.add(frame.id));
      return next;
    });
  }, [frames]);

  const sortedNodesByFrame = useMemo(() => {
    const map = new Map<string, Node[]>();
    frames.forEach((frame) => {
      map.set(
        frame.id,
        frame.nodes.slice().sort((a, b) => a.zIndex - b.zIndex)
      );
    });
    return map;
  }, [frames]);

  return (
    <div className="panel">
      <div className="panel-label">Layers</div>
      <ScrollArea className="list compact scene-list">
        {frames.map((frame) => {
          const isExpanded = expandedFrames.has(frame.id);
          const frameNodes = sortedNodesByFrame.get(frame.id) ?? [];
          return (
            <div key={frame.id} className="layer-group">
              <div
                className={`scene-header ${frame.id === activeFrameId ? 'active' : ''}`}
                onClick={() => onSelectFrame(frame.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onOpenContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    targetId: frame.id,
                    targetType: 'frame'
                  });
                }}
              >
                <button
                  type="button"
                  className={`scene-caret ${isExpanded ? '' : 'is-collapsed'}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setExpandedFrames((prev) => {
                      const next = new Set(prev);
                      if (next.has(frame.id)) {
                        next.delete(frame.id);
                      } else {
                        next.add(frame.id);
                      }
                      return next;
                    });
                  }}
                >
                  <img src={arrowDownIcon} alt="" />
                </button>
                <span className="scene-title">{frame.name}</span>
              </div>
              {isExpanded && (
                <div className="layer-children">
                  {frameNodes.map((node) => (
                    <div
                      key={node.id}
                      className={`list-item compact ${node.id === selectedNodeId ? 'active' : ''} ${node.locked ? 'locked' : ''}`}
                      draggable={frame.id === activeFrameId}
                      onDragStart={() => setDragState({ id: node.id, frameId: frame.id })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (dragState && dragState.frameId === frame.id && frame.id === activeFrameId) {
                          onMove(dragState.id, node.id);
                        }
                        setDragState(null);
                      }}
                      onClick={() => {
                        onSelectFrame(frame.id);
                        onSelect(node.id);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onSelectFrame(frame.id);
                        onOpenContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          targetId: node.id,
                          targetType: 'node'
                        });
                      }}
                    >
                      <div className="layer-icon">
                        <img src={layerIcon} alt="" />
                      </div>
                      <Input
                        value={node.name}
                        onChange={(event) => {
                          onSelectFrame(frame.id);
                          onRename(node.id, event.target.value);
                        }}
                      />
                      <div className="layer-actions">
                        <Button
                          variant="ghost"
                          className={node.visible ? '' : 'active'}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectFrame(frame.id);
                            onToggleVisible(node.id);
                          }}
                          title={node.visible ? 'Hide layer' : 'Show layer'}
                        >
                          <img src={node.visible ? eyeIcon : eyeOffIcon} alt="" />
                        </Button>
                        <Button
                          variant="ghost"
                          className={node.locked ? 'active' : ''}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectFrame(frame.id);
                            onToggleLock(node.id);
                          }}
                          title={node.locked ? 'Unlock layer' : 'Lock layer'}
                        >
                          <img src={node.locked ? lockIcon : unlockIcon} alt="" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
};
