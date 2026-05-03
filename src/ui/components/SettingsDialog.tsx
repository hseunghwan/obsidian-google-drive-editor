import { useEffect } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { Locale } from '../../i18n/messages';
import { useTheme, type ThemeMode } from '../../theme/ThemeProvider';
import { Icon } from './Icon';

interface SettingsDialogProps {
  open: boolean;
  onClose(): void;
  onSwitchGoogleAccount?(): void;
}

export function SettingsDialog({ open, onClose, onSwitchGoogleAccount }: SettingsDialogProps) {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="settings-overlay">
      <section aria-labelledby="settings-title" aria-modal="true" className="settings-dialog" role="dialog">
        <aside className="settings-sidebar" aria-label={t('settings.label')}>
          <h2 id="settings-title">{t('settings.label')}</h2>
          <button className="settings-sidebar-item active" type="button">
            <Icon name="settings" />
            {t('settings.general')}
          </button>
        </aside>
        <div className="settings-content">
          <button aria-label={t('settings.close')} className="settings-close" title={t('settings.close')} type="button" onClick={onClose}>
            <Icon name="x" />
          </button>
          <section className="settings-card" aria-labelledby="settings-general-title">
            <h3 id="settings-general-title">{t('settings.general')}</h3>
            <label className="setting-row">
              <span className="setting-copy">
                <span className="setting-title">{t('settings.language')}</span>
                <span className="setting-helper">{t('settings.languageHelp')}</span>
              </span>
              <select aria-label={t('settings.language')} value={locale} onChange={(event) => setLocale(event.currentTarget.value as Locale)}>
                <option value="ko">{t('language.ko')}</option>
                <option value="en">{t('language.en')}</option>
              </select>
            </label>
            <label className="setting-row">
              <span className="setting-copy">
                <span className="setting-title">{t('settings.theme')}</span>
                <span className="setting-helper">{t('settings.themeHelp')}</span>
              </span>
              <select aria-label={t('settings.theme')} value={theme} onChange={(event) => setTheme(event.currentTarget.value as ThemeMode)}>
                <option value="dark">{t('theme.dark')}</option>
                <option value="light">{t('theme.light')}</option>
              </select>
            </label>
            {onSwitchGoogleAccount ? (
              <div className="setting-row">
                <span className="setting-copy">
                  <span className="setting-title">{t('settings.googleAccount')}</span>
                  <span className="setting-helper">{t('settings.googleAccountHelp')}</span>
                </span>
                <button className="settings-action-button" type="button" onClick={onSwitchGoogleAccount}>
                  <Icon name="refresh-cw" />
                  {t('settings.switchGoogleAccount')}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
