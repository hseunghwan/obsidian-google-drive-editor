import { describe, expect, it } from 'vitest';

import { messages } from '../../i18n/messages';
import { slashCommandAutocomplete, buildSlashCommandOptions, slashCommandPattern } from './slashCommandAutocomplete';

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

  it('keeps slash trigger results visible when labels are localized', () => {
    const source = slashCommandAutocomplete(messages.ko);
    const result = source({
      explicit: false,
      matchBefore: () => ({ from: 0, to: 1, text: '/' })
    } as never);

    expect(result).toMatchObject({
      from: 0,
      filter: false,
      options: expect.arrayContaining([
        expect.objectContaining({
          label: '마크다운 링크',
          detail: '/link'
        })
      ])
    });
  });
});
