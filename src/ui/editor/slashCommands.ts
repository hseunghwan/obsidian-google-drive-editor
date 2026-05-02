export type SlashCommandId = 'link' | 'wikilink' | 'tag' | 'property';

export interface SlashCommand {
  id: SlashCommandId;
  label: string;
  insertText: string;
}

export const slashCommands: SlashCommand[] = [
  { id: 'link', label: 'Markdown link', insertText: '[text](https://example.com)' },
  { id: 'wikilink', label: 'Wiki link', insertText: '[[Home]]' },
  { id: 'tag', label: 'Tag', insertText: '#tag' },
  { id: 'property', label: 'Property', insertText: 'property: value' }
];
