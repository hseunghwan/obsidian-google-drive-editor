import type { CompletionSource } from '@codemirror/autocomplete';

const tagWordPattern = /#[\p{L}\p{N}/_-]*/u;
const documentTagPattern = /(^|[\s(])#([\p{L}\p{N}/_-]*\p{L}[\p{L}\p{N}/_-]*)/gu;

export function collectDocumentTags(text: string, excludeFrom?: number, excludeTo?: number): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(documentTagPattern)) {
    const from = match.index + match[1].length;
    if (excludeFrom !== undefined && excludeTo !== undefined && from >= excludeFrom && from < excludeTo) {
      continue;
    }
    tags.add(match[2]);
  }
  return [...tags].sort((left, right) => left.localeCompare(right));
}

export const tagAutocomplete: CompletionSource = (context) => {
  const word = context.matchBefore(tagWordPattern);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const tags = collectDocumentTags(context.state.doc.toString(), word.from, word.to + 1);
  if (tags.length === 0) {
    return null;
  }

  return {
    from: word.from + 1,
    options: tags.map((tag) => ({ label: tag, type: 'keyword' })),
    validFor: /^[\p{L}\p{N}/_-]*$/u
  };
};
