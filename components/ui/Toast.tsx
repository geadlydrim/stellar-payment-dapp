export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed left-1/2 bottom-7 z-30 bg-[rgba(20,24,30,0.96)] backdrop-blur-md border border-[#5EEAD4]/25 rounded-2xl py-3.5 px-5 flex items-center gap-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-[qf-toast-in_0.3s_ease-out_forwards]">
      <p className="text-sm text-white/[0.92] font-medium whitespace-nowrap">{message}</p>
      <button
        onClick={onDismiss}
        className="border-none bg-transparent text-white/40 hover:text-white/70 cursor-pointer text-base leading-none p-0.5"
      >
        ✕
      </button>
    </div>
  );
}
