export function Section({
  disabled,
  action,
  children,
}: {
  disabled?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[var(--qf-card-bg)] backdrop-blur-xl border border-[var(--qf-card-border)] rounded-[28px] p-5 sm:p-7"
      style={disabled ? { opacity: 0.45 } : undefined}
    >
      {action && <div className="flex items-center justify-end mb-1">{action}</div>}
      {children}
    </div>
  );
}
