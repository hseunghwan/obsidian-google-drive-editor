import type { SaveStatus as SaveStatusValue } from '../state/workspaceReducer';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface SaveStatusProps {
  status: SaveStatusValue;
  onSave(): void;
}

export function SaveStatus({ status, onSave }: SaveStatusProps) {
  const { t } = useI18n();

  return (
    <div className={`save-status save-status-${status}`}>
      <span>
        <Icon name={saveStatusIcon[status]} />
        {t(`save.${status}`)}
      </span>
      <button type="button" onClick={onSave}>
        <Icon name="save" />
        {t('save.button')}
      </button>
    </div>
  );
}

const saveStatusIcon: Record<SaveStatusValue, 'alert-triangle' | 'check' | 'refresh-cw' | 'save'> = {
  conflict: 'alert-triangle',
  dirty: 'save',
  failed: 'alert-triangle',
  idle: 'save',
  saved: 'check',
  saving: 'refresh-cw'
};
