import { cn } from '@/lib/utils';

interface DropIndicatorProps {
  beforeId: string | null;
  columnId: string;
  isVisible: boolean;
}

export function DropIndicator({ beforeId, columnId, isVisible }: DropIndicatorProps) {
  return (
    <div
      data-before-id={beforeId}
      data-column-id={columnId}
      className={cn(
        "absolute left-0 right-0 h-0.5 transition-opacity",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 bg-primary rounded-full" />
        <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-primary" />
        <div className="absolute -right-1 -top-1.5 w-3 h-3 rounded-full bg-primary" />
      </div>
    </div>
  );
}