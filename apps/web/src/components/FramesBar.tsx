import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Tooltip } from './ui/tooltip';
import type { Frame, Transition } from '@dream-motion/shared';

type FramesBarProps = {
  frames: Frame[];
  transitions: Transition[];
  activeFrameId: string;
  panelMode: 'design' | 'animate';
  selectedTransitionId: string | null;
  onSelect: (id: string) => void;
  onSelectTransition: (id: string) => void;
  onConnectFrames: (fromFrameId: string, toFrameId: string) => void;
  onAdd: () => void;
  onAddHold: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: 'left' | 'right') => void;
  onUpdateTransition: (id: string, patch: Partial<Transition>) => void;
  previewTime: number;
  timelineDuration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timeMs: number) => void;
  showEmptyHint: boolean;
};

export const FramesBar: React.FC<FramesBarProps> = ({
  frames,
  transitions,
  activeFrameId,
  panelMode,
  selectedTransitionId,
  onSelect,
  onSelectTransition,
  onConnectFrames,
  onAdd,
  onAddHold,
  onDuplicate,
  onDelete,
  onMove,
  onUpdateTransition,
  previewTime,
  timelineDuration,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  showEmptyHint
}) => {
  const scaleRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [scaleWidth, setScaleWidth] = useState(800);
  const [trackWidth, setTrackWidth] = useState(800);
  const [headerHeight, setHeaderHeight] = useState(40);
  const [connector, setConnector] = useState<{
    fromFrameId: string;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const [hoverFrameId, setHoverFrameId] = useState<string | null>(null);
  const progress = timelineDuration > 0 ? Math.min(1, previewTime / timelineDuration) : 0;
  const playheadX = progress * trackWidth;
  const ticks = 5;
  const timeLabel = `${(previewTime / 1000).toFixed(2)}s`;
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const getTimeFromClientX = (clientX: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect();
    const localX = clamp(clientX - rect.left, 0, rect.width);
    const ratio = rect.width > 0 ? localX / rect.width : 0;
    return timelineDuration * ratio;
  };
  const handlePlayheadPointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = trackRef.current ?? scaleRef.current;
    if (!container) return;
    onSeek(getTimeFromClientX(event.clientX, container));
    const handleMove = (moveEvent: MouseEvent) => {
      onSeek(getTimeFromClientX(moveEvent.clientX, container));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const getBodyPoint = (clientX: number, clientY: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleConnectorStart = (event: React.MouseEvent<HTMLButtonElement>, fromFrameId: string) => {
    if (panelMode !== 'animate') return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const bodyRect = bodyRef.current?.getBoundingClientRect();
    if (!bodyRect) return;
    const start = {
      x: rect.left + rect.width / 2 - bodyRect.left,
      y: rect.top + rect.height / 2 - bodyRect.top
    };
    setConnector({ fromFrameId, start, current: start });
  };

  useEffect(() => {
    if (!connector) return;
    const handleMove = (event: MouseEvent) => {
      const point = getBodyPoint(event.clientX, event.clientY);
      setConnector((prev) => (prev ? { ...prev, current: point } : prev));
      const target = window.document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-frame-id]') as HTMLElement | null;
      const targetId = target?.dataset?.frameId ?? null;
      if (targetId && targetId !== connector.fromFrameId) {
        setHoverFrameId(targetId);
      } else {
        setHoverFrameId(null);
      }
    };
    const handleUp = () => {
      if (hoverFrameId && hoverFrameId !== connector.fromFrameId) {
        onConnectFrames(connector.fromFrameId, hoverFrameId);
      }
      setConnector(null);
      setHoverFrameId(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [connector, hoverFrameId, onConnectFrames]);

  useEffect(() => {
    const scaleEl = scaleRef.current;
    const trackEl = trackRef.current;
    const headerEl = headerRef.current;
    if (!scaleEl || !trackEl || !headerEl) return;
    const update = () => {
      const scaleRect = scaleEl.getBoundingClientRect();
      const trackRect = trackEl.getBoundingClientRect();
      const headerRect = headerEl.getBoundingClientRect();
      setScaleWidth(scaleRect.width);
      setTrackWidth(trackRect.width);
      setHeaderHeight(headerRect.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scaleEl);
    observer.observe(trackEl);
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="bottom-bar Timeline">
      <div className="timeline-body" ref={bodyRef}>
        {connector && (
          <svg className="timeline-connector-layer">
            <path
              d={`M ${connector.start.x} ${connector.start.y} C ${connector.start.x + 80} ${connector.start.y}, ${connector.current.x - 80} ${connector.current.y}, ${connector.current.x} ${connector.current.y}`}
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
            />
            <circle cx={connector.start.x} cy={connector.start.y} r="6" fill="#3b82f6" />
          </svg>
        )}
        <div className="track-list">
          <div className="timeline-track-header" style={{ height: headerHeight }}>
            <div className="timeline-label">Timeline Layers</div>
          </div>
          {showEmptyHint && (
            <div className="timeline-hint">
              Add Scene to create Frame 2 and generate motion.
            </div>
          )}
          {frames.map((frame) => (
            <div
              key={frame.id}
              data-frame-id={frame.id}
              className={`track-item ${frame.id === activeFrameId ? 'active' : ''} ${hoverFrameId === frame.id ? 'is-connector-target' : ''}`}
              onClick={() => onSelect(frame.id)}
            >
              <span className="track-dot">Sc</span>
              <span>{frame.name}</span>
              {panelMode === 'animate' && (
                <button
                  type="button"
                  className="transition-handle"
                  onMouseDown={(event) => handleConnectorStart(event, frame.id)}
                  aria-label="Connect transition"
                />
              )}
            </div>
          ))}
        </div>
        <div className="track-right" style={{ ['--timeline-header-height' as string]: `${headerHeight}px` }}>
          <div className="timeline-scale-header" ref={headerRef}>
            <div className="timeline-label">Timeline Scale</div>
            <div
              className="timeline-scale SceneStrip"
              ref={scaleRef}
              onMouseDown={(event) => onSeek(getTimeFromClientX(event.clientX, event.currentTarget))}
            >
              {Array.from({ length: ticks + 1 }).map((_, index) => (
                <div
                  key={index}
                  className="tick"
                  style={{ left: `${(index / ticks) * 100}%` }}
                >
                  <span>{((timelineDuration / 1000) * (index / ticks)).toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="timeline-playhead timeline-playhead-global"
            style={{ left: playheadX }}
            onMouseDown={handlePlayheadPointerDown}
          >
            <div className="timeline-playhead-cap">
              <div className="timeline-playhead-label">{timeLabel}</div>
              <div className="timeline-playhead-head" />
            </div>
            <div className="timeline-playhead-line timeline-playhead-line-global" />
          </div>
          <div
            className="track-timeline SceneStrip"
            ref={trackRef}
            onMouseDown={(event) => onSeek(getTimeFromClientX(event.clientX, event.currentTarget))}
          >
            {frames.map((frame) => {
              const transition = transitions.find((item) => item.fromFrameId === frame.id);
              const duration = transition?.duration ?? 1000;
              const width = timelineDuration > 0 ? (duration / timelineDuration) * trackWidth : 0;
              return (
                <div key={frame.id} className="track-row">
                  <Tooltip
                    title={`Transition duration: ${(duration / 1000).toFixed(1)}s`}
                    tooltipFor="play"
                  >
                    <div
                      className={`track-bar SceneBlock ${transition?.id === selectedTransitionId ? 'is-selected' : ''}`}
                      data-transition-id={transition?.id ?? ''}
                      data-duration-ms={duration}
                      data-onboarding={frame.id === frames[0]?.id ? 'scene-block' : undefined}
                      style={{ width }}
                      onClick={() => transition && onSelectTransition(transition.id)}
                    />
                  </Tooltip>
                  {frame.isHold && <span className="track-badge">Hold</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
