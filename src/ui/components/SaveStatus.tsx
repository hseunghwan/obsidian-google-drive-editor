import type { SaveStatus as SaveStatusValue } from '../state/workspaceReducer';

interface SaveStatusProps {
  status: SaveStatusValue;
  message: string;
  onSave(): void;
}

export function SaveStatus({ status, message, onSave }: SaveStatusProps) {
  return (
    <div className={`save-status save-status-${status}`}>
      <span>{message}</span>
      <button type="button" onClick={onSave}>
        저장
      </button>
    </div>
  );
}
