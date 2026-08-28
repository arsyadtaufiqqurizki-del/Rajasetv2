import { useId } from 'react';

interface ValueWithTooltipProps {
  value: string;
  full: string;
}

/** Shows the compact value with the full precision figure available on hover or keyboard focus. */
export default function ValueWithTooltip({ value, full }: ValueWithTooltipProps) {
  const tooltipId = useId();
  return (
    <div className="relative group w-fit">
      <button
        type="button"
        aria-describedby={tooltipId}
        className="cursor-help bg-transparent border-0 p-0 m-0 text-inherit [font:inherit] underline decoration-dotted decoration-on-surface-variant/50 underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {value}
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-0 bottom-full mb-1 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs font-medium text-on-surface-variant opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {full}
      </div>
    </div>
  );
}
