import React, { useState } from "react";
import { useNavigate } from "react-router";
import "./login.css";

const LoginRoute: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  function handleLogin() {
    if (password.trim().length === 0) return;
    window.localStorage.setItem("token", password);
    navigate("/", { replace: true });
  }

  return (
    <div className="login-root">
      <div className="form">
        <h1>Kirjaudu sisään</h1>
        <input
          type="password"
          placeholder="Salasana"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Kirjaudu</button>
      </div>
    </div>
  );
};

export { LoginRoute };
