import * as React from 'react';
import { cn } from '../../lib/utils';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  onValueChange: (value: string) => void;
};

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, className, ...props }) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div className={cn('Tabs', className)} {...props} />
  </TabsContext.Provider>
);

type TabsListProps = React.HTMLAttributes<HTMLDivElement>;

export const TabsList: React.FC<TabsListProps> = ({ className, ...props }) => (
  <div className={cn('TabsList', className)} {...props} />
);

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context?.value === value;
    return (
      <button
        ref={ref}
        className={cn(className, isActive ? 'is-active' : '')}
        data-state={isActive ? 'active' : 'inactive'}
        onClick={(event) => {
          onClick?.(event);
          context?.onValueChange(value);
        }}
        {...props}
      />
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';
