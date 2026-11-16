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
      <div className="fields">
        <input
          className="field"
          aria-label="Tämän päivän paino (kg)"
          autoComplete="off"
          enterKeyHint="done"
          inputMode="decimal"
          pattern="[0-9]+([.,][0-9]+)?"
          placeholder="Tämän päivän paino"
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
        />
        <button
          className="button"
          disabled={submitting || parseWeight(value) === null}
          type="submit"
        >
          Tallenna
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
    </form>
  );
};

export { WeightForm };
