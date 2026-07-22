import { ArrowRightIcon } from "lucide-react";
import React, { useState } from "react";
import { fetchUser, saveUser } from "../../auth";
import "./login.css";

const LoginRoute: React.FC = () => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (password.length === 0 || submitting) return;

    setError("");
    setSubmitting(true);
    try {
      const user = await fetchUser(password);
      if (user === null) {
        setError("Väärä salasana.");
        return;
      }
      saveUser(user);
      window.location.replace("/");
    } catch {
      setError("Kirjautuminen epäonnistui. Yritä uudelleen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-root">
      <div className="spacer" />
      <form className="form" onSubmit={handleLogin}>
        <h1>Kirjaudu sisään</h1>
        <input
          autoFocus
          type="password"
          placeholder="Salasana"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
        />
        {error ? <div className="error">{error}</div> : null}
        <button type="submit" disabled={submitting}>
          <span>Kirjaudu</span>
          <ArrowRightIcon size={20} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  );
};

export { LoginRoute };
