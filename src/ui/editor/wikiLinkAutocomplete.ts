import type { CompletionSource } from '@codemirror/autocomplete';

import type { VaultIndex } from '../../domain/vault/vaultIndex';

export function wikiLinkAutocomplete(index: VaultIndex): CompletionSource {
  return (context) => {
    const word = context.matchBefore(/\[\[[^\]]*/);
    if (!word) {
      return null;
    }

    const query = word.text.replace('[[', '');
    return {
      from: word.from,
      options: index.searchFiles(query).map((file) => ({
        label: `[[${file.title}]]`,
        detail: file.ambiguous ? `${file.path} - duplicate title` : file.path,
        apply: `[[${file.title}]]`
      }))
    };
  };
}
