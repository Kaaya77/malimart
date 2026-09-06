import React, { useEffect } from "react";

export const UnsavedChangesBar: React.FC<{ dirty?: boolean; onSave?: () => void; onDiscard?: () => void }> = ({ dirty = false, onSave, onDiscard }) => {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = "You have unsaved changes";
      return "You have unsaved changes";
    };

    if (dirty) window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (!dirty) return null;

  return (
    <div className="unsaved-bar fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex items-center justify-between shadow-lg z-50" role="alert" aria-live="polite">
      <div className="text-sm">You have unsaved changes</div>
      <div className="flex gap-2">
        <button onClick={onDiscard} className="btn" aria-label="Discard changes">Discard</button>
        <button onClick={onSave} className="btn btn-primary" aria-label="Save changes">Save</button>
      </div>
    </div>
  );
};

export default UnsavedChangesBar;
