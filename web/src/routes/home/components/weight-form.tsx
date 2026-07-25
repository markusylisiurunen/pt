import React, { useState } from "react";
import { authenticatedFetch } from "../../../auth";

type WeightFormProps = {
  onSaved: (entry: { date: string; weight: number }) => void;
};

function parseWeight(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null;

  const weight = Number(trimmed.replace(",", "."));
  return weight > 0 ? weight : null;
}

const WeightForm: React.FC<WeightFormProps> = ({ onSaved }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const weight = parseWeight(value);
    if (weight === null || submitting) return;

    setError("");
    setSubmitting(true);
    try {
      const response = await authenticatedFetch("/api/weight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight }),
      });
      if (!response.ok) throw new Error("Failed to save weight");

      const entry = (await response.json()) as { date: string; weight: number };
      onSaved(entry);
      setValue("");
    } catch {
      setError("Painon tallentaminen epäonnistui. Yritä uudelleen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="weight-form" onSubmit={handleSubmit}>
      <label htmlFor="weight">Tämän päivän paino</label>
      <div className="fields">
        <input
          autoComplete="off"
          enterKeyHint="done"
          id="weight"
          inputMode="decimal"
          pattern="[0-9]+([.,][0-9]+)?"
          placeholder="Paino (kg)"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
        />
        <button disabled={submitting || parseWeight(value) === null} type="submit">
          Tallenna
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}
    </form>
  );
};

export { WeightForm };
