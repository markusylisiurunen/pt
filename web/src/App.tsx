import React, { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { fetchUser, forgetUser, getActiveToken, saveUser } from "./auth";
import { ChatRoute } from "./routes/chat/chat";
import { HomeRoute } from "./routes/home/home";
import { LoginRoute } from "./routes/login/login";
import { TrainingProgramRoute } from "./routes/training-program/training-program";

const AuthGuard: React.FC = () => {
  const token = getActiveToken();
  const [authenticated, setAuthenticated] = useState<boolean | null>(token === null ? false : null);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (
        event.storageArea !== window.localStorage ||
        (event.key !== "token" && event.key !== null)
      ) {
        return;
      }
      window.location.replace(event.newValue === null ? "/login" : "/");
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (token === null) return;

    let cancelled = false;
    void fetchUser(token)
      .then((user) => {
        if (cancelled || window.localStorage.getItem("token") !== token) return;
        if (user === null) {
          forgetUser(token);
          setAuthenticated(false);
          return;
        }
        saveUser(user);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled && window.localStorage.getItem("token") === token) {
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
