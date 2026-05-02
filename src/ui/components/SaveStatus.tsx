import type { SaveStatus as SaveStatusValue } from '../state/workspaceReducer';
import { useI18n } from '../../i18n/I18nProvider';

interface SaveStatusProps {
  status: SaveStatusValue;
  onSave(): void;
}

export function SaveStatus({ status, onSave }: SaveStatusProps) {
  const { t } = useI18n();

  return (
    <div className={`save-status save-status-${status}`}>
      <span>{t(`save.${status}`)}</span>
      <button type="button" onClick={onSave}>
        {t('save.button')}
      </button>
    </div>
  );
}
