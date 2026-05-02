import { autocompletion } from '@codemirror/autocomplete';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';

import type { VaultIndex } from '../../domain/vault/vaultIndex';
import { wikiLinkAutocomplete } from './wikiLinkAutocomplete';

interface MarkdownEditorProps {
  value: string;
  index: VaultIndex;
  onChange(value: string): void;
}

export function MarkdownEditor({ value, index, onChange }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        keymap.of([]),
        autocompletion({ override: [wikiLinkAutocomplete(index)] }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
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
  }, [index, onChange, value]);

  return <div className="editor-pane" ref={hostRef} />;
}
