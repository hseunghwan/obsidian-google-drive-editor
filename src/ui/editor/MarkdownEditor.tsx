import { autocompletion } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import type { VaultIndex } from '../../domain/vault/vaultIndex';
import { useI18n } from '../../i18n/I18nProvider';
import { messages } from '../../i18n/messages';
import { slashCommandAutocomplete } from './slashCommandAutocomplete';
import { wikiLinkAutocomplete } from './wikiLinkAutocomplete';

export interface MarkdownEditorProps {
  value: string;
  index: VaultIndex;
  onChange(value: string): void;
}

export function MarkdownEditor({ value, index, onChange }: MarkdownEditorProps) {
  const { locale } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

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
        markdown(),
        keymap.of([]),
        autocompletion({ override: [wikiLinkAutocomplete(index), slashCommandAutocomplete(messages[locale])] }),
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

  return <div className="editor-pane" ref={hostRef} />;
}
