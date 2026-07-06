import { describe, expect, it } from 'vitest';

import { messages } from '../../i18n/messages';
import { slashCommandAutocomplete, buildSlashCommandOptions, formatShortcut, slashCommandPattern } from './slashCommandAutocomplete';

describe('buildSlashCommandOptions', () => {
  it('localizes slash command labels to Korean', () => {
    const options = buildSlashCommandOptions('', messages.ko);

    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '마크다운 링크',
          detail: formatShortcut('Mod-k')
        }),
        expect.objectContaining({
          label: '프로퍼티',
          detail: undefined
        })
      ])
    );
  });

  it('localizes slash command labels to English and searches localized text', () => {
    const options = buildSlashCommandOptions('wiki', messages.en);

    expect(options).toEqual([
      expect.objectContaining({
        label: 'Wiki link'
      })
    ]);
  });

  it('exposes block insertion commands', () => {
    const labels = buildSlashCommandOptions('', messages.ko).map((option) => option.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        '제목 1',
        '제목 2',
        '제목 3',
        '글머리 목록',
        '숫자 목록',
        '체크박스',
        '인용구',
        '코드 블록',
        '수평선',
        '표',
        '콜아웃'
      ])
    );
  });

  it('matches block commands by localized label', () => {
    const options = buildSlashCommandOptions('체크', messages.ko);

    expect(options).toEqual([
      expect.objectContaining({ label: '체크박스', apply: '- [ ] ' })
    ]);
  });

  it('shows keyboard shortcuts as option details', () => {
    const options = buildSlashCommandOptions('제목 1', messages.ko);

    expect(options).toEqual([
      expect.objectContaining({ label: '제목 1', detail: formatShortcut('Mod-Shift-1') })
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
          label: '마크다운 링크'
        })
      ])
    });
  });
});
