import { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
} from "@mui/material";
import FilterHdrIcon from "@mui/icons-material/FilterHdr";
import HikingIcon from "@mui/icons-material/Hiking";
import ExploreIcon from "@mui/icons-material/Explore";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import { useLocation, useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import { apiFetch } from "../services/api.js";
import { pageContainerSx } from "../theme/layout.js";

const API = import.meta.env.VITE_API_URL || "";
const PINE = "#2D4F1E";

function readStoredUser() {
  const raw = localStorage.getItem("pinewood_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("pinewood_user");
    return null;
  }
}

function NavItem({ icon, label, path, currentPath, onClick }) {
  const active = path === "/app"
    ? currentPath === "/app"
    : currentPath.startsWith(path);

  return (
    <ListItemButton
      onClick={onClick}
      sx={{
        borderRadius: 2,
        mb: 0.3,
        color: active ? PINE : "text.primary",
        bgcolor: active ? "rgba(45,79,30,0.07)" : "transparent",
        "&:hover": { bgcolor: active ? "rgba(45,79,30,0.12)" : "rgba(0,0,0,0.04)" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36, color: active ? PINE : "text.primary" }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={label}
        primaryTypographyProps={{
          fontWeight: 700,
          fontSize: "0.95rem",
        }}
      />
      {active && (
        <Box
          sx={{
            width: 4,
            height: 22,
            borderRadius: 99,
            bgcolor: PINE,
            ml: 1,
            flexShrink: 0,
          }}
        />
      )}
    </ListItemButton>
  );
}

export default function InternalHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useMemo(() => detectLanguage(), []);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [userRefreshTick, setUserRefreshTick] = useState(0);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onPageShow(/** @type {PageTransitionEvent} */ e) {
      if (e.persisted) setIsDrawerOpen(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const [user, setUser] = useState(() => {
    return readStoredUser();
  });
  const [isGuest, setIsGuest] = useState(() => !localStorage.getItem("pinewood_access_token"));
  const initials = user?.name ? user.name.slice(0, 1).toUpperCase() : "P";
  const avatarSrc = user?.avatar_url ? `${API}${user.avatar_url}` : undefined;

  useEffect(() => {
    let active = true;
    async function refreshUser() {
      const token = localStorage.getItem("pinewood_access_token");
      if (!token) return;
      const res = await apiFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setUser(data);
      localStorage.setItem("pinewood_user", JSON.stringify(data));
    }
    refreshUser();
    return () => {
      active = false;
    };
  }, [userRefreshTick]);

  useEffect(() => {
    function syncUser() {
      setUser(readStoredUser());
      setIsGuest(!localStorage.getItem("pinewood_access_token"));
      setUserRefreshTick((v) => v + 1);
    }
    window.addEventListener("storage", syncUser);
    window.addEventListener("pinewood-user-updated", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("pinewood-user-updated", syncUser);
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "DELETE",
        credentials: "include",
      });
    } finally {
      localStorage.removeItem("pinewood_access_token");
      localStorage.removeItem("pinewood_user");
      window.dispatchEvent(new Event("pinewood-user-updated"));
      navigate("/");
    }
  }

  function go(path) {
    setIsDrawerOpen(false);
    navigate(path);
  }

  const cur = location.pathname;

  return (
    <>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: "#fff" }}>
        <Toolbar
          disableGutters
          sx={{
            justifyContent: "center",
            alignItems: "center",
            py: { xs: "0.4rem", md: "0.65rem" },
            px: 0,
            bgcolor: "#fff",
            minHeight: { xs: 56, md: 72 },
          }}
        >
          <Box
            sx={{
              ...pageContainerSx,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, md: 1.5 } }}>
              <IconButton
                aria-label="Apri menu laterale"
                onClick={() => setIsDrawerOpen(true)}
                sx={{ p: 0.5 }}
              >
                <Box
                  component="img"
                  src="/thumbnail_ba.svg"
                  alt="Menu"
                  sx={{ width: { xs: 24, md: 28 }, height: { xs: 24, md: 28 } }}
                />
              </IconButton>
              <IconButton aria-label="Vai alla home" onClick={() => navigate("/app")} sx={{ p: 0 }}>
                <Box
                  component="img"
                  src="/logo.svg"
                  alt="Pinewood"
                  sx={{ width: { xs: 160, md: 220 }, height: "auto", display: "block" }}
                />
              </IconButton>
            </Box>
            {!isGuest && (
              <Box sx={{ display: "flex", alignItems: "center", px: "4px" }}>
                <IconButton aria-label="Vai alla dashboard" onClick={() => navigate("/app/profile")} sx={{ p: 0 }}>
                  <Avatar
                    src={avatarSrc}
                    sx={{
                      width: { xs: 32, md: 40 },
                      height: { xs: 32, md: 40 },
                      p: 0,
                      bgcolor: avatarSrc ? "#fff" : "primary.main",
                      color: "white",
                      fontSize: { xs: "0.8rem", md: "0.95rem" },
                      fontWeight: 700,
                      "& .MuiAvatar-img": { objectFit: "cover" },
                    }}
                  >
                    {initials}
                  </Avatar>
                </IconButton>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
        <Box sx={{ width: 280, p: 2, minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <img src="/logo.svg" alt="Pinewood" style={{ width: 130, height: "auto" }} />
            <IconButton aria-label="Chiudi menu" onClick={() => setIsDrawerOpen(false)} sx={{ p: 0.5 }}>
              <img src="/thumbnail_ba.svg" alt="Chiudi" style={{ width: 24, height: 24 }} />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 1.2 }} />

          <List sx={{ flexGrow: 1, px: 0 }}>
            <NavItem
              icon={<FilterHdrIcon />}
              label="Home"
              path="/app"
              currentPath={cur}
              onClick={() => go("/app")}
            />
            <NavItem
              icon={<HikingIcon />}
              label="Trails"
              path="/app/trails"
              currentPath={cur}
              onClick={() => go("/app/trails")}
            />
            <NavItem
              icon={<ExploreIcon />}
              label="Mappa"
              path="/app/map"
              currentPath={cur}
              onClick={() => go("/app/map")}
            />
            {!isGuest && (
              <NavItem
                icon={<FavoriteBorderIcon />}
                label={t(lang, "myTrails")}
                path="/app/my-trails"
                currentPath={cur}
                onClick={() => go("/app/my-trails")}
              />
            )}
            {!isGuest && (
              <NavItem
                icon={<AccountCircleIcon />}
                label="Dashboard"
                path="/app/profile"
                currentPath={cur}
                onClick={() => go("/app/profile")}
              />
            )}
            {!isGuest && user?.role === "super_admin" && (
              <NavItem
                icon={<AdminPanelSettingsIcon />}
                label="Super Admin"
                path="/app/admin"
                currentPath={cur}
                onClick={() => go("/app/admin")}
              />
            )}
          </List>

          {isGuest && (
            <>
              <Divider sx={{ my: 1 }} />
              <List>
                <ListItemButton
                  onClick={() => go("/")}
                  sx={{ borderRadius: 2 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                    <LoginIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={t(lang, "login")}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: "0.95rem" }}
                  />
                </ListItemButton>
              </List>
            </>
          )}
          {!isGuest && (
            <>
              <Divider sx={{ my: 1 }} />
              <List>
                <ListItemButton
                  onClick={async () => {
                    setIsDrawerOpen(false);
                    await handleLogout();
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                    <LogoutIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={t(lang, "logout")}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: "0.95rem" }}
                  />
                </ListItemButton>
              </List>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}
