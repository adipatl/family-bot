import { google, calendar_v3 } from "googleapis";
import fs from "fs";
import { config } from "../config/index.js";

let calendarClient: calendar_v3.Calendar;

function getCalendar(): calendar_v3.Calendar {
  if (!calendarClient) {
    const keyFile = JSON.parse(
      fs.readFileSync(config.google.serviceAccountKeyPath, "utf-8"),
    );
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    calendarClient = google.calendar({ version: "v3", auth });
  }
  return calendarClient;
}

export interface CalendarEvent {
  id?: string;
  summary: string;
  start: Date;
  end: Date;
  description?: string;
}

export async function addEvent(event: CalendarEvent): Promise<string> {
  const res = await getCalendar().events.insert({
    calendarId: config.google.calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: "Asia/Bangkok",
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: "Asia/Bangkok",
      },
    },
  });
  return res.data.id ?? "";
}

export async function getEvents(
  dateMin: Date,
  dateMax: Date,
): Promise<CalendarEvent[]> {
  const res = await getCalendar().events.list({
    calendarId: config.google.calendarId,
    timeMin: dateMin.toISOString(),
    timeMax: dateMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone: "Asia/Bangkok",
  });

  return (res.data.items ?? []).map((item) => ({
    id: item.id ?? undefined,
    summary: item.summary ?? "(ไม่มีชื่อ)",
    start: new Date(item.start?.dateTime ?? item.start?.date ?? ""),
    end: new Date(item.end?.dateTime ?? item.end?.date ?? ""),
    description: item.description ?? undefined,
  }));
}
