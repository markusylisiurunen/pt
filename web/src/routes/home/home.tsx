import { ArrowRightIcon, PlusIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  activateUser,
  authenticatedFetch,
  getPageToken,
  getSavedUsers,
  logout,
  type SavedUser,
} from "../../auth";
import { FoodLogEntries } from "./components/food-log-entries";
import { IntakeCard } from "./components/intake-card";
import { IntakeHistory } from "./components/intake-history";
import { Memories } from "./components/memories";
import { WeightGraph } from "./components/weight-graph";
import "./home.css";

type HomeSection = "nutrition" | "weight" | "training" | "memories";

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();
  const now = useMemo(() => new Date().toISOString(), []);
  const users = useMemo(() => getSavedUsers(), []);
  const pageToken = getPageToken();

  const [hiddenHomeSections, setHiddenHomeSections] = useState<HomeSection[] | null>(null);
  const [memories, setMemories] = useState<string[]>([]);
  const [dailyIntake, setDailyIntake] = useState({ kcal: 0, protein: 0 });
  const [dailyTarget, setDailyTarget] = useState({ kcal: 0, protein: 0 });
  const [intakeHistory, setIntakeHistory] = useState<{ date: string; kcal: number }[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [targetWeightDate, setTargetWeightDate] = useState<string | null>(null);
  const [targetWeightValue, setTargetWeightValue] = useState<number>(0);
  const [foodLogToday, setFoodLogToday] = useState<
    {
      ts: string;
      label: string;
      kcal: number;
      protein: number;
    }[]
  >([]);

  function isHomeSectionVisible(section: HomeSection) {
    return hiddenHomeSections !== null && !hiddenHomeSections.includes(section);
  }

  function handleSwitchUser(user: SavedUser) {
    if (user.token === pageToken) return;
    activateUser(user);
    window.location.replace("/");
  }

  function handleLogout() {
    window.location.replace(logout() ? "/" : "/login");
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const resp = await authenticatedFetch("/api/config");
      if (resp.ok) {
        const data = (await resp.json()) as {
          config: {
            memoryEntries: string[];
            hiddenHomeSections: HomeSection[];
            targetDailyIntakeCalories: number;
            targetDailyIntakeProtein: number;
            targetWeightDate: string;
            targetWeightValue: number;
          };
          foodIntakeToday: {
            kcal: number;
            protein: number;
          };
          foodIntakeHistory: {
            date: string;
            kcal: number;
          }[];
          weightHistory: {
            date: string;
            weight: number;
          }[];
          foodLogToday: {
            ts: string;
            label: string;
            kcal: number;
            protein: number;
          }[];
        };
        setHiddenHomeSections(data.config.hiddenHomeSections);
        setMemories(data.config.memoryEntries.reverse());
        setDailyIntake({
          kcal: data.foodIntakeToday.kcal,
          protein: data.foodIntakeToday.protein,
        });
        setDailyTarget({
          kcal: data.config.targetDailyIntakeCalories,
          protein: data.config.targetDailyIntakeProtein,
        });
        setIntakeHistory(data.foodIntakeHistory);
        setWeightHistory(data.weightHistory);
        setTargetWeightDate(data.config.targetWeightDate);
        setTargetWeightValue(data.config.targetWeightValue);
        setFoodLogToday(data.foodLogToday);
      }
    });
  }, []);

  return (
    <div className="home-root">
      <div className="users">
        {users.map((user) => (
          <button
            className={user.token === pageToken ? "active" : undefined}
            key={user.name}
            onClick={() => handleSwitchUser(user)}
          >
            {user.name}
          </button>
        ))}
        <button aria-label="Lisää käyttäjä" onClick={() => navigate("/login")}>
          <PlusIcon size={20} strokeWidth={2.25} />
        </button>
      </div>
      <div className="header">
        <button onClick={handleLogout}>Poistu</button>
        <button onClick={() => navigate(`/chats/${crypto.randomUUID()}`)}>
          <span>Keskustele</span>
          <ArrowRightIcon size={20} strokeWidth={2.25} />
        </button>
      </div>
      {isHomeSectionVisible("nutrition") ? (
        <>
          <div className="intake">
            <IntakeCard
              heading="Kalorit"
              current={dailyIntake.kcal}
              target={dailyTarget.kcal}
              unit="kcal"
              maximumFractionDigits={0}
            />
            <IntakeCard
              heading="Proteiini"
              current={dailyIntake.protein}
              target={dailyTarget.protein}
              unit="g"
              maximumFractionDigits={1}
            />
          </div>
          <IntakeHistory target={dailyTarget.kcal} history={intakeHistory} />
          <FoodLogEntries entries={foodLogToday} />
        </>
      ) : null}
      {isHomeSectionVisible("weight") && targetWeightDate !== null ? (
        <WeightGraph
          now={now}
          history={weightHistory}
          targetDate={targetWeightDate}
          targetWeight={targetWeightValue}
        />
      ) : null}
      {isHomeSectionVisible("training") ? (
        <Link to="/training-program">
          <span>Treeniohjelma</span>
          <ArrowRightIcon size={20} strokeWidth={2} />
        </Link>
      ) : null}
      {isHomeSectionVisible("memories") ? (
        <Memories memories={memories} />
      ) : null}
    </div>
  );
};

export { HomeRoute };
