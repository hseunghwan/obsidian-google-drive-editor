import { describe, expect, it } from 'vitest';

import { defaultGraphForceSettings, parseGraphForceSettings } from './graphSettings';

describe('parseGraphForceSettings', () => {
  it('graph.json의 포스 값을 채택한다', () => {
    expect(
      parseGraphForceSettings({
        centerStrength: 0.518713248970312,
        repelStrength: 10,
        linkStrength: 1,
        linkDistance: 250,
        showTags: false
      })
    ).toEqual({ centerStrength: 0.518713248970312, repelStrength: 10, linkStrength: 1, linkDistance: 250 });
  });

  it('누락된 키는 기본값으로 채운다', () => {
    expect(parseGraphForceSettings({ repelStrength: 15 })).toEqual({
      ...defaultGraphForceSettings,
      repelStrength: 15
    });
  });

  it('숫자가 아니거나 NaN인 값은 기본값으로 바꾼다', () => {
    expect(parseGraphForceSettings({ centerStrength: 'high', linkDistance: Number.NaN })).toEqual(
      defaultGraphForceSettings
    );
  });

  it('객체가 아니면 전부 기본값', () => {
    expect(parseGraphForceSettings(null)).toEqual(defaultGraphForceSettings);
    expect(parseGraphForceSettings('junk')).toEqual(defaultGraphForceSettings);
  });
});
