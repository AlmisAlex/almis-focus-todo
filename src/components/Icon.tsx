type IconName =
  | 'plus'
  | 'arrow'
  | 'search'
  | 'close'
  | 'trash'
  | 'check'
  | 'layers'
  | 'circle'
  | 'spark'
  | 'shield'
  | 'github'
  | 'undo'
  | 'edit'
  | 'calendar'
  | 'download'
  | 'star'
  | 'folder'
  | 'inbox'
  | 'sun'
  | 'settings'
  | 'timer'
  | 'board'
  | 'grip'
  | 'grid'
  | 'file'
  | 'paperclip';

const paths: Record<IconName, string> = {
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  settings:
    'm9 3-1 3-3 1-2 4 2 2v3l4 3 3-1 3 1 4-3v-3l2-2-2-4-3-1-1-3H9Zm7 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  timer: 'M9 2h6m-3 4V2m6 5 2-2M21 14a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2',
  board: 'M3 4h18v16H3V4Zm6 0v16m6-16v16M5 8h2m4 4h2m4-4h2',
  grip: 'M8 5h1m6 0h1M8 12h1m6 0h1M8 19h1m6 0h1',
  file: 'M5 2h9l5 5v15H5V2Zm9 0v6h5M8 12h8m-8 4h8',
  paperclip:
    'm8 12 7-7a4 4 0 0 1 6 6L10 22a6 6 0 0 1-8-8L13 3m-9 13L15 5a2 2 0 0 1 3 3L7 19a2 2 0 0 1-3-3Z',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  folder: 'M3 6h6l2 2h10v12H3V6Zm0 3h18',
  inbox: 'M5 4h14l3 12v4H2v-4L5 4Zm-3 12h6l2 2h4l2-2h6',
  sun: 'M12 3V1m0 22v-2M3 12H1m22 0h-2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  edit: 'm16 3 5 5-12 12H4v-5L16 3Zm-2 2 5 5',
  calendar: 'M5 4h14v17H5V4Zm3-2v5m8-5v5M5 10h14',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  search: 'm21 21-4.4-4.4M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z',
  close: 'm6 6 12 12M6 18 18 6',
  trash: 'M3 6h18M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6m4-6v6',
  check: 'm5 12 4 4L19 6',
  layers: 'm12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6',
  github:
    'M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .1-1.5-.5-2 4-.5 6.5-2 6.5-6a5 5 0 0 0-1.5-3.5A5 5 0 0 0 19.4 3S18 2.5 15 4a13 13 0 0 0-6 0C6 2.5 4.6 3 4.6 3A5 5 0 0 0 4.5 6.5 5 5 0 0 0 3 10c0 4 2.5 5.5 6.5 6-.6.5-.5 1-.5 2v4',
  undo: 'M4 9h10a6 6 0 0 1 0 12H8M4 9l5-5M4 9l5 5',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
