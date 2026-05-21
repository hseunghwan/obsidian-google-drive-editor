import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from './Icon';

interface ReviewRequestToastProps {
  reviewUrl: string;
  onDismiss(): void;
  onReviewLinkClick(): void;
}

export function ReviewRequestToast({ reviewUrl, onDismiss, onReviewLinkClick }: ReviewRequestToastProps) {
  const { t } = useI18n();

  return (
    <aside aria-label={t('reviewToast.aria')} aria-live="polite" className="review-toast">
      <span className="review-toast-icon">
        <Icon name="star" />
      </span>
      <div className="review-toast-copy">
        <strong>{t('reviewToast.title')}</strong>
        <span>{t('reviewToast.description')}</span>
      </div>
      <div className="review-toast-actions">
        <a className="review-toast-primary" href={reviewUrl} rel="noreferrer" target="_blank" onClick={onReviewLinkClick}>
          {t('reviewToast.action')}
          <Icon name="external-link" />
        </a>
        <button className="review-toast-secondary" type="button" onClick={onDismiss}>
          {t('reviewToast.later')}
        </button>
      </div>
      <button aria-label={t('reviewToast.close')} className="review-toast-close" title={t('reviewToast.close')} type="button" onClick={onDismiss}>
        <Icon name="x" />
      </button>
    </aside>
  );
}
