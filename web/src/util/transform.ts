type WeightEntry = {
  date: string;
  weight: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateValue(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function addDays(date: string, days: number): string {
  return new Date(dateValue(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round((dateValue(endDate) - dateValue(startDate)) / DAY_MS);
}

function calculateSmoothWeightHistory(
  measurements: WeightEntry[],
  windowSize: number,
): WeightEntry[] {
  if (measurements.length <= 1) {
    return measurements;
  }

  const interpolatedHistory: WeightEntry[] = [];

  for (let i = 0; i < measurements.length - 1; i++) {
    const start = measurements[i];
    const end = measurements[i + 1];
    const duration = daysBetween(start.date, end.date);

    for (let day = i === 0 ? 0 : 1; day <= duration; day++) {
      interpolatedHistory.push({
        date: addDays(start.date, day),
        weight: start.weight + ((end.weight - start.weight) * day) / duration,
      });
    }
  }

  return interpolatedHistory.map((entry, index) => {
    const window = interpolatedHistory.slice(Math.max(0, index - windowSize + 1), index + 1);
    const weight = window.reduce((sum, item) => sum + item.weight, 0) / window.length;
    return { date: entry.date, weight };
  });
}

export { addDays, calculateSmoothWeightHistory, daysBetween };
