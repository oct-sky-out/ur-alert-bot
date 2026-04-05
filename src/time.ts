export interface TokyoRunContext {
  date: string;
  runAtIso: string;
  runLabel: string;
}

export function getTokyoRunContext(now = new Date()): TokyoRunContext {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const date = `${map.year}-${map.month}-${map.day}`;
  const time = `${map.hour}:${map.minute}:${map.second}`;

  return {
    date,
    runAtIso: `${date}T${time}+09:00`,
    runLabel: `${map.hour}:${map.minute}`,
  };
}
