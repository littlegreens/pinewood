import "./index.css";
import "leaflet/dist/leaflet.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App.jsx";
import Landing from "./pages/Landing.jsx";
import Home from "./pages/Home.jsx";
import MyTrails from "./pages/MyTrails.jsx";
import MapDiscover from "./pages/MapDiscover.jsx";
import TrailDetail from "./pages/TrailDetail.jsx";
import Navigation from "./pages/Navigation.jsx";
import Profile from "./pages/Profile.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";
import LegalPrivacy from "./pages/LegalPrivacy.jsx";
import LegalTerms from "./pages/LegalTerms.jsx";
import LegalCookies from "./pages/LegalCookies.jsx";
import { appTheme } from "./theme.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<Landing />} />
            <Route path="app" element={<Home />} />
            <Route path="app/my-trails" element={<MyTrails />} />
            <Route path="app/map" element={<MapDiscover />} />
            <Route path="app/trails/:trailId" element={<TrailDetail />} />
            <Route path="app/navigation/:sessionId" element={<Navigation />} />
            <Route path="app/profile" element={<Profile />} />
            <Route path="app/admin" element={<AdminUsers />} />
            <Route path="legal/privacy" element={<LegalPrivacy />} />
            <Route path="legal/terms" element={<LegalTerms />} />
            <Route path="legal/cookies" element={<LegalCookies />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
