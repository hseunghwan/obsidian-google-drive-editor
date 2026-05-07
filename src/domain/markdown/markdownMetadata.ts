import { parse, stringify } from 'yaml';

export interface MarkdownMetadata {
  frontmatter: Record<string, unknown>;
  frontmatterError?: string;
  tags: string[];
  wikiLinks: string[];
  headings: MarkdownHeading[];
  bodyStart: number;
}

export interface MarkdownHeading {
  level: number;
  lineNumber: number;
  text: string;
}

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const tagPattern = /(^|\s)#([A-Za-z0-9_/-]+)/g;
const wikiLinkPattern = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
const headingPattern = /^(#{1,6})[ \t]+(.+?)\s*$/;
const fencePattern = /^[ \t]*(```+|~~~+)/;

export function extractMarkdownMetadata(source: string): MarkdownMetadata {
  const frontmatterMatch = source.match(frontmatterPattern);
  const parsedFrontmatter = frontmatterMatch ? parseFrontmatterRecord(frontmatterMatch[1]) : { frontmatter: {} };
  const bodyStart = frontmatterMatch ? frontmatterMatch[0].length : 0;

  return {
    ...parsedFrontmatter,
    tags: uniqueMatches(source, tagPattern),
    wikiLinks: uniqueMatches(source, wikiLinkPattern),
    headings: extractMarkdownHeadings(source.slice(bodyStart), lineNumberAtOffset(source, bodyStart)),
    bodyStart
  };
}

function extractMarkdownHeadings(source: string, startLineNumber: number): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  let inFence = false;

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (fencePattern.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = line.match(headingPattern);
    if (!match) {
      continue;
    }

    const text = match[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
    if (text) {
      headings.push({ level: match[1].length, lineNumber: startLineNumber + index, text });
    }
  }

  return headings;
}

function lineNumberAtOffset(source: string, offset: number) {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function parseFrontmatterRecord(source: string): Pick<MarkdownMetadata, 'frontmatter' | 'frontmatterError'> {
  try {
    return { frontmatter: toRecord(parse(source)) };
  } catch (error) {
    return {
      frontmatter: {},
      frontmatterError: error instanceof Error ? error.message : 'Invalid YAML frontmatter.'
    };
  }
}

export function setFrontmatterProperty(
  source: string,
  key: string,
  value: string | number | boolean | string[]
): string {
  const frontmatterMatch = source.match(frontmatterPattern);
  const current = frontmatterMatch ? toRecord(parse(frontmatterMatch[1])) : {};
  const next = { ...current, [key]: value };
  const frontmatter = `---\n${stringify(next).trimEnd()}\n---\n`;

  if (!frontmatterMatch) {
    return `${frontmatter}${source}`;
  }

  return `${frontmatter}${source.slice(frontmatterMatch[0].length)}`;
}

function uniqueMatches(source: string, pattern: RegExp): string[] {
  const values = new Set<string>();
  for (const match of source.matchAll(pattern)) {
    values.add(match[2] ?? match[1]);
  }
  return [...values];
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
