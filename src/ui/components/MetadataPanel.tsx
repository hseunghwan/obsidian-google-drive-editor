import { extractMarkdownMetadata } from '../../domain/markdown/markdownMetadata';
import { useI18n } from '../../i18n/I18nProvider';

interface MetadataPanelProps {
  content: string;
}

export function MetadataPanel({ content }: MetadataPanelProps) {
  const { t } = useI18n();
  const metadata = extractMarkdownMetadata(content);
  const entries = Object.entries(metadata.frontmatter);

  return (
    <section className="metadata-panel" aria-label={t('metadata.aria')}>
      <h2>{t('metadata.properties')}</h2>
      {entries.length === 0 ? (
        <p>{t('metadata.emptyProperties')}</p>
      ) : (
        entries.map(([key, value]) => (
          <div className="property-row" key={key}>
            <span>{key}</span>
            <code>{String(value)}</code>
          </div>
        ))
      )}
      <h2>{t('metadata.tags')}</h2>
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
