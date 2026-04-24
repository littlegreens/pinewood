import { DialogTitle, Typography } from "@mui/material";

export default function AppDialogTitle({ title, icon = null, right = null }) {
  return (
    <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography component="h2" sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
        {icon}
        {title}
      </Typography>
      {right}
    </DialogTitle>
  );
}
