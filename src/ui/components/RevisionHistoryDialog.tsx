import { useEffect, useState } from 'react';

import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

export interface RevisionSummary {
  id: string;
  modifiedTime: string;
}

interface RevisionHistoryDialogProps {
  open: boolean;
  fileId: string;
  listRevisions(fileId: string): Promise<RevisionSummary[]>;
  getRevisionContent(fileId: string, revisionId: string): Promise<string>;
  onRestore(content: string): void;
  onClose(): void;
}

export function RevisionHistoryDialog({
  open,
  fileId,
  listRevisions,
  getRevisionContent,
  onRestore,
  onClose
}: RevisionHistoryDialogProps) {
  const { t, locale } = useI18n();
  const [revisions, setRevisions] = useState<RevisionSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRevisions(null);
    setSelectedId(null);
    setPreview(null);
    setError(false);
    let cancelled = false;
    listRevisions(fileId)
      .then((result) => {
        if (!cancelled) {
          setRevisions(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRevisions([]);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, listRevisions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  async function selectRevision(revisionId: string) {
    setSelectedId(revisionId);
    setPreview(null);
    try {
      const content = await getRevisionContent(fileId, revisionId);
      setPreview(content);
    } catch {
      setError(true);
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
    } catch {
      return iso;
    }
  }

  return (
    <div className="settings-overlay">
      <section aria-labelledby="revision-history-title" aria-modal="true" className="revision-dialog" role="dialog">
        <header className="shortcut-dialog-header">
          <h2 id="revision-history-title">{t('revisions.title')}</h2>
          <button aria-label={t('revisions.close')} className="settings-close" title={t('revisions.close')} type="button" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="revision-dialog-body">
          <ul className="revision-list">
            {revisions === null ? <li className="revision-meta">{t('revisions.loading')}</li> : null}
            {revisions?.length === 0 ? (
              <li className="revision-meta">{error ? t('errors.driveConnectFailed') : t('revisions.empty')}</li>
            ) : null}
            {revisions?.map((revision) => (
              <li key={revision.id}>
                <button
                  className={revision.id === selectedId ? 'active' : ''}
                  type="button"
                  onClick={() => void selectRevision(revision.id)}
                >
                  {formatTime(revision.modifiedTime)}
                </button>
              </li>
            ))}
          </ul>
          <div className="revision-preview">
            {selectedId === null ? (
              <p className="revision-meta">{t('revisions.selectHint')}</p>
            ) : preview === null ? (
              <p className="revision-meta">{t('revisions.loading')}</p>
            ) : (
              <>
                <pre>{preview}</pre>
                <button className="revision-restore" type="button" onClick={() => onRestore(preview)}>
                  <Icon name="refresh-cw" />
                  {t('revisions.restore')}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
