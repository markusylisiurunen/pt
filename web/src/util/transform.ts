type WeightEntry = {
  date: string;
  weight: number;
};

function interpolate(measurements: WeightEntry[], date: string): number | null {
  // find entries on the exact date
  const entriesOnDate = measurements.filter((entry) => entry.date === date);

  if (entriesOnDate.length === 1) {
    return entriesOnDate[0].weight;
  }

  if (entriesOnDate.length > 1) {
    return Math.min(...entriesOnDate.map((entry) => entry.weight));
  }

  // no entries on the exact date, find closest before and after
  const targetTime = new Date(date).getTime();
  let entryBefore: WeightEntry | null = null;
  let entryAfter: WeightEntry | null = null;

  for (const entry of measurements) {
    const entryTime = new Date(entry.date).getTime();

    if (entryTime < targetTime) {
      if (!entryBefore || entryTime > new Date(entryBefore.date).getTime()) {
        entryBefore = entry;
      }
    } else if (entryTime > targetTime) {
      if (!entryAfter || entryTime < new Date(entryAfter.date).getTime()) {
        entryAfter = entry;
      }
    }
  }

  // need both before and after entries for interpolation
  if (!entryBefore || !entryAfter) {
    return null;
  }

  // linear interpolation
  const beforeTime = new Date(entryBefore.date).getTime();
  const afterTime = new Date(entryAfter.date).getTime();
  const totalDuration = afterTime - beforeTime;
  const elapsedDuration = targetTime - beforeTime;
  const weightDifference = entryAfter.weight - entryBefore.weight;

  return entryBefore.weight + (weightDifference * elapsedDuration) / totalDuration;
}

function calculateSmoothWeightHistory(
  measurements: WeightEntry[],
  windowSize: number,
): WeightEntry[] {
  if (measurements.length === 0) {
    return [];
  }

  // sort history by date to ensure proper ordering
  const sortedHistory = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // find min and max dates
  const minDate = new Date(sortedHistory[0].date);
  const maxDate = new Date(sortedHistory[sortedHistory.length - 1].date);

  // create interpolated daily history
  const interpolatedHistory: WeightEntry[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let time = minDate.getTime(); time <= maxDate.getTime(); time += DAY_MS) {
    const dateStr = new Date(time).toISOString().split("T")[0];
    const weight = interpolate(sortedHistory, dateStr);

    if (weight !== null) {
      interpolatedHistory.push({ date: dateStr, weight });
    }
  }

  // apply trailing moving average smoothing
  const smoothedHistory: WeightEntry[] = [];

  for (let i = 0; i < interpolatedHistory.length; i++) {
    const currentEntry = interpolatedHistory[i];
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowEnd = i;

    let weightSum = 0;
    let count = 0;

    for (let j = windowStart; j <= windowEnd; j++) {
      weightSum += interpolatedHistory[j].weight;
      count++;
    }

    const smoothedWeight = weightSum / count;
    smoothedHistory.push({ date: currentEntry.date, weight: smoothedWeight });
  }

  return smoothedHistory;
}

export { calculateSmoothWeightHistory };
