import * as React from 'react';
import { cn } from '../../lib/utils';

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export const ScrollArea: React.FC<ScrollAreaProps> = ({ className, ...props }) => (
  <div className={cn('ScrollArea', className)} {...props} />
);
