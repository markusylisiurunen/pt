import { ChevronLeftIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";
import "./training-program.css";

const TrainingProgramRoute: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState("");

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const resp = await fetch("/api/docs/training-program", {
        headers: {
          authorization: `Bearer ${window.localStorage.getItem("token")}`,
        },
      });
      if (resp.ok) {
        const data = await resp.text();
        setContent(data);
      }
    });
  }, []);

  return (
    <div className="training-program-root">
      <div className="header">
        <button id="back" onClick={() => navigate(-1)}>
          <ChevronLeftIcon size={20} strokeWidth={2.25} />
          <span>Takaisin</span>
        </button>
      </div>
      <div className="md">
        <Markdown>{"# Treeniohjelma\n\n" + content}</Markdown>
      </div>
    </div>
  );
};

export { TrainingProgramRoute };
