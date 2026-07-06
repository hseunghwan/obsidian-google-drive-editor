import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, Facet, StateField } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';

const frontmatterPattern = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const wikiLinkPattern = /\[\[([^[\]\n]+)\]\]/g;
const highlightPattern = /==([^=\n]+)==/g;
const tagPattern = /(^|[\s(])(#[\p{L}\p{N}/_-]*\p{L}[\p{L}\p{N}/_-]*)/gu;
const taskLinePattern = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/;
const calloutLinePattern = /^>\s*\[!(\w+)\][+-]?/;

const hideDecoration = Decoration.replace({});

export const wikiLinkOpener = Facet.define<(target: string) => void, ((target: string) => void) | null>({
  combine: (values) => values[0] ?? null
});

export const wikiLinkResolver = Facet.define<(target: string) => boolean, ((target: string) => boolean) | null>({
  combine: (values) => values[0] ?? null
});

const inlineMarkClasses: Record<string, string> = {
  Emphasis: 'cm-lp-em',
  StrongEmphasis: 'cm-lp-strong',
  Strikethrough: 'cm-lp-strike',
  InlineCode: 'cm-lp-code'
};

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const bullet = document.createElement('span');
    bullet.className = 'cm-lp-bullet';
    bullet.textContent = '•';
    return bullet;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM() {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cm-lp-task';
    checkbox.checked = this.checked;
    return checkbox;
  }

  ignoreEvent() {
    return false;
  }
}

class HorizontalRuleWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const rule = document.createElement('span');
    rule.className = 'cm-lp-hr';
    return rule;
  }
}

class CalloutLabelWidget extends WidgetType {
  constructor(readonly calloutType: string) {
    super();
  }

  eq(other: CalloutLabelWidget) {
    return other.calloutType === this.calloutType;
  }

  toDOM() {
    const label = document.createElement('span');
    label.className = 'cm-lp-callout-label';
    label.textContent = this.calloutType;
    return label;
  }
}

class TableWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }

  eq(other: TableWidget) {
    return other.source === this.source;
  }

  toDOM(view: EditorView) {
    const table = document.createElement('table');
    table.className = 'cm-lp-table';
    const rows = this.source.trim().split('\n');
    rows.forEach((row, rowIndex) => {
      const cells = splitTableRow(row);
      if (rowIndex === 1 && cells.every((cell) => /^\s*:?-+:?\s*$/.test(cell))) {
        return;
      }
      const rowElement = table.insertRow();
      for (const cell of cells) {
        const cellElement = document.createElement(rowIndex === 0 ? 'th' : 'td');
        cellElement.textContent = cell.trim();
        rowElement.appendChild(cellElement);
      }
    });
    table.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: view.posAtDOM(table) } });
      view.focus();
    });
    return table;
  }
}

function splitTableRow(row: string) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}

const bulletWidget = new BulletWidget();
const horizontalRuleWidget = new HorizontalRuleWidget();

function frontmatterEnd(state: EditorState) {
  const head = state.sliceDoc(0, Math.min(state.doc.length, 32768));
  return head.match(frontmatterPattern)?.[0].length ?? 0;
}

function touchesRange(state: EditorState, from: number, to: number) {
  return state.selection.ranges.some((range) => range.to >= from && range.from <= to);
}

function touchesLines(state: EditorState, from: number, to: number) {
  return touchesRange(state, state.doc.lineAt(from).from, state.doc.lineAt(to).to);
}

function isSpaceAt(state: EditorState, position: number) {
  return state.sliceDoc(position, position + 1) === ' ';
}

function insideCodeOrLink(state: EditorState, position: number) {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(position, 1);
    node;
    node = node.parent
  ) {
    const name = node.type.name;
    if (name === 'InlineCode' || name === 'FencedCode' || name === 'CodeBlock' || name === 'Link' || name === 'Image' || name === 'Autolink' || name === 'URL') {
      return true;
    }
  }
  return false;
}

export function buildLivePreviewDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const decorations: { from: number; to: number; decoration: Decoration }[] = [];
  const decoratedLines = new Set<string>();
  const skipBefore = frontmatterEnd(state);

  function add(from: number, to: number, decoration: Decoration) {
    if (from < skipBefore) {
      return;
    }
    decorations.push({ from, to, decoration });
  }

  function addLineClass(position: number, className: string) {
    const line = state.doc.lineAt(position);
    const key = `${line.number}:${className}`;
    if (decoratedLines.has(key) || line.from < skipBefore) {
      return;
    }
    decoratedLines.add(key);
    decorations.push({ from: line.from, to: line.from, decoration: Decoration.line({ class: className }) });
  }

  function hideInlineMarks(node: SyntaxNode, markName: string) {
    for (const mark of node.getChildren(markName)) {
      add(mark.from, mark.to, hideDecoration);
    }
  }

  if (skipBefore > 0) {
    for (
      let position = 0;
      position < skipBefore && position < state.doc.length;
      position = state.doc.lineAt(position).to + 1
    ) {
      const line = state.doc.lineAt(position);
      decorations.push({
        from: line.from,
        to: line.from,
        decoration: Decoration.line({ class: 'cm-lp-frontmatter' })
      });
    }
  }

  for (const range of ranges) {
    syntaxTree(state).iterate({
      from: range.from,
      to: range.to,
      enter: (node) => {
        const name = node.type.name;

        if (node.to <= skipBefore) {
          return name === 'Document' ? undefined : false;
        }

        const headingLevel = name.startsWith('ATXHeading') ? Number(name.slice('ATXHeading'.length)) : 0;
        if (headingLevel >= 1 && headingLevel <= 6) {
          addLineClass(node.from, `cm-lp-heading cm-lp-h${headingLevel}`);
          if (!touchesLines(state, node.from, node.to)) {
            for (const mark of node.node.getChildren('HeaderMark')) {
              add(mark.from, mark.to + (isSpaceAt(state, mark.to) ? 1 : 0), hideDecoration);
            }
          }
          return;
        }

        if (name === 'SetextHeading1' || name === 'SetextHeading2') {
          addLineClass(node.from, `cm-lp-heading cm-lp-h${name === 'SetextHeading1' ? 1 : 2}`);
          return;
        }

        const inlineClass = inlineMarkClasses[name];
        if (inlineClass) {
          add(node.from, node.to, Decoration.mark({ class: inlineClass }));
          if (!touchesRange(state, node.from, node.to)) {
            hideInlineMarks(node.node, name === 'Strikethrough' ? 'StrikethroughMark' : name === 'InlineCode' ? 'CodeMark' : 'EmphasisMark');
          }
          return;
        }

        if (name === 'Link' || name === 'Image') {
          const marks = node.node.getChildren('LinkMark');
          const url = node.node.getChild('URL');
          const rendered = !touchesRange(state, node.from, node.to) && marks.length >= 2;
          const urlText = url ? state.sliceDoc(url.from, url.to) : '';
          add(
            node.from,
            node.to,
            Decoration.mark(
              rendered && /^https?:\/\//.test(urlText)
                ? { class: 'cm-lp-link', attributes: { 'data-link-url': urlText } }
                : { class: 'cm-lp-link' }
            )
          );
          if (url) {
            add(url.from, url.to, Decoration.mark({ class: 'cm-lp-url' }));
          }
          if (rendered) {
            const closingBracket = marks.find((mark) => state.sliceDoc(mark.from, mark.to) === ']');
            add(marks[0].from, marks[0].to, hideDecoration);
            if (closingBracket) {
              add(closingBracket.from, node.to, hideDecoration);
            }
          }
          return;
        }

        if (name === 'Blockquote') {
          const firstLine = state.doc.lineAt(node.from);
          const callout = firstLine.text.match(calloutLinePattern);
          if (callout) {
            const type = callout[1].toLowerCase();
            for (let position = node.from; position <= node.to; position = state.doc.lineAt(position).to + 1) {
              addLineClass(position, `cm-lp-callout cm-lp-callout-${type}`);
            }
            const markerFrom = firstLine.from + callout[0].indexOf('[!');
            const markerTo = firstLine.from + callout[0].length;
            if (!touchesLines(state, firstLine.from, firstLine.to)) {
              add(
                markerFrom,
                markerTo + (isSpaceAt(state, markerTo) ? 1 : 0),
                Decoration.replace({ widget: new CalloutLabelWidget(type) })
              );
            }
          }
          return;
        }

        if (name === 'QuoteMark') {
          addLineClass(node.from, 'cm-lp-quote');
          if (!touchesLines(state, node.from, node.to)) {
            add(node.from, node.to + (isSpaceAt(state, node.to) ? 1 : 0), hideDecoration);
          }
          return;
        }

        if (name === 'ListMark') {
          const marker = state.sliceDoc(node.from, node.to);
          if (marker !== '-' && marker !== '*' && marker !== '+') {
            return;
          }
          const listItem = node.node.parent;
          if (listItem?.getChild('Task')) {
            return;
          }
          if (!touchesRange(state, node.from, node.to)) {
            add(node.from, node.to, Decoration.replace({ widget: bulletWidget }));
          }
          return;
        }

        if (name === 'Task') {
          const marker = node.node.getChild('TaskMarker');
          const listMark = node.node.parent?.getChild('ListMark');
          if (!marker || !listMark) {
            return;
          }
          if (!touchesRange(state, listMark.from, marker.to)) {
            const checked = state.sliceDoc(marker.from, marker.to).toLowerCase() === '[x]';
            add(
              listMark.from,
              marker.to + (isSpaceAt(state, marker.to) ? 1 : 0),
              Decoration.replace({ widget: new CheckboxWidget(checked) })
            );
          }
          return;
        }

        if (name === 'HorizontalRule') {
          if (!touchesLines(state, node.from, node.to)) {
            add(node.from, node.to, Decoration.replace({ widget: horizontalRuleWidget }));
          }
          return;
        }

        if (name === 'FencedCode' || name === 'CodeBlock') {
          for (let position = node.from; position <= node.to; position = state.doc.lineAt(position).to + 1) {
            addLineClass(position, 'cm-lp-codeblock');
          }
          return;
        }
      }
    });

    const text = state.sliceDoc(range.from, range.to);

    for (const match of text.matchAll(wikiLinkPattern)) {
      const from = range.from + match.index;
      const to = from + match[0].length;
      if (from < skipBefore || insideCodeOrLink(state, from)) {
        continue;
      }
      const pipeIndex = match[1].indexOf('|');
      const labelFrom = pipeIndex === -1 ? from + 2 : from + 2 + pipeIndex + 1;
      const target = (pipeIndex === -1 ? match[1] : match[1].slice(0, pipeIndex)).trim();
      const rendered = !touchesRange(state, from, to);
      const resolver = state.facet(wikiLinkResolver);
      const className = resolver && !resolver(target) ? 'cm-lp-wikilink cm-lp-unresolved' : 'cm-lp-wikilink';
      add(
        labelFrom,
        to - 2,
        Decoration.mark(
          rendered ? { class: className, attributes: { 'data-wikilink': target } } : { class: className }
        )
      );
      if (rendered) {
        add(from, labelFrom, hideDecoration);
        add(to - 2, to, hideDecoration);
      }
    }

    for (const match of text.matchAll(highlightPattern)) {
      const from = range.from + match.index;
      const to = from + match[0].length;
      if (from < skipBefore || insideCodeOrLink(state, from)) {
        continue;
      }
      add(from + 2, to - 2, Decoration.mark({ class: 'cm-lp-highlight' }));
      if (!touchesRange(state, from, to)) {
        add(from, from + 2, hideDecoration);
        add(to - 2, to, hideDecoration);
      }
    }

    for (const match of text.matchAll(tagPattern)) {
      const from = range.from + match.index + match[1].length;
      const to = from + match[2].length;
      if (from < skipBefore || insideCodeOrLink(state, from)) {
        continue;
      }
      add(from, to, Decoration.mark({ class: 'cm-lp-tag' }));
    }
  }

  return Decoration.set(
    decorations.map(({ from, to, decoration }) => decoration.range(from, to)),
    true
  );
}

export function buildTableDecorations(state: EditorState): DecorationSet {
  const decorations: { from: number; to: number; decoration: Decoration }[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.type.name !== 'Table') {
        return;
      }
      if (!touchesLines(state, node.from, node.to)) {
        decorations.push({
          from: node.from,
          to: node.to,
          decoration: Decoration.replace({
            widget: new TableWidget(state.sliceDoc(node.from, node.to)),
            block: true
          })
        });
      }
      return false;
    }
  });

  return Decoration.set(
    decorations.map(({ from, to, decoration }) => decoration.range(from, to)),
    true
  );
}

// ponytail: 표는 문서 전체를 훑는 StateField로 처리 — block widget은 ViewPlugin에서 만들 수 없다
const tableField = StateField.define<DecorationSet>({
  create: buildTableDecorations,
  update(value, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildTableDecorations(transaction.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field)
});

function toggleTaskAt(view: EditorView, position: number) {
  const line = view.state.doc.lineAt(position);
  const match = line.text.match(taskLinePattern);
  if (!match) {
    return false;
  }
  const checkboxPosition = line.from + match[1].length;
  view.dispatch({
    changes: {
      from: checkboxPosition,
      to: checkboxPosition + 1,
      insert: match[2] === ' ' ? 'x' : ' '
    }
  });
  return true;
}

export function livePreview(): Extension {
  return [tableField, livePreviewPlugin()];
}

function livePreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      tree: ReturnType<typeof syntaxTree>;

      constructor(view: EditorView) {
        this.tree = syntaxTree(view.state);
        this.decorations = buildLivePreviewDecorations(view.state, view.visibleRanges);
      }

      update(update: ViewUpdate) {
        const tree = syntaxTree(update.view.state);
        if (update.docChanged || update.selectionSet || update.viewportChanged || tree !== this.tree) {
          this.tree = tree;
          this.decorations = buildLivePreviewDecorations(update.view.state, update.view.visibleRanges);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        mousedown(event, view) {
          const target = event.target as HTMLElement;
          if (target.classList?.contains('cm-lp-task')) {
            event.preventDefault();
            return toggleTaskAt(view, view.posAtDOM(target));
          }
          const wikiLink = target.closest?.('[data-wikilink]');
          if (wikiLink) {
            event.preventDefault();
            view.state.facet(wikiLinkOpener)?.(wikiLink.getAttribute('data-wikilink') ?? '');
            return true;
          }
          const externalLink = target.closest?.('[data-link-url]');
          if (externalLink) {
            event.preventDefault();
            window.open(externalLink.getAttribute('data-link-url') ?? '', '_blank', 'noopener');
            return true;
          }
          return false;
        }
      }
    }
  );
}
