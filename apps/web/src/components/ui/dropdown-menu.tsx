import * as React from 'react';
import { cn } from '../../lib/utils';

type DropdownContextValue = {
  open: boolean;
  setOpen: (value: boolean) => void;
  close: () => void;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

type DropdownMenuProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  open: controlledOpen,
  onOpenChange,
  children
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(value);
    }
    onOpenChange?.(value);
  };

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      close: () => setOpen(false)
    }),
    [open]
  );

  return (
    <DropdownContext.Provider value={value}>
      <div className="menu-group">{children}</div>
    </DropdownContext.Provider>
  );
};

type DropdownMenuTriggerProps = {
  children: React.ReactElement;
};

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children }) => {
  const context = React.useContext(DropdownContext);
  if (!context) return children;
  return React.cloneElement(children, {
    onClick: (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      context.setOpen(!context.open);
    },
    onBlur: (event: React.FocusEvent) => {
      children.props.onBlur?.(event);
      window.setTimeout(() => context.setOpen(false), 120);
    },
    'aria-expanded': context.open
  });
};

type DropdownMenuContentProps = React.HTMLAttributes<HTMLDivElement>;

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ className, ...props }) => {
  const context = React.useContext(DropdownContext);
  if (!context?.open) return null;
  return <div className={cn('menu-popover', className)} {...props} />;
};

type DropdownMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onSelect?: () => void;
};

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  className,
  onSelect,
  onClick,
  ...props
}) => {
  const context = React.useContext(DropdownContext);
  return (
    <button
      className={cn('menu-item', className)}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick?.(event);
        onSelect?.();
        context?.close();
      }}
      {...props}
    />
  );
};

export const DropdownMenuSeparator: React.FC = () => <div className="menu-divider" />;
