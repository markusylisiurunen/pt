import React from "react";
import { Route, Routes } from "react-router";
import { ChatRoute } from "./routes/chat/chat";
import { HomeRoute } from "./routes/home/home";

const App: React.FC = () => {
  return (
    <Routes>
      <Route index element={<HomeRoute />} />
      <Route path="/chats/:id" element={<ChatRoute />} />
    </Routes>
  );
};

export { App };
