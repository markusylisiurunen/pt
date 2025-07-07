import { Macros } from "@/components/blocks/macros";
import { Weight } from "@/components/blocks/weight";
import { Button } from "@/components/ui/button";
import React from "react";
import { useNavigate } from "react-router";

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pb-10">
      <h1 className="my-8 text-center text-3xl font-medium">Päivän yhteenveto</h1>
      <div className="flex w-full flex-col gap-4">
        <Macros kcal={{ current: 2000, target: 2500 }} protein={{ current: 150, target: 200 }} />
        <div className="aspect-[16/9] w-full">
          <Weight
            history={[
              { date: "2025-01-01T00:00:00Z", weight: 92 },
              { date: "2025-01-10T00:00:00Z", weight: 91.8 },
              { date: "2025-01-18T00:00:00Z", weight: 91.2 },
              { date: "2025-01-25T00:00:00Z", weight: 90.9 },
              { date: "2025-02-03T00:00:00Z", weight: 90.5 },
              { date: "2025-02-12T00:00:00Z", weight: 90.1 },
              { date: "2025-02-20T00:00:00Z", weight: 89.8 },
              { date: "2025-02-28T00:00:00Z", weight: 89.3 },
              { date: "2025-03-08T00:00:00Z", weight: 88.9 },
              { date: "2025-03-16T00:00:00Z", weight: 88.6 },
              { date: "2025-03-24T00:00:00Z", weight: 88.2 },
              { date: "2025-04-02T00:00:00Z", weight: 87.8 },
              { date: "2025-04-11T00:00:00Z", weight: 87.4 },
              { date: "2025-04-19T00:00:00Z", weight: 87.1 },
              { date: "2025-04-28T00:00:00Z", weight: 86.7 },
              { date: "2025-05-06T00:00:00Z", weight: 86.3 },
              { date: "2025-05-15T00:00:00Z", weight: 85.9 },
              { date: "2025-05-23T00:00:00Z", weight: 85.5 },
              { date: "2025-06-01T00:00:00Z", weight: 85.1 },
              { date: "2025-06-10T00:00:00Z", weight: 84.7 },
            ]}
            target={{ date: "2025-09-01T00:00:00Z", weight: 78 }}
          />
        </div>
      </div>

      <h2 className="mt-8 mb-4 text-xl font-medium">Treeniohjelma</h2>
      <div className="flex flex-col gap-1 text-neutral-200">
        <div>3x Bench press (barbell / dumbbell)</div>
        <div>3x Chest-supported row / T-bar row</div>
        <div>2x Incline dumbbell press</div>
        <div>3x Lateral raise (dumbbell / cable)</div>
        <div>2x Cable triceps press-down</div>
        <div>2x Barbell / EZ-bar curl</div>
      </div>

      <div className="mt-8">
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate(`/chats/${crypto.randomUUID()}`)}
        >
          Keskustele
        </Button>
      </div>
    </div>
  );
};

export { HomeRoute };
