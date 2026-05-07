import type { SVGProps } from 'react';

type IconName =
  | 'alert-triangle'
  | 'check'
  | 'chevron-down'
  | 'chevron-right'
  | 'circle-help'
  | 'file-text'
  | 'folder'
  | 'folder-plus'
  | 'hash'
  | 'panel-left'
  | 'panel-right'
  | 'plus'
  | 'refresh-cw'
  | 'save'
  | 'search'
  | 'settings'
  | 'x';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const iconPaths: Record<IconName, string[]> = {
  'alert-triangle': ['M10.3 3.3 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01'],
  check: ['m20 6-11 11-5-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'circle-help': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', 'M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4', 'M12 17h.01'],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  folder: ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.2L10.8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z'],
  'folder-plus': ['M12 10v6', 'M9 13h6', 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.2L10.8 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z'],
  hash: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'],
  'panel-left': ['M3 4h18v16H3z', 'M9 4v16'],
  'panel-right': ['M3 4h18v16H3z', 'M15 4v16'],
  plus: ['M12 5v14', 'M5 12h14'],
  'refresh-cw': ['M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5', 'M3 12A9 9 0 0 1 18 5.3L21 8', 'M21 3v5h-5'],
  save: ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z', 'M17 21v-8H7v8', 'M7 3v5h8'],
  search: ['m21 21-4.3-4.3', 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z'],
  settings: ['M12.2 2h-.4l-1 3.2a7 7 0 0 0-1.5.6L6.2 4.4l-1.8 1.8 1.4 3.1a7 7 0 0 0-.6 1.5L2 11.8v.4l3.2 1a7 7 0 0 0 .6 1.5l-1.4 3.1 1.8 1.8 3.1-1.4a7 7 0 0 0 1.5.6l1 3.2h.4l1-3.2a7 7 0 0 0 1.5-.6l3.1 1.4 1.8-1.8-1.4-3.1a7 7 0 0 0 .6-1.5l3.2-1v-.4l-3.2-1a7 7 0 0 0-.6-1.5l1.4-3.1-1.8-1.8-3.1 1.4a7 7 0 0 0-1.5-.6L12.2 2Z', 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'],
  x: ['M18 6 6 18', 'm6 6 12 12']
};

export function Icon({ name, className = 'icon', ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="16"
      {...props}
    >
      {iconPaths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
