"use client";

import * as React from "react"; // @version ^18.0.0
import { cva, type VariantProps } from "class-variance-authority"; // @version ^0.7.0
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"; // @version ^2.0.6
import { useVirtualizer } from "@tanstack/react-virtual"; // @version ^3.0.0
import { useTranslation } from "react-i18next"; // @version ^13.0.0
import { cn } from "../../lib/utils";
import { Button } from "./Button";

// Dropdown variants following Material Design 3.0 principles
const dropdownVariants = cva(
  "relative w-full rounded-md shadow-sm text-left",
  {
    variants: {
      variant: {
        default: "bg-background border border-input hover:border-primary/50",
        compact: "bg-background border border-input text-sm",
        borderless: "bg-background shadow-none",
      },
      size: {
        sm: "min-h-[32px]",
        md: "min-h-[40px]",
        lg: "min-h-[48px]",
      },
      state: {
        error: "border-destructive focus-within:ring-destructive",
        disabled: "opacity-50 cursor-not-allowed bg-muted",
        loading: "animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Types for dropdown options and props
interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

interface DropdownProps extends 
  React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof dropdownVariants> {
  options: DropdownOption[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  searchable?: boolean;
  multiple?: boolean;
  virtualScroll?: boolean;
  i18nNamespace?: string;
}

// Custom hook for keyboard navigation
const useDropdownKeyboard = (
  options: DropdownOption[],
  onSelect: (value: string) => void
) => {
  const [focusIndex, setFocusIndex] = React.useState(-1);
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchTimeout = React.useRef<NodeJS.Timeout>();

  const handleKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusIndex((prev) => 
            prev < options.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          event.preventDefault();
          if (focusIndex >= 0) {
            onSelect(options[focusIndex].value);
          }
          break;
        default:
          // Type-ahead search
          if (event.key.length === 1) {
            clearTimeout(searchTimeout.current);
            setSearchQuery((prev) => prev + event.key);
            const matchIndex = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(searchQuery.toLowerCase())
            );
            if (matchIndex >= 0) {
              setFocusIndex(matchIndex);
            }
            searchTimeout.current = setTimeout(() => setSearchQuery(""), 1000);
          }
      }
    },
    [focusIndex, options, onSelect, searchQuery]
  );

  React.useEffect(() => {
    return () => {
      clearTimeout(searchTimeout.current);
    };
  }, []);

  return { focusIndex, handleKeyDown };
};

const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      className,
      variant,
      size,
      state,
      options,
      value,
      onChange,
      placeholder = "Select an option",
      disabled = false,
      loading = false,
      error,
      searchable = false,
      multiple = false,
      virtualScroll = false,
      i18nNamespace = "common",
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation(i18nNamespace);
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");
    const listRef = React.useRef<HTMLDivElement>(null);

    // Virtual scroll setup
    const rowVirtualizer = virtualScroll
      ? useVirtualizer({
          count: options.length,
          getScrollElement: () => listRef.current,
          estimateSize: () => 40,
          overscan: 5,
        })
      : null;

    // Filter options based on search
    const filteredOptions = React.useMemo(() => {
      if (!searchable || !search) return options;
      return options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase())
      );
    }, [options, search, searchable]);

    // Keyboard navigation
    const { focusIndex, handleKeyDown } = useDropdownKeyboard(
      filteredOptions,
      (selectedValue) => {
        if (multiple) {
          const currentValues = (value as string[]) || [];
          const newValues = currentValues.includes(selectedValue)
            ? currentValues.filter((v) => v !== selectedValue)
            : [...currentValues, selectedValue];
          onChange(newValues);
        } else {
          onChange(selectedValue);
          setOpen(false);
        }
      }
    );

    // Selected value display
    const selectedLabel = React.useMemo(() => {
      if (multiple && Array.isArray(value)) {
        return value.length
          ? `${value.length} ${t("selected")}`
          : placeholder;
      }
      const selected = options.find((opt) => opt.value === value);
      return selected ? selected.label : placeholder;
    }, [value, options, multiple, placeholder, t]);

    return (
      <div
        ref={ref}
        className={cn(
          dropdownVariants({ variant, size, state: error ? "error" : state }),
          className
        )}
        {...props}
      >
        <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
          <DropdownMenuPrimitive.Trigger asChild>
            <Button
              variant="outline"
              size={size}
              className="w-full justify-between"
              disabled={disabled}
              aria-invalid={!!error}
              aria-errormessage={error}
            >
              <span className="truncate">{selectedLabel}</span>
              <span className="ml-2 h-4 w-4">
                {loading ? (
                  <span className="animate-spin">⌛</span>
                ) : (
                  <span>▼</span>
                )}
              </span>
            </Button>
          </DropdownMenuPrimitive.Trigger>

          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              className="z-50 min-w-[200px] max-h-[300px] overflow-auto rounded-md border bg-popover p-1 shadow-md"
              align="start"
              side="bottom"
              sideOffset={4}
            >
              {searchable && (
                <div className="px-2 py-1.5">
                  <input
                    type="text"
                    className="w-full rounded-sm px-2 py-1 text-sm border border-input"
                    placeholder={t("search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              <div ref={listRef} className="py-1">
                {virtualScroll
                  ? rowVirtualizer?.getVirtualItems().map((virtualRow) => (
                      <DropdownMenuPrimitive.Item
                        key={virtualRow.index}
                        className={cn(
                          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                          {
                            "bg-accent text-accent-foreground":
                              focusIndex === virtualRow.index,
                            "opacity-50": options[virtualRow.index].disabled,
                          }
                        )}
                        disabled={options[virtualRow.index].disabled}
                        onSelect={() => onChange(options[virtualRow.index].value)}
                      >
                        {multiple && (
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={Array.isArray(value) && value.includes(options[virtualRow.index].value)}
                            readOnly
                          />
                        )}
                        {options[virtualRow.index].label}
                      </DropdownMenuPrimitive.Item>
                    ))
                  : filteredOptions.map((option, index) => (
                      <DropdownMenuPrimitive.Item
                        key={option.value}
                        className={cn(
                          "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                          {
                            "bg-accent text-accent-foreground":
                              focusIndex === index,
                            "opacity-50": option.disabled,
                          }
                        )}
                        disabled={option.disabled}
                        onSelect={() => onChange(option.value)}
                      >
                        {multiple && (
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={Array.isArray(value) && value.includes(option.value)}
                            readOnly
                          />
                        )}
                        {option.label}
                      </DropdownMenuPrimitive.Item>
                    ))}
              </div>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
        {error && (
          <span className="text-destructive text-sm mt-1">{error}</span>
        )}
      </div>
    );
  }
);

Dropdown.displayName = "Dropdown";

export { Dropdown, dropdownVariants };
export type { DropdownOption, DropdownProps };