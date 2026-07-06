import { describe, expect, it } from 'vitest';

import { collectDocumentTags } from './tagAutocomplete';

describe('collectDocumentTags', () => {
  it('collects unique tags from the document', () => {
    const tags = collectDocumentTags('note #daily and #project/alpha plus #daily again');

    expect(tags).toEqual(['daily', 'project/alpha']);
  });

  it('ignores heading marks and mid-word hashes', () => {
    const tags = collectDocumentTags('# Heading\nurl#fragment\n#real');

    expect(tags).toEqual(['real']);
  });

  it('excludes the tag currently being typed', () => {
    const text = 'has #done and #do';
    const from = text.indexOf('#do', 5);
    const tags = collectDocumentTags(text, from, text.length + 1);

    expect(tags).toEqual(['done']);
  });
});
