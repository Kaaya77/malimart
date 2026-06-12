// =====================================================================
// ConfirmDialog.tsx — ONE destructive-action pattern for the whole app.
// Use it for cancelling orders, deleting messages, clearing
// notifications, revoking sessions. Consistency = trust.
// =====================================================================
import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;       // e.g. "Cancel order"
  tone?: "danger" | "neutral";
  requireReason?: boolean;     // shows a textarea, passed to onConfirm
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = "Confirm",
  tone = "danger", requireReason = false,
  reasonPlaceholder = "Tell us why (optional)", onConfirm, onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setReason(""); setError(null); setBusy(false); }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      await onConfirm(requireReason ? reason : undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        ref={ref}
        role="alertdialog" aria-modal="true" aria-label={title}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{description}</p>

        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            maxLength={500}
            className="mt-4 w-full rounded-xl border border-neutral-200 dark:border-neutral-700
                       bg-transparent p-3 text-sm focus:outline-none focus:ring-2
                       focus:ring-[var(--mm-accent)]"
          />
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose} disabled={busy}
            className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700
                       py-2.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Keep it
          </button>
          <button
            onClick={confirm} disabled={busy}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60
              ${tone === "danger" ? "bg-red-600 hover:bg-red-700"
                                  : "bg-[var(--mm-accent)] hover:opacity-90"}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
