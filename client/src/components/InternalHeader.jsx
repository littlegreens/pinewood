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
  ListItemText,
  Toolbar,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { detectLanguage, t } from "../services/i18n.js";
import { apiFetch } from "../services/api.js";

const API = import.meta.env.VITE_API_URL || "";

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

  return (
    <>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: "#fff" }}>
        <Toolbar sx={{ justifyContent: "space-between", alignItems: "center", py: "0.4rem", px: 0, bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              aria-label="Apri menu laterale"
              onClick={() => setIsDrawerOpen(true)}
              sx={{ p: 0.5 }}
            >
              <img src="/thumbnail_ba.svg" alt="Menu" style={{ width: 24, height: 24 }} />
            </IconButton>
            <IconButton
              aria-label="Vai alla home"
              onClick={() => navigate("/app")}
              sx={{ p: 0 }}
            >
              <img src="/logo.svg" alt="Pinewood" style={{ width: 160, height: "auto" }} />
            </IconButton>
          </Box>
          {!isGuest && (
            <Box sx={{ display: "flex", alignItems: "center", px: "4px" }}>
              <IconButton aria-label="Vai alla dashboard" onClick={() => navigate("/app/profile")} sx={{ p: 0 }}>
                <Avatar
                  src={avatarSrc}
                  sx={{
                    width: 32,
                    height: 32,
                    p: 0,
                    bgcolor: avatarSrc ? "#fff" : "primary.main",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    "& .MuiAvatar-img": {
                      objectFit: "cover",
                    },
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Box>
          )}
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
          <List sx={{ flexGrow: 1 }}>
            <ListItemButton
              onClick={() => {
                setIsDrawerOpen(false);
                navigate("/app");
              }}
            >
              <ListItemText primary="Home" />
            </ListItemButton>
            <ListItemButton
              onClick={() => {
                setIsDrawerOpen(false);
                navigate("/app/map");
              }}
            >
              <ListItemText primary="Mappa" />
            </ListItemButton>
            {!isGuest && (
              <ListItemButton
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate("/app/my-trails");
                }}
              >
                <ListItemText primary={t(lang, "myTrails")} />
              </ListItemButton>
            )}
            {!isGuest && (
              <ListItemButton
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate("/app/profile");
                }}
              >
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            )}
            {!isGuest && user?.role === "super_admin" && (
              <ListItemButton
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate("/app/admin");
                }}
              >
                <ListItemText primary="Super Admin" />
              </ListItemButton>
            )}
          </List>
          {isGuest && (
            <>
              <Divider sx={{ my: 1 }} />
              <List>
                <ListItemButton
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate("/", { state: { openLogin: true } });
                  }}
                >
                  <ListItemText primary={t(lang, "login")} />
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
                >
                  <ListItemText primary={t(lang, "logout")} />
                </ListItemButton>
              </List>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}
