import { describe, expect, it } from 'vitest';

import { applyTemplateVariables, formatDailyNoteTitle } from './templates';

const now = new Date(2026, 6, 7, 9, 5);

describe('applyTemplateVariables', () => {
  it('replaces title, date, and time variables', () => {
    const result = applyTemplateVariables('# {{title}}\n{{date}} {{time}}\n{{date}}', {
      title: '회의록',
      now
    });

    expect(result).toBe('# 회의록\n2026-07-07 09:05\n2026-07-07');
  });

  it('leaves unknown variables untouched', () => {
    expect(applyTemplateVariables('{{unknown}}', { title: 'x', now })).toBe('{{unknown}}');
  });
});

describe('formatDailyNoteTitle', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(formatDailyNoteTitle(now)).toBe('2026-07-07');
  });
});
