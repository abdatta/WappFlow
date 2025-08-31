import React from "react";

export const Brightness4: React.FC<any> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M9.37 5.51A7 7 0 0012 19a7 7 0 006.49-4.49A9 9 0 019.37 5.5v.01z" />
  </svg>
);

export const Brightness7: React.FC<any> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0-5h1v4h-1V2zm0 16h1v4h-1v-4zm10-6v1h-4v-1h4zM6 12v1H2v-1h4zm12.95-5.05l.7.7-2.83 2.83-.7-.7 2.83-2.83zM7.05 16.95l.7.7L4.92 20.5l-.7-.7 2.83-2.83zM16.95 16.95l2.83 2.83-.7.7-2.83-2.83.7-.7zM7.05 7.05L4.22 4.22l.7-.7 2.83 2.83-.7.7z" />
  </svg>
);

export default { Brightness4, Brightness7 };
