function getDateAtTimeZone(date: string | Date, timeZone: string): string {
  const utcDate = new Date(date);
  type Opts = Intl.DateTimeFormatOptions;
  const options: Opts = { timeZone, year: "numeric", month: "2-digit", day: "2-digit" };
  const parts = new Intl.DateTimeFormat("fi-FI", options).formatToParts(utcDate);
  const getPart = (part: string) => parts.find((p) => p.type === part)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function getTimeAtTimeZone(date: string | Date, timeZone: string): string {
  const utcDate = new Date(date);
  type Opts = Intl.DateTimeFormatOptions;
  const options: Opts = { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" };
  const parts = new Intl.DateTimeFormat("fi-FI", options).formatToParts(utcDate);
  const getPart = (part: string) => parts.find((p) => p.type === part)?.value || "";
  return `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
}

function getTimeZoneOffsetInMinutesAtDate(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (part: string) => parts.find((p) => p.type === part)?.value || "";
  const asUtc = Date.UTC(
    Number(getPart("year")),
    Number(getPart("month")) - 1,
    Number(getPart("day")),
    Number(getPart("hour")),
    Number(getPart("minute")),
    Number(getPart("second")),
  );
  return (asUtc - date.getTime()) / 60000;
}

function getTimeZoneOffsetInMinutes(timeZone: string, date: string | Date = new Date()) {
  return getTimeZoneOffsetInMinutesAtDate(new Date(date), timeZone);
}

function getIsoAtStartOfDayAtTimeZone(dateStr: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);

  let ts = utcMidnight;
  const offset = getTimeZoneOffsetInMinutesAtDate(new Date(ts), timeZone);
  ts = utcMidnight - offset * 60000;

  const offset2 = getTimeZoneOffsetInMinutesAtDate(new Date(ts), timeZone);
  if (offset2 !== offset) {
    ts = utcMidnight - offset2 * 60000;
  }

  return new Date(ts).toISOString();
}

function getWeekdayAtTimeZone(date: string | Date, timeZone: string): string {
  const utcDate = new Date(date);
  type Opts = Intl.DateTimeFormatOptions;
  const options: Opts = { timeZone, weekday: "long" };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(utcDate);
  const getPart = (part: string) => parts.find((p) => p.type === part)?.value || "";
  return getPart("weekday");
}

export {
  getDateAtTimeZone,
  getIsoAtStartOfDayAtTimeZone,
  getTimeAtTimeZone,
  getTimeZoneOffsetInMinutes,
  getWeekdayAtTimeZone,
};
