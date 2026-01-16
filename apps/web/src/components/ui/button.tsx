import * as React from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'toolbar' | 'icon' | 'menuitem';
  size?: 'sm' | 'md' | 'icon';
};

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'btn',
  outline: 'btn btn-outline',
  ghost: 'icon-btn',
  toolbar: 'btn ToolbarButton',
  icon: 'tool-btn ToolIcon',
  menuitem: 'menu-item'
};

const sizeClass: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'btn-sm',
  md: '',
  icon: 'btn-icon'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  )
);

Button.displayName = 'Button';
