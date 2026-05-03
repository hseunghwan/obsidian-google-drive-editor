import type { MessageKey } from '../../i18n/messages';

export type SlashCommandId = 'link' | 'wikilink' | 'tag' | 'property';

export interface SlashCommand {
  id: SlashCommandId;
  labelKey: MessageKey;
  insertText: string;
}

export const slashCommands: SlashCommand[] = [
  { id: 'link', labelKey: 'slashCommand.link', insertText: '[text](https://example.com)' },
  { id: 'wikilink', labelKey: 'slashCommand.wikilink', insertText: '[[Home]]' },
  { id: 'tag', labelKey: 'slashCommand.tag', insertText: '#tag' },
  { id: 'property', labelKey: 'slashCommand.property', insertText: 'property: value' }
];
