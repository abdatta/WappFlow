import React, { createContext, useContext } from "react";

const ThemeContext = createContext<any>({});

export function createTheme(theme: any) {
  return theme;
}

export function ThemeProvider({ theme, children }: { theme: any; children: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const CssBaseline = () => null;

function applySx(sx: any): React.CSSProperties {
  return typeof sx === "object" ? sx : {};
}

export const Box: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <div style={applySx(sx)} {...props}>
    {children}
  </div>
);

export const Container = Box;

export const AppBar: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <div style={{ position: "sticky", top: 0, ...applySx(sx) }} {...props}>
    {children}
  </div>
);

export const Toolbar: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <div style={{ display: "flex", alignItems: "center", ...applySx(sx) }} {...props}>
    {children}
  </div>
);

export const Typography: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <div style={applySx(sx)} {...props}>
    {children}
  </div>
);

export const Button: React.FC<any> = ({ sx = {}, children, variant, color, ...props }) => {
  const base: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: 8,
    cursor: "pointer",
    border: "none",
    transition: "all .3s",
  };
  if (variant === "contained") {
    base.background = color === "secondary" ? "#7c4dff" : "#00e5ff";
    base.color = "#fff";
  } else {
    base.background = "transparent";
    base.color = color === "secondary" ? "#7c4dff" : "#00e5ff";
  }
  return (
    <button style={{ ...base, ...applySx(sx) }} {...props}>
      {children}
    </button>
  );
};

export const IconButton: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <button
    style={{ background: "transparent", border: "none", cursor: "pointer", ...applySx(sx) }}
    {...props}
  >
    {children}
  </button>
);

export const Card: React.FC<any> = ({ sx = {}, children, ...props }) => (
  <div
    style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.08)", ...applySx(sx) }}
    {...props}
  >
    {children}
  </div>
);

export const Grid: React.FC<any> = ({ container, item, spacing = 0, xs, sm, md, sx = {}, children, ...props }) => {
  const style: React.CSSProperties = applySx(sx);
  if (container) {
    style.display = "flex";
    style.flexWrap = "wrap";
    style.gap = `${spacing * 8}px`;
  }
  if (item) {
    const width = md || sm || xs || 12;
    style.flexBasis = `${(width / 12) * 100}%`;
  }
  return (
    <div style={style} {...props}>
      {children}
    </div>
  );
};

export const Stack: React.FC<any> = ({ direction = "column", spacing = 0, sx = {}, children, ...props }) => (
  <div style={{ display: "flex", flexDirection: direction, gap: spacing * 8, ...applySx(sx) }} {...props}>
    {children}
  </div>
);

export const TextField: React.FC<any> = ({ sx = {}, label, multiline, minRows, fullWidth, ...props }) => {
  const style: React.CSSProperties = {
    padding: "8px",
    borderRadius: 4,
    border: "1px solid #ccc",
    width: fullWidth ? "100%" : undefined,
    ...applySx(sx),
  };
  return multiline ? (
    <textarea rows={minRows} placeholder={label} style={style} {...props} />
  ) : (
    <input placeholder={label} style={style} {...props} />
  );
};

export const Checkbox: React.FC<any> = (props) => <input type="checkbox" {...props} />;

export const FormControlLabel: React.FC<any> = ({ control, label, ...props }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 4 }} {...props}>
    {control}
    <span>{label}</span>
  </label>
);

export default {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Card,
  Grid,
  Stack,
  TextField,
  Checkbox,
  FormControlLabel,
};

