import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type TooltipContextValue = {
  delayDuration: number;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

type TooltipProviderProps = {
  delayDuration?: number;
  children: ReactNode;
};

export const TooltipProvider: React.FC<TooltipProviderProps> = ({
  delayDuration = 300,
  children
}) => {
  const value = useMemo(() => ({ delayDuration }), [delayDuration]);
  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>;
};

type TooltipProps = {
  title: string;
  subtext?: string;
  tooltipFor: string;
  children: ReactNode;
  anchorClassName?: string;
  anchorStyle?: CSSProperties;
};

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  subtext,
  tooltipFor,
  children,
  anchorClassName,
  anchorStyle
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const context = useContext(TooltipContext);
  const delay = context?.delayDuration ?? 300;

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const handleEnter = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(true), delay);
  };

  const handleLeave = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  };

  return (
    <span
      className={cn('TooltipAnchor', anchorClassName)}
      style={anchorStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <span
        className={`Tooltip ${visible ? 'is-visible' : ''}`}
        data-tooltip-for={tooltipFor}
        role="tooltip"
      >
        <span className="TooltipTitle">{title}</span>
        {subtext && <span className="TooltipSubtext">{subtext}</span>}
      </span>
    </span>
  );
};
