import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { MarkdownHeading } from '../../domain/markdown/markdownMetadata';
import { MetadataPanel } from './MetadataPanel';

describe('MetadataPanel', () => {
  it('renders a document outline from markdown headings', () => {
    render(
      <MetadataPanel
        content={`# 기술블로그 EP7

## EP7. 핵심 요약
### 생각보다 바빴던 WAS
## 마무리
`}
      />
    );

    expect(screen.getByRole('heading', { name: '목차' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '목차' })).toBeInTheDocument();
    expect(screen.getByText('기술블로그 EP7')).toBeInTheDocument();
    expect(screen.getByText('EP7. 핵심 요약')).toBeInTheDocument();
    expect(screen.getByText('생각보다 바빴던 WAS')).toBeInTheDocument();
    expect(screen.getByText('마무리')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '태그' }).compareDocumentPosition(screen.getByRole('heading', { name: '목차' })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('collapses and expands nested outline headings from the chevron button', async () => {
    const user = userEvent.setup();

    render(
      <MetadataPanel
        content={`# 기술블로그 EP7

## EP7. 핵심 요약
### 생각보다 바빴던 WAS
## 마무리
`}
      />
    );

    expect(screen.getByText('EP7. 핵심 요약')).toBeInTheDocument();
    expect(screen.getByText('마무리')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '기술블로그 EP7 하위 목차 접기/펼치기' }));

    expect(screen.queryByText('EP7. 핵심 요약')).not.toBeInTheDocument();
    expect(screen.queryByText('마무리')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '기술블로그 EP7 하위 목차 접기/펼치기' }));

    expect(screen.getByText('EP7. 핵심 요약')).toBeInTheDocument();
    expect(screen.getByText('마무리')).toBeInTheDocument();
  });

  it('selects an outline heading with its source line number', async () => {
    const user = userEvent.setup();
    const onSelectHeading = vi.fn<(heading: MarkdownHeading) => void>();

    render(
      <MetadataPanel
        content={`# 기술블로그 EP7

## EP7. 핵심 요약
### 생각보다 바빴던 WAS
## 마무리
`}
        onSelectHeading={onSelectHeading}
      />
    );

    await user.click(screen.getByRole('button', { name: '마무리 위치로 이동' }));

    expect(onSelectHeading).toHaveBeenCalledWith({ level: 2, lineNumber: 5, text: '마무리' });
  });

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
