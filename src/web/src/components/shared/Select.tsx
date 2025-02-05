// @radix-ui/react-select ^1.0.0
// @radix-ui/react-icons ^1.0.0
// @tanstack/react-virtual ^4.0.0
// react ^18.0.0

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { useVirtual } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
  description?: string;
  groupId?: string;
  customRender?: (option: SelectOption) => React.ReactNode;
}

export interface SelectProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  loading?: boolean;
  virtualize?: boolean;
  className?: string;
  'aria-label'?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ options, value, onChange, placeholder, disabled, error, loading, virtualize = false, className, 'aria-label': ariaLabel }, ref) => {
    const [open, setOpen] = React.useState(false);
    const parentRef = React.useRef<HTMLDivElement>(null);
    
    // Group options if groupId is present
    const groupedOptions = React.useMemo(() => {
      const groups: Record<string, SelectOption[]> = {};
      options.forEach(option => {
        const groupId = option.groupId || 'default';
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(option);
      });
      return groups;
    }, [options]);

    // Setup virtualization for large option lists
    const { virtualItems, totalSize } = useVirtual({
      size: options.length,
      parentRef: virtualize ? parentRef : null,
      estimateSize: React.useCallback(() => 35, []),
      overscan: 5,
    });

    // Get display value for selected option(s)
    const getDisplayValue = () => {
      if (Array.isArray(value)) {
        return options
          .filter(opt => value.includes(opt.value))
          .map(opt => opt.label)
          .join(', ');
      }
      return options.find(opt => opt.value === value)?.label || '';
    };

    const selectStyles = cn(
      // Base styles following Material Design 3.0
      'relative w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'motion-safe:transition-colors motion-safe:duration-200',
      // State-based styles
      disabled && 'cursor-not-allowed opacity-50',
      error && 'border-destructive',
      loading && 'animate-pulse',
      className
    );

    const contentStyles = cn(
      'relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
      'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95'
    );

    return (
      <div className="relative">
        <SelectPrimitive.Root
          value={Array.isArray(value) ? value[0] : value}
          onValueChange={onChange}
          disabled={disabled || loading}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            className={selectStyles}
            aria-label={ariaLabel}
            aria-invalid={!!error}
            aria-describedby={error ? 'select-error' : undefined}
          >
            <span className="flex items-center gap-2">
              <SelectPrimitive.Value placeholder={placeholder}>
                {getDisplayValue()}
              </SelectPrimitive.Value>
            </span>
            <SelectPrimitive.Icon className="ml-2">
              {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content className={contentStyles}>
              <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 bg-background">
                <ChevronUpIcon />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport
                ref={parentRef}
                className={cn(
                  'p-1',
                  virtualize && 'max-h-[300px] overflow-auto'
                )}
                style={virtualize ? { height: totalSize } : undefined}
              >
                {virtualize ? (
                  virtualItems.map(virtualRow => (
                    <SelectOption
                      key={options[virtualRow.index].value}
                      option={options[virtualRow.index]}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    />
                  ))
                ) : (
                  Object.entries(groupedOptions).map(([groupId, groupOptions]) => (
                    <React.Fragment key={groupId}>
                      {groupId !== 'default' && (
                        <SelectPrimitive.Group className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {groupId}
                        </SelectPrimitive.Group>
                      )}
                      {groupOptions.map(option => (
                        <SelectOption key={option.value} option={option} />
                      ))}
                    </React.Fragment>
                  ))
                )}
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 bg-background">
                <ChevronDownIcon />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {error && (
          <p id="select-error" className="mt-1 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

const SelectOption = React.forwardRef<
  HTMLDivElement,
  { option: SelectOption; style?: React.CSSProperties }
>(({ option, style }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    value={option.value}
    disabled={option.disabled}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-accent focus:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'motion-safe:transition-colors'
    )}
    style={style}
  >
    <SelectPrimitive.ItemText>
      {option.customRender ? (
        option.customRender(option)
      ) : (
        <div className="flex flex-col">
          <span>{option.label}</span>
          {option.description && (
            <span className="text-xs text-muted-foreground">{option.description}</span>
          )}
        </div>
      )}
    </SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2">
      <CheckIcon className="w-4 h-4" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));

Select.displayName = 'Select';
SelectOption.displayName = 'SelectOption';

export default Select;