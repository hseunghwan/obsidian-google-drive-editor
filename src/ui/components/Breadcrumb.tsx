import { Icon } from './Icon';

interface BreadcrumbProps {
  path: string;
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const parts = path.split('/');
  return (
    <nav className="breadcrumb" aria-label="Current path">
      {parts.map((part, index) => (
        <span className="breadcrumb-part" key={`${part}-${index}`}>
          {index > 0 ? <Icon name="chevron-right" /> : null}
          {part}
        </span>
      ))}
    </nav>
  );
}
