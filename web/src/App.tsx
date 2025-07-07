import { ThemeProvider } from "@/components/theme-provider";
import { AuthRoute } from "@/routes/auth";
import { ChatRoute } from "@/routes/chat";
import { HomeRoute } from "@/routes/home";
import { useMemo } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

const AuthLayout: React.FC = () => {
  const authenticated = useMemo(() => window.localStorage.getItem("authToken") !== null, []);
  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }
  return <Outlet />;
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route element={<AuthLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="/chats/:id" element={<ChatRoute />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
