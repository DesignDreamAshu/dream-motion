import * as React from 'react';
import { cn } from '../../lib/utils';

type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'info' | 'warning' | 'error';
};

export const ToastViewport: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn('ToastViewport', className)} {...props} />;

export const Toast: React.FC<ToastProps> = ({ className, variant = 'info', ...props }) => (
  <div className={cn('Toast', `is-${variant}`, className)} {...props} />
);
