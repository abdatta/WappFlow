import React, { useEffect, useState } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";

const glassCard = {
  p: 4,
  borderRadius: 2,
  backgroundColor: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  transition: "transform .3s, box-shadow .3s",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 16px 32px rgba(0,0,0,0.4)",
  },
};

export default function Qr() {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const update = () => {
      const ts = Date.now();
      setSrc(`/qr/latest?ts=${ts}`);
    };
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <Stack spacing={4} alignItems="center">
      <Typography variant="h4" fontWeight="bold">
        QR Code
      </Typography>
      <Card sx={glassCard}>
        {src ? (
          <Box component="img" src={src} alt="QR" sx={{ maxWidth: "100%" }} />
        ) : (
          <Typography>Loading...</Typography>
        )}
      </Card>
    </Stack>
  );
}
