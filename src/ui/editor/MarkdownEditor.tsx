import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { codeFolding, foldGutter, foldKeymap } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import type { VaultIndex } from '../../domain/vault/vaultIndex';
import { useI18n } from '../../i18n/I18nProvider';
import { messages } from '../../i18n/messages';
import { livePreview } from './livePreview';
import { markdownKeymap } from './markdownCommands';
import { slashCommandAutocomplete } from './slashCommandAutocomplete';
import { wikiLinkAutocomplete } from './wikiLinkAutocomplete';

export type EditorMode = 'live' | 'source';

export interface MarkdownEditorProps {
  value: string;
  index: VaultIndex;
  onChange(value: string): void;
  scrollTarget?: MarkdownEditorScrollTarget | null;
  mode?: EditorMode;
}

export interface MarkdownEditorScrollTarget {
  lineNumber: number;
  requestId: number;
}

function modeExtension(mode: EditorMode) {
  return mode === 'live' ? livePreview() : [];
}

export function MarkdownEditor({ value, index, onChange, scrollTarget, mode = 'live' }: MarkdownEditorProps) {
  const { locale } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const modeRef = useRef(mode);
  const modeCompartmentRef = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown({ base: markdownLanguage }),
        history(),
        codeFolding(),
        foldGutter({
          openText: '▾',
          closedText: '▸'
        }),
        keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        autocompletion({ override: [wikiLinkAutocomplete(index), slashCommandAutocomplete(messages[locale])] }),
        modeCompartmentRef.current.of(modeExtension(modeRef.current)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [index, locale]);

  useEffect(() => {
    modeRef.current = mode;
    viewRef.current?.dispatch({
      effects: modeCompartmentRef.current.reconfigure(modeExtension(mode))
    });
  }, [mode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !scrollTarget) {
      return;
    }

    const lineNumber = Math.min(Math.max(1, scrollTarget.lineNumber), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start' })
    });
    view.focus();
  }, [scrollTarget]);

  return <div className="editor-pane" ref={hostRef} />;
}
