import React, { useMemo } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { ChatRoute } from "./routes/chat/chat";
import { HomeRoute } from "./routes/home/home";
import { LoginRoute } from "./routes/login/login";

const AuthGuard: React.FC = () => {
  const authenticated = useMemo(() => window.localStorage.getItem("token") !== null, []);
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<AuthGuard />}>
        <Route index element={<HomeRoute />} />
        <Route path="/chats/:id" element={<ChatRoute />} />
      </Route>
    </Routes>
  );
};

export { App };
