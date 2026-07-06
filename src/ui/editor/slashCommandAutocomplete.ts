import type { CompletionSource } from '@codemirror/autocomplete';

import type { MessageKey } from '../../i18n/messages';
import { slashCommands } from './slashCommands';

type MessageLookup = Record<MessageKey, string>;

export const slashCommandPattern = /\/[^\s]*/;

export function buildSlashCommandOptions(query: string, messages: MessageLookup) {
  const normalizedQuery = query.toLocaleLowerCase();

  return slashCommands
    .map((command) => {
      const label = messages[command.labelKey];

      return {
        command,
        label
      };
    })
    .filter(({ command, label }) => {
      return command.id.includes(normalizedQuery) || label.toLocaleLowerCase().includes(normalizedQuery);
    })
    .map(({ command, label }) => ({
      label,
      detail: command.shortcut ? formatShortcut(command.shortcut) : undefined,
      apply: command.insertText
    }));
}

export function formatShortcut(key: string) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const parts = key.split('-').map((part) => {
    if (part === 'Mod') {
      return isMac ? '⌘' : 'Ctrl';
    }
    if (part === 'Shift') {
      return isMac ? '⇧' : 'Shift';
    }
    return part.toUpperCase();
  });
  return parts.join(isMac ? '' : '+');
}

export function slashCommandAutocomplete(messages: MessageLookup): CompletionSource {
  return (context) => {
    const word = context.matchBefore(slashCommandPattern);
    if (!word) {
      return null;
    }

    if (word.from === word.to && !context.explicit) {
      return null;
    }

    const query = word.text.slice(1);

    return {
      from: word.from,
      filter: false,
      options: buildSlashCommandOptions(query, messages)
    };
  };
}
