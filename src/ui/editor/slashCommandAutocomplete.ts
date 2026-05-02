import type { CompletionSource } from '@codemirror/autocomplete';

import { slashCommands } from './slashCommands';

export const slashCommandAutocomplete: CompletionSource = (context) => {
  const word = context.matchBefore(/\/[A-Za-z-]*/);
  if (!word) {
    return null;
  }

  if (word.from === word.to && !context.explicit) {
    return null;
  }

  const query = word.text.slice(1).toLocaleLowerCase();
  return {
    from: word.from,
    options: slashCommands
      .filter((command) => command.id.includes(query) || command.label.toLocaleLowerCase().includes(query))
      .map((command) => ({
        label: `/${command.id}`,
        detail: command.label,
        apply: command.insertText
      }))
  };
};
