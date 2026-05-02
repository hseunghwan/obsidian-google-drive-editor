import { describe, expect, it } from 'vitest';

import { extractMarkdownMetadata, setFrontmatterProperty } from './markdownMetadata';

describe('extractMarkdownMetadata', () => {
  it('extracts frontmatter, inline tags, and wiki links', () => {
    const source = `---
title: Home
status: draft
---
# Home #daily

See [[Project Note]] and #project/alpha.
`;

    expect(extractMarkdownMetadata(source)).toEqual({
      frontmatter: {
        title: 'Home',
        status: 'draft'
      },
      tags: ['daily', 'project/alpha'],
      wikiLinks: ['Project Note'],
      bodyStart: source.indexOf('# Home')
    });
  });

  it('returns empty frontmatter when the document has no YAML block', () => {
    const source = '# Untitled\n\nBody with [[Link]].';

    expect(extractMarkdownMetadata(source)).toEqual({
      frontmatter: {},
      tags: [],
      wikiLinks: ['Link'],
      bodyStart: 0
    });
  });
});

describe('setFrontmatterProperty', () => {
  it('updates an existing property without changing the body', () => {
    const source = `---
title: Home
status: draft
---
# Home
`;

    expect(setFrontmatterProperty(source, 'status', 'published')).toBe(`---
title: Home
status: published
---
# Home
`);
  });

  it('creates a frontmatter block when missing', () => {
    expect(setFrontmatterProperty('# Home\n', 'title', 'Home')).toBe(`---
title: Home
---
# Home
`);
  });
});
