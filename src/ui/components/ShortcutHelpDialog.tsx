import { useEffect } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/messages';
import { formatShortcut } from '../editor/slashCommandAutocomplete';
import { Icon } from './Icon';

interface ShortcutHelpDialogProps {
  open: boolean;
  onClose(): void;
}

interface ShortcutEntry {
  labelKey: MessageKey;
  keys: string;
}

const editingShortcuts: ShortcutEntry[] = [
  { labelKey: 'shortcutHelp.bold', keys: 'Mod-B' },
  { labelKey: 'shortcutHelp.italic', keys: 'Mod-I' },
  { labelKey: 'shortcutHelp.insertLink', keys: 'Mod-K' },
  { labelKey: 'shortcutHelp.cycleList', keys: 'Mod-L' },
  { labelKey: 'shortcutHelp.heading', keys: 'Mod-Shift-1~6' },
  { labelKey: 'shortcutHelp.undo', keys: 'Mod-Z' },
  { labelKey: 'shortcutHelp.redo', keys: 'Mod-Shift-Z' },
  { labelKey: 'shortcutHelp.moveLine', keys: 'Alt-↑/↓' },
  { labelKey: 'shortcutHelp.indent', keys: 'Tab' },
  { labelKey: 'shortcutHelp.outdent', keys: 'Shift-Tab' },
  { labelKey: 'shortcutHelp.deleteLine', keys: 'Mod-Shift-K' },
  { labelKey: 'shortcutHelp.slashMenu', keys: '/' }
];

const workspaceShortcuts: ShortcutEntry[] = [
  { labelKey: 'shortcutHelp.save', keys: 'Mod-S' },
  { labelKey: 'shortcutHelp.quickSwitcher', keys: 'Mod-O' },
  { labelKey: 'shortcutHelp.toggleMode', keys: 'Mod-E' },
  { labelKey: 'shortcutHelp.graphView', keys: 'Mod-G' },
  { labelKey: 'shortcutHelp.searchFiles', keys: 'Mod-Shift-F' },
  { labelKey: 'shortcutHelp.newNote', keys: 'Alt-N' },
  { labelKey: 'shortcutHelp.historyBack', keys: 'Mod-[' },
  { labelKey: 'shortcutHelp.historyForward', keys: 'Mod-]' },
  { labelKey: 'shortcutHelp.insertTemplate', keys: 'Alt-T' },
  { labelKey: 'shortcutHelp.dailyNote', keys: 'Alt-D' },
  { labelKey: 'shortcutHelp.recentTabs', keys: 'Alt-1~9' }
];

export function ShortcutHelpDialog({ open, onClose }: ShortcutHelpDialogProps) {
  const { t } = useI18n();

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
    <div className="settings-overlay" onMouseDown={onClose}>
      <section
        aria-labelledby="shortcut-help-title"
        aria-modal="true"
        className="shortcut-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shortcut-dialog-header">
          <h2 id="shortcut-help-title">{t('shortcutHelp.title')}</h2>
          <button aria-label={t('shortcutHelp.close')} className="settings-close" title={t('shortcutHelp.close')} type="button" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="shortcut-dialog-body">
          <ShortcutSection titleKey="shortcutHelp.editing" entries={editingShortcuts} />
          <ShortcutSection titleKey="shortcutHelp.workspace" entries={workspaceShortcuts} />
        </div>
      </section>
    </div>
  );
}

function ShortcutSection({ titleKey, entries }: { titleKey: MessageKey; entries: ShortcutEntry[] }) {
  const { t } = useI18n();

  return (
    <section className="shortcut-section">
      <h3>{t(titleKey)}</h3>
      <ul className="shortcut-list">
        {entries.map((entry) => (
          <li key={entry.labelKey}>
            <span>{t(entry.labelKey)}</span>
            <kbd>{formatShortcut(entry.keys)}</kbd>
          </li>
        ))}
      </ul>
    </section>
  );
}
