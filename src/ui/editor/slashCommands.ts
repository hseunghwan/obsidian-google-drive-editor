import type { MessageKey } from '../../i18n/messages';

export type SlashCommandId =
  | 'link'
  | 'wikilink'
  | 'tag'
  | 'property'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'checkbox'
  | 'quote'
  | 'codeblock'
  | 'hr'
  | 'table'
  | 'callout';

export interface SlashCommand {
  id: SlashCommandId;
  labelKey: MessageKey;
  insertText: string;
}

export const slashCommands: SlashCommand[] = [
  { id: 'link', labelKey: 'slashCommand.link', insertText: '[text](https://example.com)' },
  { id: 'wikilink', labelKey: 'slashCommand.wikilink', insertText: '[[Home]]' },
  { id: 'tag', labelKey: 'slashCommand.tag', insertText: '#tag' },
  { id: 'property', labelKey: 'slashCommand.property', insertText: 'property: value' },
  { id: 'heading1', labelKey: 'slashCommand.heading1', insertText: '# ' },
  { id: 'heading2', labelKey: 'slashCommand.heading2', insertText: '## ' },
  { id: 'heading3', labelKey: 'slashCommand.heading3', insertText: '### ' },
  { id: 'bullet', labelKey: 'slashCommand.bullet', insertText: '- ' },
  { id: 'numbered', labelKey: 'slashCommand.numbered', insertText: '1. ' },
  { id: 'checkbox', labelKey: 'slashCommand.checkbox', insertText: '- [ ] ' },
  { id: 'quote', labelKey: 'slashCommand.quote', insertText: '> ' },
  { id: 'codeblock', labelKey: 'slashCommand.codeblock', insertText: '```\n\n```' },
  { id: 'hr', labelKey: 'slashCommand.hr', insertText: '---\n' },
  {
    id: 'table',
    labelKey: 'slashCommand.table',
    insertText: '| 열 1 | 열 2 |\n| --- | --- |\n|  |  |\n'
  },
  { id: 'callout', labelKey: 'slashCommand.callout', insertText: '> [!note] ' }
];
