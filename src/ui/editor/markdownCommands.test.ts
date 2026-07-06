import { EditorSelection, EditorState, type StateCommand } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { cycleListMarker, insertLink, setHeading, toggleInlineMark } from './markdownCommands';

function run(command: StateCommand, doc: string, anchor: number, head = anchor) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
  command({
    state,
    dispatch: (transaction) => {
      state = transaction.state;
    }
  });
  return state;
}

describe('setHeading', () => {
  it('sets a heading on a plain line', () => {
    const state = run(setHeading(2), 'title', 3);
    expect(state.doc.toString()).toBe('## title');
  });

  it('replaces an existing heading level', () => {
    const state = run(setHeading(1), '### title', 6);
    expect(state.doc.toString()).toBe('# title');
  });

  it('removes the heading when the level matches', () => {
    const state = run(setHeading(2), '## title', 6);
    expect(state.doc.toString()).toBe('title');
  });
});

describe('toggleInlineMark', () => {
  it('wraps the selection with the marker', () => {
    const state = run(toggleInlineMark('**'), 'a bold b', 2, 6);
    expect(state.doc.toString()).toBe('a **bold** b');
    expect(state.selection.main.from).toBe(4);
    expect(state.selection.main.to).toBe(8);
  });

  it('unwraps a selection already surrounded by the marker', () => {
    const state = run(toggleInlineMark('**'), 'a **bold** b', 4, 8);
    expect(state.doc.toString()).toBe('a bold b');
  });

  it('inserts an empty pair at the cursor', () => {
    const state = run(toggleInlineMark('*'), 'ab', 1);
    expect(state.doc.toString()).toBe('a**b');
    expect(state.selection.main.head).toBe(2);
  });
});

describe('insertLink', () => {
  it('wraps the selection and selects the url placeholder', () => {
    const state = run(insertLink, 'see docs now', 4, 8);
    expect(state.doc.toString()).toBe('see [docs](url) now');
    expect(state.sliceDoc(state.selection.main.from, state.selection.main.to)).toBe('url');
  });

  it('inserts a placeholder link at the cursor', () => {
    const state = run(insertLink, '', 0);
    expect(state.doc.toString()).toBe('[text](url)');
  });
});

describe('cycleListMarker', () => {
  it('turns a plain line into a bullet', () => {
    const state = run(cycleListMarker, 'item', 2);
    expect(state.doc.toString()).toBe('- item');
  });

  it('turns a bullet into a checkbox', () => {
    const state = run(cycleListMarker, '- item', 4);
    expect(state.doc.toString()).toBe('- [ ] item');
  });

  it('turns a checkbox back into a plain line', () => {
    const state = run(cycleListMarker, '- [x] item', 8);
    expect(state.doc.toString()).toBe('item');
  });

  it('keeps indentation while cycling', () => {
    const state = run(cycleListMarker, '  - item', 5);
    expect(state.doc.toString()).toBe('  - [ ] item');
  });
});
