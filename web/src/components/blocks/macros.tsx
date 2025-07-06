import { cn } from "@/lib/utils";
import React from "react";

type MacroProps = {
  label: string;
  current: string;
  target: string;
  percentage: number;
};

const Macro: React.FC<MacroProps> = ({ label, current, target, percentage }) => {
  return (
    <div className="relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/75">
      <div className="relative z-20 flex flex-col items-center gap-2 p-4">
        <h4 className="text-sm text-neutral-300">{label}</h4>
        <span className="text-xl font-bold">
          {current} <span className="text-base font-normal text-neutral-400">/ {target}</span>
        </span>
      </div>
      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 z-10 border-r",
          percentage > 80
            ? "border-red-600/25 bg-red-600/8"
            : percentage > 50
              ? "border-yellow-600/25 bg-yellow-600/8"
              : "border-green-600/25 bg-green-600/8",
        )}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      ></div>
    </div>
  );
};

type MacrosProps = Record<
  "kcal" | "protein",
  {
    current: number;
    target: number;
  }
>;
const Macros: React.FC<MacrosProps> = ({ kcal, protein }) => {
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      <Macro
        label="Kalorit"
        current={kcal.current.toLocaleString("fi-FI", {
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        })}
        target={
          kcal.target.toLocaleString("fi-FI", {
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
          }) + " kcal"
        }
        percentage={(kcal.current / (kcal.target + Number.EPSILON)) * 100}
      />
      <Macro
        label="Proteiini"
        current={protein.current.toLocaleString("fi-FI", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}
        target={
          protein.target.toLocaleString("fi-FI", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          }) + " g"
        }
        percentage={(protein.current / (protein.target + Number.EPSILON)) * 100}
      />
    </div>
  );
};

export { Macros };
