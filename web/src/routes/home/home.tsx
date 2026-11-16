import { ArrowRightIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
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
import { WeightCard } from "./components/weight-card";
import "./home.css";

type HomeSection = "nutrition" | "weight" | "training" | "memories";

function getGreeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return "Hyvää huomenta";
  if (hour >= 10 && hour < 17) return "Hyvää päivää";
  if (hour >= 17 && hour < 22) return "Hyvää iltaa";
  return "Hyvää yötä";
}

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date().toISOString());
  const users = useMemo(() => getSavedUsers(), []);
  const pageToken = getPageToken();
  const userName = users.find((user) => user.token === pageToken)?.name;

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
      kcal?: number;
      protein?: number;
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

  function handleWeightSaved(entry: { date: string; weight: number }) {
    setWeightHistory((history) =>
      [...history.filter((item) => item.date !== entry.date), entry].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    setNow(new Date().toISOString());
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
            kcal?: number;
            protein?: number;
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
    <main className="page home">
      <nav className="users">
        {users.map((user) => (
          <button
            aria-current={user.token === pageToken ? "true" : undefined}
            className="pill"
            key={user.name}
            onClick={() => handleSwitchUser(user)}
          >
            {user.name}
          </button>
        ))}
        <button
          className="pill icon"
          aria-label="Lisää käyttäjä"
          onClick={() => navigate("/login")}
        >
          <PlusIcon size={18} strokeWidth={2.5} />
        </button>
        <button className="pill logout" onClick={handleLogout}>
          Poistu
        </button>
      </nav>
      <h1 className="page-title">
        {getGreeting(new Date(now))}
        {userName ? `, ${userName}` : ""}
      </h1>
      <button className="cta" onClick={() => navigate(`/chats/${crypto.randomUUID()}`)}>
        Keskustele
        <span>
          <ArrowRightIcon size={18} strokeWidth={2.25} />
        </span>
      </button>
      {isHomeSectionVisible("nutrition") ? (
        <>
          <div className="intake">
            <IntakeCard
              heading="Kalorit"
              unit="kcal"
              subject="kcal"
              current={dailyIntake.kcal}
              target={dailyTarget.kcal}
              goal="max"
              maximumFractionDigits={0}
            />
            <IntakeCard
              heading="Proteiini"
              unit="g"
              subject="protein"
              current={dailyIntake.protein}
              target={dailyTarget.protein}
              goal="min"
              maximumFractionDigits={1}
            />
          </div>
          <FoodLogEntries entries={foodLogToday} />
          <IntakeHistory now={now} target={dailyTarget.kcal} history={intakeHistory} />
        </>
      ) : null}
      {isHomeSectionVisible("weight") && targetWeightDate !== null ? (
        <WeightCard
          now={now}
          history={weightHistory}
          targetDate={targetWeightDate}
          targetWeight={targetWeightValue}
          onSaved={handleWeightSaved}
        />
      ) : null}
      {isHomeSectionVisible("training") ? (
        <Link className="card training-link" to="/training-program">
          Treeniohjelma
          <ChevronRightIcon size={20} />
        </Link>
      ) : null}
      {isHomeSectionVisible("memories") ? <Memories memories={memories} /> : null}
    </main>
  );
};

export { HomeRoute };
