import React, { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import {
  fetchUser,
  forgetUser,
  getActiveToken,
  getPageToken,
  rememberUser,
} from "./auth";
import { ChatRoute } from "./routes/chat/chat";
import { HomeRoute } from "./routes/home/home";
import { LoginRoute } from "./routes/login/login";
import { TrainingProgramRoute } from "./routes/training-program/training-program";
import { applyThemeHue } from "./theme";

const AuthGuard: React.FC = () => {
  const token = getPageToken();
  const [authenticated, setAuthenticated] = useState<boolean | null>(token === null ? false : null);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      const activeToken = getActiveToken();
      if (event.storageArea !== window.localStorage || activeToken === token) return;
      window.location.replace(activeToken === null ? "/login" : "/");
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [token]);

  useEffect(() => {
    if (token === null) return;

    let cancelled = false;
    void fetchUser(token)
      .then((user) => {
        if (cancelled || getActiveToken() !== token) return;
        if (user === null) {
          forgetUser(token);
          setAuthenticated(false);
          return;
        }
        applyThemeHue(user.themeHue);
        rememberUser(user);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled && getActiveToken() === token) {
          setAuthenticated(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (authenticated === false) {
    return <Navigate to="/login" replace />;
  }
  if (authenticated === null) return null;
  return <Outlet />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<AuthGuard />}>
        <Route index element={<HomeRoute />} />
        <Route path="/chats/:id" element={<ChatRoute />} />
        <Route path="/training-program" element={<TrainingProgramRoute />} />
      </Route>
    </Routes>
  );
};

export { App };
