import { ChevronLeftIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";
import { authenticatedFetch } from "../../auth";
import "./training-program.css";

const TrainingProgramRoute: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const resp = await authenticatedFetch("/api/docs/training-program");
      if (resp.ok) {
        setContent(await resp.text());
      } else {
        setFailed(true);
      }
    });
  }, []);

  return (
    <main className="page training-program">
      <button className="pill back" onClick={() => navigate(-1)}>
        <ChevronLeftIcon size={20} strokeWidth={2.25} />
        Takaisin
      </button>
      <h1 className="page-title">Treeniohjelma</h1>
      {failed ? <p className="error">Treeniohjelman lataaminen epäonnistui.</p> : null}
      {content === null ? null : content.trim() === "" ? (
        <p className="empty">Treeniohjelmaa ei ole vielä. Pyydä sellainen keskustelussa.</p>
      ) : (
        <article className="md">
          <Markdown>{content}</Markdown>
        </article>
      )}
    </main>
  );
};

export { TrainingProgramRoute };
