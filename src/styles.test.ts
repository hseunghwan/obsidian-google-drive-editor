/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

describe('styles', () => {
  it('sets CodeMirror caret color through the active theme variable', () => {
    expect(styles).toContain('--editor-caret: #f2f2f2');
    expect(styles).toContain('.editor-pane .cm-content');
    expect(styles).toContain('caret-color: var(--editor-caret)');
    expect(styles).toContain('border-left-color: var(--editor-caret)');
  });

  it('styles the slash command autocomplete popup like a compact command menu', () => {
    expect(styles).toContain('.editor-pane .cm-tooltip-autocomplete');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) auto');
    expect(styles).toContain('.editor-pane .cm-tooltip-autocomplete .cm-completionIcon');
    expect(styles).toContain('.editor-pane .cm-tooltip-autocomplete .cm-completionDetail');
    expect(styles).toContain('.editor-pane .cm-tooltip-autocomplete ul li[aria-selected]');
  });
});
