import { EditorSelection, type StateCommand } from '@codemirror/state';
import type { KeyBinding } from '@codemirror/view';

const headingPattern = /^(#{1,6}) /;
const taskPattern = /^(\s*)- \[[ xX]\] /;
const bulletPattern = /^(\s*)- (?!\[)/;

export function setHeading(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.selection.ranges.map((range) => {
      const line = state.doc.lineAt(range.head);
      const match = line.text.match(headingPattern);
      const currentLevel = match ? match[1].length : 0;
      return {
        from: line.from,
        to: line.from + (match ? match[0].length : 0),
        insert: currentLevel === level ? '' : `${'#'.repeat(level)} `
      };
    });
    dispatch(state.update({ changes, userEvent: 'input' }));
    return true;
  };
}

export function toggleInlineMark(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    dispatch(
      state.update(
        state.changeByRange((range) => {
          const before = state.sliceDoc(Math.max(0, range.from - marker.length), range.from);
          const after = state.sliceDoc(range.to, range.to + marker.length);
          if (before === marker && after === marker) {
            return {
              changes: [
                { from: range.from - marker.length, to: range.from },
                { from: range.to, to: range.to + marker.length }
              ],
              range: EditorSelection.range(range.from - marker.length, range.to - marker.length)
            };
          }
          return {
            changes: [
              { from: range.from, insert: marker },
              { from: range.to, insert: marker }
            ],
            range: EditorSelection.range(range.from + marker.length, range.to + marker.length)
          };
        })
      )
    );
    return true;
  };
}

export const insertLink: StateCommand = ({ state, dispatch }) => {
  dispatch(
    state.update(
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to) || 'text';
        const urlFrom = range.from + text.length + 3;
        return {
          changes: { from: range.from, to: range.to, insert: `[${text}](url)` },
          range: EditorSelection.range(urlFrom, urlFrom + 3)
        };
      })
    )
  );
  return true;
};

export const cycleListMarker: StateCommand = ({ state, dispatch }) => {
  const changes = state.selection.ranges.map((range) => {
    const line = state.doc.lineAt(range.head);
    const task = line.text.match(taskPattern);
    if (task) {
      return { from: line.from + task[1].length, to: line.from + task[0].length, insert: '' };
    }
    const bullet = line.text.match(bulletPattern);
    if (bullet) {
      return { from: line.from + bullet[0].length, to: line.from + bullet[0].length, insert: '[ ] ' };
    }
    const indent = line.text.match(/^\s*/)?.[0] ?? '';
    return { from: line.from + indent.length, to: line.from + indent.length, insert: '- ' };
  });
  dispatch(state.update({ changes, userEvent: 'input' }));
  return true;
};

export const markdownKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: toggleInlineMark('**') },
  { key: 'Mod-i', run: toggleInlineMark('*') },
  { key: 'Mod-k', run: insertLink },
  { key: 'Mod-l', run: cycleListMarker },
  ...[1, 2, 3, 4, 5, 6].map((level) => ({ key: `Mod-Shift-${level}`, run: setHeading(level) }))
];
