import React from "react";

export function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-6v-6H10v6H4a1 1 0 01-1-1v-9.5z"
      />
    </svg>
  );
}

export function PaperAirplaneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 4.5l17 7.5-17 7.5 4-7.5-4-7.5z"
      />
    </svg>
  );
}

export function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

export function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H9a4 4 0 01-4-4v-2a6 6 0 0112 0v2a4 4 0 01-4 4z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.73 21a2 2 0 01-3.46 0"
      />
    </svg>
  );
}

export function QrCodeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM13 13h2v2h-2zM17 13h4v4h-4zM13 17h2v4h-2z"
      />
    </svg>
  );
}
