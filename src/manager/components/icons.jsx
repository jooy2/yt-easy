// Small line icons drawn for this project. Each takes the current text color
// and scales with the font size.
const Svg = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const SearchIcon = () => (
  <Svg>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </Svg>
);

// A gear with eight teeth and a hole in the middle.
export const SettingsIcon = () => (
  <Svg>
    <path d="M10.45 5.28L10.88 2.87L13.12 2.87L13.55 5.28A6.9 6.9 0 0 1 15.66 6.15L17.66 4.75L19.25 6.34L17.85 8.34A6.9 6.9 0 0 1 18.72 10.45L21.13 10.88L21.13 13.12L18.72 13.55A6.9 6.9 0 0 1 17.85 15.66L19.25 17.66L17.66 19.25L15.66 17.85A6.9 6.9 0 0 1 13.55 18.72L13.12 21.13L10.88 21.13L10.45 18.72A6.9 6.9 0 0 1 8.34 17.85L6.34 19.25L4.75 17.66L6.15 15.66A6.9 6.9 0 0 1 5.28 13.55L2.87 13.12L2.87 10.88L5.28 10.45A6.9 6.9 0 0 1 6.15 8.34L4.75 6.34L6.34 4.75L8.34 6.15A6.9 6.9 0 0 1 10.45 5.28Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const ScanIcon = () => (
  <Svg>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </Svg>
);

export const DownloadIcon = () => (
  <Svg>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Svg>
);

export const PlayIcon = () => (
  <Svg>
    <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const ExternalIcon = () => (
  <Svg>
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
  </Svg>
);

export const WindowIcon = () => (
  <Svg>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 9h16" />
  </Svg>
);

export const ArrowUpIcon = () => (
  <Svg>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
);

export const ArrowDownIcon = () => (
  <Svg>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Svg>
);

export const ChevronDownIcon = () => (
  <Svg>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const FilterIcon = () => (
  <Svg>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);

export const TrashIcon = () => (
  <Svg>
    <path d="M5 7h14M10 11v6M14 11v6M9 7V5h6v2M7 7l1 12h8l1-12" />
  </Svg>
);

export const ListIcon = () => (
  <Svg>
    <path d="M9 7h11M9 12h11M9 17h11" />
    <path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
  </Svg>
);
