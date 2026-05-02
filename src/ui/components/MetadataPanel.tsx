import { extractMarkdownMetadata } from '../../domain/markdown/markdownMetadata';

interface MetadataPanelProps {
  content: string;
}

export function MetadataPanel({ content }: MetadataPanelProps) {
  const metadata = extractMarkdownMetadata(content);
  const entries = Object.entries(metadata.frontmatter);

  return (
    <section className="metadata-panel" aria-label="Properties and tags">
      <h2>Properties</h2>
      {entries.length === 0 ? (
        <p>등록된 프로퍼티가 없습니다.</p>
      ) : (
        entries.map(([key, value]) => (
          <div className="property-row" key={key}>
            <span>{key}</span>
            <code>{String(value)}</code>
          </div>
        ))
      )}
      <h2>Tags</h2>
      <div className="tag-list">
        {metadata.tags.map((tag) => (
          <span className="tag" key={tag}>
            #{tag}
          </span>
        ))}
      </div>
    </section>
  );
}
