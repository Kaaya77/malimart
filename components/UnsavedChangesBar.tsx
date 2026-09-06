import React from "react";

export const UnsavedChangesBar: React.FC<{ dirty?: boolean; onSave?: () => void; onDiscard?: () => void }> = ({ dirty = false, onSave, onDiscard }) => {
  if (!dirty) return null;

  return (
    <div className="unsaved-bar fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex items-center justify-between shadow-lg" role="alert" aria-live="polite">
      <div className="text-sm">You have unsaved changes</div>
      <div className="flex gap-2">
        <button onClick={onDiscard} className="btn">Discard</button>
        <button onClick={onSave} className="btn btn-primary">Save</button>
      </div>
    </div>
  );
};

export default UnsavedChangesBar;
