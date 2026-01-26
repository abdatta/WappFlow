import { MoreVertical } from "lucide-preact";
import { useRef, useEffect } from "preact/hooks";
import "./DropdownMenu.css";

export interface DropdownMenuItem {
  label: string;
  icon?: any;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DropdownMenu({
  items,
  isOpen,
  onOpenChange,
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div class="dropdown-menu-container" ref={containerRef}>
      <button
        class="dropdown-trigger"
        onClick={() => onOpenChange(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <>
          <div class="dropdown-backdrop" onClick={() => onOpenChange(false)} />
          <div class="dropdown-menu">
            {items.map((item, idx) => (
              <button
                key={idx}
                class={`dropdown-item ${item.danger ? "dropdown-item--danger" : ""}`}
                onClick={() => {
                  item.onClick();
                  onOpenChange(false);
                }}
              >
                {item.icon && <item.icon size={16} />}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
