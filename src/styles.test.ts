/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

describe('styles', () => {
  it('maps the Obsidian style reference tokens onto the legacy workspace variables', () => {
    expect(styles).toContain('--color-abyss: #171717');
    expect(styles).toContain('--color-surface: #1e1e1e');
    expect(styles).toContain('--color-amethyst: #7c3aed');
    expect(styles).toContain('--color-lavender: #a78bfa');
    expect(styles).toContain('--shadow-subtle: rgb(255 255 255 / 5%) 0 0 0 1px inset');
    expect(styles).toContain('--app-bg: var(--color-abyss)');
    expect(styles).toContain('--panel-bg: var(--color-surface)');
    expect(styles).toContain('--accent: var(--color-amethyst)');
    expect(styles).toContain('--accent-muted: var(--color-lavender)');
  });

  it('removes the previous blue and Inter visual language from the active theme', () => {
    expect(styles).not.toContain('#8aadf4');
    expect(styles).not.toContain('#5d6f91');
    expect(styles).not.toContain('Inter,');
  });

  it('sets CodeMirror caret color through the active theme variable', () => {
    expect(styles).toContain('--editor-caret: var(--color-white)');
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

  it('centers the editor empty action across the whole writing surface', () => {
    expect(styles).toContain('.open-first-file');
    expect(styles).toContain('grid-row: 1 / -1');
  });
});
