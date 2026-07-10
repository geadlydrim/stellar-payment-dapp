export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed left-1/2 bottom-7 z-30 bg-[var(--qf-toast-bg)] backdrop-blur-md border border-[var(--qf-toast-border)] rounded-2xl py-3.5 px-5 flex items-center gap-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] animate-[qf-toast-in_0.3s_ease-out_forwards]">
      <p className="text-sm text-[var(--qf-text-1)] font-medium whitespace-nowrap">{message}</p>
      <button
        onClick={onDismiss}
        className="border-none bg-transparent text-[var(--qf-text-3)] hover:text-[var(--qf-text-1)] cursor-pointer text-base leading-none p-0.5"
      >
        ✕
      </button>
    </div>
  );
}
