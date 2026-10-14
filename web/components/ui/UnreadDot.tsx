export function UnreadDot({ label = "New messages" }: { label?: string }) {
  return (
    <span className="relative inline-flex size-2.5 flex-none" title={label}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-apricot-500 opacity-70" />
      <span className="relative size-2.5 rounded-full bg-apricot-500 ring-2 ring-white" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
