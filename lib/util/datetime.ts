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

function getTimeZoneOffsetInMinutes(timeZone: string) {
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const timeZoneFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const now = new Date().toISOString();
  const utcDate = new Date(utcFormatter.format(new Date(now)));
  const timeZoneDate = new Date(timeZoneFormatter.format(new Date(now)));
  return (timeZoneDate.getTime() - utcDate.getTime()) / 60000;
}

function getWeekdayAtTimeZone(date: string | Date, timeZone: string): string {
  const utcDate = new Date(date);
  type Opts = Intl.DateTimeFormatOptions;
  const options: Opts = { timeZone, weekday: "long" };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(utcDate);
  const getPart = (part: string) => parts.find((p) => p.type === part)?.value || "";
  return getPart("weekday");
}

export { getDateAtTimeZone, getTimeAtTimeZone, getTimeZoneOffsetInMinutes, getWeekdayAtTimeZone };
