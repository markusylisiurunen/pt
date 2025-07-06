import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useEffect, useState } from "react";

const AuthRoute: React.FC = () => {
  useEffect(() => {
    const authenticated = window.localStorage.getItem("authToken");
    if (authenticated) window.location.href = "/";
  }, []);
  const [password, setPassword] = useState("");
  async function handleAuth() {
    window.localStorage.setItem("authToken", password);
    window.location.href = "/";
  }
  return (
    <div className="flex h-screen w-screen flex-col justify-center gap-4 px-4 py-4">
      <h3 className="text-center text-3xl font-semibold">Kirjaudu sisään</h3>
      <Input
        type="password"
        placeholder="Salasana"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button onClick={() => handleAuth()}>Kirjaudu</Button>
    </div>
  );
};

export { AuthRoute };
