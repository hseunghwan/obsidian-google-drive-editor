import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTreeAvailable } from '@codemirror/language';
import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { buildLivePreviewDecorations, buildTableDecorations, wikiLinkResolver } from './livePreview';

interface DecorationSummary {
  from: number;
  to: number;
  kind: string;
}

function createState(doc: string, cursor = doc.length) {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdown({ base: markdownLanguage })]
  });
  expect(syntaxTreeAvailable(state)).toBe(true);
  return state;
}

function summarize(state: EditorState): DecorationSummary[] {
  const set = buildLivePreviewDecorations(state, [{ from: 0, to: state.doc.length }]);
  const summary: DecorationSummary[] = [];
  const cursor = set.iter();
  while (cursor.value) {
    const spec = cursor.value.spec as { class?: string; widget?: { checked?: boolean } };
    const kind = spec.class ??
      (spec.widget
        ? `widget:${spec.widget.constructor.name}${spec.widget.checked !== undefined ? `:${spec.widget.checked}` : ''}`
        : 'hide');
    summary.push({ from: cursor.from, to: cursor.to, kind });
    cursor.next();
  }
  return summary;
}

function kinds(state: EditorState) {
  return summarize(state).map((entry) => entry.kind);
}

describe('buildLivePreviewDecorations', () => {
  it('hides heading marks and styles the heading line when the cursor is elsewhere', () => {
    const doc = '# Title\n\nbody';
    const summary = summarize(createState(doc, doc.length));

    expect(summary).toContainEqual({ from: 0, to: 0, kind: 'cm-lp-heading cm-lp-h1' });
    expect(summary).toContainEqual({ from: 0, to: 2, kind: 'hide' });
  });

  it('reveals heading marks when the cursor is on the heading line', () => {
    const summary = summarize(createState('# Title\n\nbody', 3));

    expect(summary).toContainEqual({ from: 0, to: 0, kind: 'cm-lp-heading cm-lp-h1' });
    expect(summary).not.toContainEqual({ from: 0, to: 2, kind: 'hide' });
  });

  it('hides emphasis marks when the cursor is outside', () => {
    const doc = 'a **bold** word';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 2, to: 10, kind: 'cm-lp-strong' });
    expect(summary).toContainEqual({ from: 2, to: 4, kind: 'hide' });
    expect(summary).toContainEqual({ from: 8, to: 10, kind: 'hide' });
  });

  it('reveals emphasis marks while the cursor touches the emphasis', () => {
    const summary = summarize(createState('a **bold** word', 5));

    expect(summary).toContainEqual({ from: 2, to: 10, kind: 'cm-lp-strong' });
    expect(summary.filter((entry) => entry.kind === 'hide')).toEqual([]);
  });

  it('hides inline code marks', () => {
    const doc = 'use `npm test` here';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 4, to: 14, kind: 'cm-lp-code' });
    expect(summary).toContainEqual({ from: 4, to: 5, kind: 'hide' });
    expect(summary).toContainEqual({ from: 13, to: 14, kind: 'hide' });
  });

  it('hides the url part of markdown links', () => {
    const doc = 'see [docs](https://example.com) now';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 4, to: 31, kind: 'cm-lp-link' });
    expect(summary).toContainEqual({ from: 4, to: 5, kind: 'hide' });
    expect(summary).toContainEqual({ from: 9, to: 31, kind: 'hide' });
  });

  it('hides wiki link brackets and keeps the target visible', () => {
    const doc = 'go to [[Daily note]] now';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 8, to: 18, kind: 'cm-lp-wikilink' });
    expect(summary).toContainEqual({ from: 6, to: 8, kind: 'hide' });
    expect(summary).toContainEqual({ from: 18, to: 20, kind: 'hide' });
  });

  it('shows only the alias of a wiki link with an alias', () => {
    const doc = 'go to [[Daily note|today]] now';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 19, to: 24, kind: 'cm-lp-wikilink' });
    expect(summary).toContainEqual({ from: 6, to: 19, kind: 'hide' });
    expect(summary).toContainEqual({ from: 24, to: 26, kind: 'hide' });
  });

  it('reveals wiki link syntax when the cursor is inside', () => {
    const summary = summarize(createState('go to [[Daily note]] now', 10));

    expect(summary).toContainEqual({ from: 8, to: 18, kind: 'cm-lp-wikilink' });
    expect(summary.filter((entry) => entry.kind === 'hide')).toEqual([]);
  });

  it('does not treat wiki links inside inline code as links', () => {
    const summary = summarize(createState('code `[[not a link]]` here', 0));

    expect(kinds(createState('code `[[not a link]]` here', 0))).not.toContain('cm-lp-wikilink');
    expect(summary.some((entry) => entry.kind === 'cm-lp-code')).toBe(true);
  });

  it('hides highlight markers and styles the content', () => {
    const doc = 'a ==marked text== b';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 4, to: 15, kind: 'cm-lp-highlight' });
    expect(summary).toContainEqual({ from: 2, to: 4, kind: 'hide' });
    expect(summary).toContainEqual({ from: 15, to: 17, kind: 'hide' });
  });

  it('reveals highlight markers when the cursor touches them', () => {
    const summary = summarize(createState('a ==marked== b', 6));

    expect(summary.some((entry) => entry.kind === 'cm-lp-highlight')).toBe(true);
    expect(summary.filter((entry) => entry.kind === 'hide')).toEqual([]);
  });

  it('styles tags without hiding them', () => {
    const doc = 'note #project/alpha done';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 5, to: 19, kind: 'cm-lp-tag' });
  });

  it('does not treat heading marks as tags', () => {
    expect(kinds(createState('# Title', 0)).filter((kind) => kind === 'cm-lp-tag')).toEqual([]);
  });

  it('replaces list bullets with a bullet widget', () => {
    const doc = '- first\n- second';
    const summary = summarize(createState(doc, 3));

    expect(summary).toContainEqual({ from: 8, to: 9, kind: 'widget:BulletWidget' });
  });

  it('replaces task markers with checkboxes reflecting their state', () => {
    const doc = '- [ ] todo\n- [x] done';
    const summary = summarize(createState(doc, doc.length));

    expect(summary).toContainEqual({ from: 0, to: 6, kind: 'widget:CheckboxWidget:false' });
    expect(summary).toContainEqual({ from: 11, to: 17, kind: 'widget:CheckboxWidget:true' });
  });

  it('renders callouts with a type class and label widget', () => {
    const doc = '> [!warning] 조심\n> 내용\n\nafter';
    const summary = summarize(createState(doc, doc.length));

    expect(summary).toContainEqual({ from: 0, to: 0, kind: 'cm-lp-callout cm-lp-callout-warning' });
    expect(summary).toContainEqual({ from: 16, to: 16, kind: 'cm-lp-callout cm-lp-callout-warning' });
    expect(summary).toContainEqual({ from: 2, to: 13, kind: 'widget:CalloutLabelWidget' });
  });

  it('reveals the callout marker when the cursor is on its line', () => {
    const doc = '> [!note] 제목\n> 내용';
    const summary = summarize(createState(doc, 4));

    expect(summary.some((entry) => entry.kind.startsWith('widget:CalloutLabelWidget'))).toBe(false);
    expect(summary.some((entry) => entry.kind.includes('cm-lp-callout-note'))).toBe(true);
  });

  it('hides quote marks and styles quote lines', () => {
    const doc = '> quoted text\n\nafter';
    const summary = summarize(createState(doc, doc.length));

    expect(summary).toContainEqual({ from: 0, to: 0, kind: 'cm-lp-quote' });
    expect(summary).toContainEqual({ from: 0, to: 2, kind: 'hide' });
  });

  it('replaces horizontal rules with a widget', () => {
    const doc = 'above\n\n---\n\nbelow';
    const summary = summarize(createState(doc, 0));

    expect(summary).toContainEqual({ from: 7, to: 10, kind: 'widget:HorizontalRuleWidget' });
  });

  it('styles fenced code block lines', () => {
    const doc = '```js\nconst a = 1;\n```';
    const summary = summarize(createState(doc, 0));

    expect(summary.filter((entry) => entry.kind === 'cm-lp-codeblock')).toHaveLength(3);
  });

  it('leaves frontmatter untouched except for its own line class', () => {
    const doc = '---\ntitle: note\ntags:\n  - a\n---\n\n# Heading\n';
    const summary = summarize(createState(doc, doc.length));
    const frontmatterEnd = doc.indexOf('\n\n# Heading');

    const nonFrontmatter = summary.filter(
      (entry) => entry.from <= frontmatterEnd && entry.kind !== 'cm-lp-frontmatter'
    );
    expect(nonFrontmatter).toEqual([]);
    expect(summary.filter((entry) => entry.kind === 'cm-lp-frontmatter')).toHaveLength(5);
    expect(summary).toContainEqual({ from: 33, to: 33, kind: 'cm-lp-heading cm-lp-h1' });
  });

  it('marks wiki links without a matching note as unresolved', () => {
    const doc = 'see [[Missing Note]] here';
    const state = EditorState.create({
      doc,
      selection: { anchor: 0 },
      extensions: [markdown({ base: markdownLanguage }), wikiLinkResolver.of(() => false)]
    });
    expect(syntaxTreeAvailable(state)).toBe(true);

    expect(kinds(state)).toContain('cm-lp-wikilink cm-lp-unresolved');
  });

  it('attaches the wiki link target for click navigation when rendered', () => {
    const doc = 'go to [[Daily note|today]] now';
    const state = createState(doc, 0);
    const set = buildLivePreviewDecorations(state, [{ from: 0, to: doc.length }]);

    let target: string | undefined;
    set.between(0, doc.length, (_from, _to, decoration) => {
      const attributes = (decoration.spec as { attributes?: Record<string, string> }).attributes;
      if (attributes?.['data-wikilink']) {
        target = attributes['data-wikilink'];
      }
    });
    expect(target).toBe('Daily note');
  });

  it('omits click attributes while the wiki link is being edited', () => {
    const doc = 'go to [[Daily note]] now';
    const state = createState(doc, 10);
    const set = buildLivePreviewDecorations(state, [{ from: 0, to: doc.length }]);

    let found = false;
    set.between(0, doc.length, (_from, _to, decoration) => {
      const attributes = (decoration.spec as { attributes?: Record<string, string> }).attributes;
      if (attributes?.['data-wikilink']) {
        found = true;
      }
    });
    expect(found).toBe(false);
  });

  it('attaches the external url for rendered markdown links', () => {
    const doc = 'see [docs](https://example.com) now';
    const state = createState(doc, 0);
    const set = buildLivePreviewDecorations(state, [{ from: 0, to: doc.length }]);

    let url: string | undefined;
    set.between(0, doc.length, (_from, _to, decoration) => {
      const attributes = (decoration.spec as { attributes?: Record<string, string> }).attributes;
      if (attributes?.['data-link-url']) {
        url = attributes['data-link-url'];
      }
    });
    expect(url).toBe('https://example.com');
  });

  it('replaces tables with a block widget when the cursor is outside', () => {
    const doc = 'before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter';
    const state = createState(doc, 0);
    const set = buildTableDecorations(state);

    const ranges: { from: number; to: number }[] = [];
    const cursor = set.iter();
    while (cursor.value) {
      ranges.push({ from: cursor.from, to: cursor.to });
      cursor.next();
    }
    expect(ranges).toEqual([{ from: 8, to: doc.indexOf('\n\nafter') }]);
  });

  it('reveals the raw table when the cursor is inside it', () => {
    const doc = 'before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter';
    const state = createState(doc, doc.indexOf('| 1'));

    expect(buildTableDecorations(state).size).toBe(0);
  });

  it('handles multiple cursors by revealing each touched region', () => {
    const doc = '**a** and **b**';
    const state = EditorState.create({
      doc,
      selection: EditorSelection.create([EditorSelection.cursor(2), EditorSelection.cursor(12)]),
      extensions: [markdown({ base: markdownLanguage }), EditorState.allowMultipleSelections.of(true)]
    });
    expect(syntaxTreeAvailable(state)).toBe(true);

    expect(summarize(state).filter((entry) => entry.kind === 'hide')).toEqual([]);
  });
});
