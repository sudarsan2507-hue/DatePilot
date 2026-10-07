/** Helpers for the day itself: navigation links, calendar file and share text. */

const ll = (v) => `${v.lat},${v.lng}`;

/** Google Maps turn-by-turn directions to one stop from wherever the phone is. */
export function directionsTo(venue) {
  return `https://www.google.com/maps/dir/?api=1&destination=${ll(venue)}&travelmode=driving`;
}

/** The whole day in Google Maps: start → every stop in order, as waypoints. */
export function fullRouteUrl(stops, start) {
  if (!stops.length) return '';
  const origin = start ? `${start.lat},${start.lng}` : ll(stops[0].venue);
  const rest = start ? stops : stops.slice(1);
  const destination = ll(rest[rest.length - 1].venue);
  const waypoints = rest.slice(0, -1).map((s) => ll(s.venue)).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
    waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
  }&travelmode=driving`;
}

const icsTime = (date, hhmm) => `${date.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
const icsText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** An .ics file with one event per stop, in Indian time, that any calendar app can import. */
export function calendarFile(stops, date, title = 'DatePilot') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = stops.map((s, i) => [
    'BEGIN:VEVENT',
    `UID:datepilot-${date}-${i}-${s.venue.id}@datepilot`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Kolkata:${icsTime(date, s.arrival_time)}`,
    `DTEND;TZID=Asia/Kolkata:${icsTime(date, s.departure_time)}`,
    `SUMMARY:${icsText(`${title}: ${s.venue.name}`)}`,
    `LOCATION:${icsText(`${s.venue.name}, ${s.venue.area}`)}`,
    `GEO:${s.venue.lat};${s.venue.lng}`,
    `DESCRIPTION:${icsText(`${s.slot} · about ₹${s.cost} for two\nDirections: ${directionsTo(s.venue)}`)}`,
    'END:VEVENT',
  ].join('\r\n'));
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DatePilot//Date plan//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Kolkata',
    'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'TZNAME:IST', 'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadCalendar(stops, date) {
  const blob = new Blob([calendarFile(stops, date)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datepilot-${date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Plain-text summary for sharing in WhatsApp or messages. */
export function shareText(stops, date, total, start) {
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const lines = stops.map((s) => `${s.arrival_time}  ${s.venue.name} (${s.venue.area})`);
  return [
    `Our day out · ${day}`,
    ...lines,
    `About ₹${Number(total).toLocaleString('en-IN')} for two`,
    `Route: ${fullRouteUrl(stops, start)}`,
  ].join('\n');
}
