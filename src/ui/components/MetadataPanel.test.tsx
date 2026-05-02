import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetadataPanel } from './MetadataPanel';

describe('MetadataPanel', () => {
  it('distinguishes invalid YAML from an empty properties list', () => {
    render(
      <MetadataPanel
        content={`---
title:
next
---
# Home #daily
`}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('프로퍼티 YAML 문법 오류가 있습니다.');
    expect(screen.queryByText('등록된 프로퍼티가 없습니다.')).not.toBeInTheDocument();
    expect(screen.getByText('#daily')).toBeInTheDocument();
  });
});
