import { useEffect, useLayoutEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { bootstrapAuth } from "./services/api.js";
import {
  warmupLocationFix,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
} from "./services/locationTracker.js";
import { lockPortraitOrientation } from "./utils/screenChrome.js";

function scrollDocumentToTop() {
  const root = document.scrollingElement ?? document.documentElement;
  root.scrollTop = 0;
  root.scrollLeft = 0;
  window.scrollTo(0, 0);
}

export default function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrapAuth();
    void warmupLocationFix({ timeoutMs: 9000 });
    startBackgroundLocationTracking();
    return () => {
      stopBackgroundLocationTracking();
    };
  }, []);

  useLayoutEffect(() => {
    scrollDocumentToTop();
  }, [pathname]);

  useLayoutEffect(() => {
    function onPageShow(/** @type {PageTransitionEvent} */ e) {
      if (e.persisted) scrollDocumentToTop();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useLayoutEffect(() => {
    function apply() {
      lockPortraitOrientation();
    }
    apply();
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("pageshow", apply);
    document.addEventListener("visibilitychange", apply);
    return () => {
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("pageshow", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  useLayoutEffect(() => {
    lockPortraitOrientation();
  }, [pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/app/navigation/")) {
      sessionStorage.setItem("pinewood_last_safe_route", pathname || "/app");
    }
  }, [pathname]);

  useEffect(() => {
    function escapeNavigationHistoryEntry() {
      if (!window.location.pathname.startsWith("/app/navigation/")) return;
      const fallback = sessionStorage.getItem("pinewood_last_safe_route") || "/app";
      navigate(fallback, { replace: true });
    }
    window.addEventListener("popstate", escapeNavigationHistoryEntry);
    window.addEventListener("pageshow", escapeNavigationHistoryEntry);
    return () => {
      window.removeEventListener("popstate", escapeNavigationHistoryEntry);
      window.removeEventListener("pageshow", escapeNavigationHistoryEntry);
    };
  }, [navigate]);

  return <Outlet />;
}
