import { ArrowRightIcon } from "lucide-react";
import React, { useState } from "react";
import { activateUser, fetchUser, rememberUser } from "../../auth";
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
      rememberUser(user);
      activateUser(user);
      window.location.replace("/");
    } catch {
      setError("Kirjautuminen epäonnistui. Yritä uudelleen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page login">
      <form className="card" onSubmit={handleLogin}>
        <h1>Peetee</h1>
        <p>Kirjaudu sisään salasanallasi.</p>
        <input
          aria-label="Salasana"
          autoComplete="current-password"
          autoFocus
          className="field"
          placeholder="Salasana"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="cta" type="submit" disabled={submitting || password.length === 0}>
          Kirjaudu
          <span>
            <ArrowRightIcon size={18} strokeWidth={2.25} />
          </span>
        </button>
      </form>
    </main>
  );
};

export { LoginRoute };
