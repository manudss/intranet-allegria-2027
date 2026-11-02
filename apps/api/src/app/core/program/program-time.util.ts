/** Conversion heure (HH:mm) <-> minutes depuis minuit, miroir de schedule-time.util.ts côté web. */

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function computeEndTime(startTime: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}
