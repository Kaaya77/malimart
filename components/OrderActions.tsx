// =====================================================================
// OrderActions.tsx — drop into any order card or order detail page.
// <OrderActions orderId={o.id} status={o.status} onChanged={refetch} />
// Cancel restores stock + notifies, server-side. Remove hides terminal
// orders from history (soft delete; admin/seller views unaffected).
// =====================================================================
import { useState } from "react";
import { cancelOrder, hideOrder } from "../services/accountApi";
import ConfirmDialog from "./ConfirmDialog";

const CANCELLABLE = ["pending", "processing", "confirmed"];
const REMOVABLE = ["delivered", "cancelled", "failed", "refunded"];

export function OrderActions({
  orderId, status, onChanged,
}: { orderId: string; status: string; onChanged: () => void }) {
  const [dialog, setDialog] = useState<null | "cancel" | "remove">(null);

  const canCancel = CANCELLABLE.includes(status);
  const canRemove = REMOVABLE.includes(status);
  if (!canCancel && !canRemove) return null;

  return (
    <>
      <div className="flex gap-2">
        {canCancel && (
          <button onClick={() => setDialog("cancel")}
            className="rounded-xl border border-red-200 dark:border-red-900 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
            Cancel order
          </button>
        )}
        {canRemove && (
          <button onClick={() => setDialog("remove")}
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900">
            Remove from history
          </button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "cancel"}
        title="Cancel this order?"
        description="Items return to stock and any payment made will be refunded to your original payment method."
        confirmLabel="Cancel order"
        requireReason
        reasonPlaceholder="Why are you cancelling? (helps sellers improve)"
        onConfirm={async (reason) => { await cancelOrder(orderId, reason ?? ""); onChanged(); }}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "remove"}
        title="Remove from your history?"
        description="This hides the order from your order list. Records are kept for receipts and disputes."
        confirmLabel="Remove"
        onConfirm={async () => { await hideOrder(orderId); onChanged(); }}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
