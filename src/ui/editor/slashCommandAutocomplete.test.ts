import { describe, expect, it } from 'vitest';

import { messages } from '../../i18n/messages';
import { buildSlashCommandOptions, slashCommandPattern } from './slashCommandAutocomplete';

describe('buildSlashCommandOptions', () => {
  it('localizes slash command labels to Korean', () => {
    const options = buildSlashCommandOptions('', messages.ko);

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '마크다운 링크',
          detail: '/link'
        }),
        expect.objectContaining({
          label: '프로퍼티',
          detail: '/property'
        })
      ])
    );
  });

  it('localizes slash command labels to English and searches localized text', () => {
    const options = buildSlashCommandOptions('wiki', messages.en);

    expect(options).toEqual([
      expect.objectContaining({
        label: 'Wiki link',
        detail: '/wikilink'
      })
    ]);
  });

  it('matches localized slash command queries', () => {
    expect('/위키'.match(slashCommandPattern)?.[0]).toBe('/위키');
  });
});
