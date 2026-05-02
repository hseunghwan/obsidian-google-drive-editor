import { extractMarkdownMetadata } from '../../domain/markdown/markdownMetadata';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface MetadataPanelProps {
  content: string;
}

export function MetadataPanel({ content }: MetadataPanelProps) {
  const { t } = useI18n();
  const metadata = extractMarkdownMetadata(content);
  const entries = Object.entries(metadata.frontmatter);

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
    </section>
  );
}
