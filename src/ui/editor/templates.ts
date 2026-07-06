export interface TemplateContext {
  title: string;
  now?: Date;
}

export function applyTemplateVariables(content: string, context: TemplateContext): string {
  const now = context.now ?? new Date();
  return content
    .replaceAll('{{title}}', context.title)
    .replaceAll('{{date}}', formatDate(now))
    .replaceAll('{{time}}', formatTime(now));
}

export function formatDailyNoteTitle(now = new Date()): string {
  return formatDate(now);
}

function formatDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
