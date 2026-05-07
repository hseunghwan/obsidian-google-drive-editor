import { useEffect, useMemo, useState } from 'react';

import { extractMarkdownMetadata, type MarkdownHeading } from '../../domain/markdown/markdownMetadata';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface MetadataPanelProps {
  content: string;
  onSelectHeading?(heading: MarkdownHeading): void;
}

interface OutlineNode {
  heading: MarkdownHeading;
  children: OutlineNode[];
}

export function MetadataPanel({ content, onSelectHeading }: MetadataPanelProps) {
  const { t } = useI18n();
  const metadata = extractMarkdownMetadata(content);
  const entries = Object.entries(metadata.frontmatter);
  const outlineTree = useMemo(() => buildOutlineTree(metadata.headings), [metadata.headings]);
  const [collapsedHeadingKeys, setCollapsedHeadingKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setCollapsedHeadingKeys(new Set());
  }, [content]);

  function toggleHeading(heading: MarkdownHeading) {
    const key = outlineHeadingKey(heading);
    setCollapsedHeadingKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <section className="metadata-panel" aria-label={t('metadata.aria')}>
      <h2>
        <Icon name="file-text" />
        {t('metadata.properties')}
      </h2>
      {metadata.frontmatterError ? (
        <p className="metadata-error" role="alert" title={metadata.frontmatterError}>
          {t('metadata.invalidFrontmatter')}
        </p>
      ) : entries.length === 0 ? (
        <p>{t('metadata.emptyProperties')}</p>
      ) : (
        <dl className="property-list">
          {entries.map(([key, value]) => (
            <div className="property-row" key={key}>
              <dt>{key}</dt>
              <dd>
                <code>{String(value)}</code>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <h2>
        <Icon name="hash" />
        {t('metadata.tags')}
      </h2>
      <div className="tag-list">
        {metadata.tags.map((tag) => (
          <span className="tag" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      <h2>
        <Icon name="list" />
        {t('metadata.outline')}
      </h2>
      {metadata.headings.length === 0 ? (
        <p>{t('metadata.emptyOutline')}</p>
      ) : (
        <nav className="document-outline" aria-label={t('metadata.outline')}>
          <OutlineList
            collapsedHeadingKeys={collapsedHeadingKeys}
            nodes={outlineTree}
            selectLabel={t('metadata.selectOutlineItem')}
            toggleLabel={t('metadata.toggleOutlineItem')}
            onSelectHeading={onSelectHeading}
            onToggleHeading={toggleHeading}
          />
        </nav>
      )}
    </section>
  );
}

interface OutlineListProps {
  collapsedHeadingKeys: Set<string>;
  nodes: OutlineNode[];
  selectLabel: string;
  toggleLabel: string;
  onSelectHeading?: (heading: MarkdownHeading) => void;
  onToggleHeading(heading: MarkdownHeading): void;
}

function OutlineList({
  collapsedHeadingKeys,
  nodes,
  selectLabel,
  toggleLabel,
  onSelectHeading,
  onToggleHeading
}: OutlineListProps) {
  return (
    <ol>
      {nodes.map((node) => {
        const key = outlineHeadingKey(node.heading);
        const collapsed = collapsedHeadingKeys.has(key);
        const hasChildren = node.children.length > 0;

        return (
          <li key={key}>
            <div className="document-outline-row" data-depth={node.heading.level}>
              {hasChildren ? (
                <button
                  aria-expanded={!collapsed}
                  aria-label={`${node.heading.text} ${toggleLabel}`}
                  className="document-outline-toggle"
                  type="button"
                  onClick={() => onToggleHeading(node.heading)}
                >
                  <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
                </button>
              ) : (
                <span className="document-outline-spacer" />
              )}
              <button
                aria-label={`${node.heading.text} ${selectLabel}`}
                className="document-outline-link"
                type="button"
                onClick={() => onSelectHeading?.(node.heading)}
              >
                {node.heading.text}
              </button>
            </div>
            {hasChildren && !collapsed ? (
              <OutlineList
                collapsedHeadingKeys={collapsedHeadingKeys}
                nodes={node.children}
                selectLabel={selectLabel}
                toggleLabel={toggleLabel}
                onSelectHeading={onSelectHeading}
                onToggleHeading={onToggleHeading}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function buildOutlineTree(headings: MarkdownHeading[]): OutlineNode[] {
  const root: OutlineNode = { heading: { level: 0, lineNumber: 0, text: '' }, children: [] };
  const stack = [root];

  for (const heading of headings) {
    const node = { heading, children: [] };

    while (stack[stack.length - 1].heading.level >= heading.level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root.children;
}

function outlineHeadingKey(heading: MarkdownHeading) {
  return `${heading.lineNumber}:${heading.level}:${heading.text}`;
}
