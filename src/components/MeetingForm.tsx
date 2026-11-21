"use client";
import { useActionState, useState } from "react";
import type { Meeting } from "@/lib/database.types";
import { saveMeeting } from "@/lib/meeting-actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function MeetingForm({
  tender,
  stage,
  members,
  user,
  meeting,
}: {
  tender: string;
  stage: string;
  members: { id: string; name: string }[];
  user: string;
  meeting?: Meeting;
}) {
  const [status, action, pending] = useActionState(
    saveMeeting.bind(null, tender, stage),
    "",
  );
  const [previewAt, setPreviewAt] = useState(0);
  const [open, setOpen] = useState(false),
    [createId, setCreateId] = useState("");
  const [time, setTime] = useState(
    meeting
      ? new Date(Date.parse(meeting.starts_at) + 7 * 3600000)
          .toISOString()
          .slice(0, 16)
      : "",
  );
  const [day, setDay] = useState(meeting?.day_notice ?? true),
    [hour, setHour] = useState(meeting?.hour_notice ?? true);
  const organizer = meeting?.organizer ?? user;
  if (!open)
    return (
      <Button
        variant={meeting ? "outline" : "default"}
        onClick={() => {
          setPreviewAt(Date.now());
          setCreateId(crypto.randomUUID());
          setOpen(true);
        }}
      >
        {meeting ? "Manage meeting" : "Add meeting"}
      </Button>
    );
  return (
    <form action={action} className="grid max-w-xl gap-4 rounded-lg border p-4">
      <input type="hidden" name="id" value={meeting?.id ?? ""} />
      <input type="hidden" name="revision" value={meeting?.revision ?? 0} />
      <input type="hidden" name="createId" value={createId} />
      <label>
        Meeting topic
        <Input
          name="topic"
          required
          maxLength={180}
          defaultValue={meeting?.topic}
        />
      </label>
      <label>
        Date and time (WIB)
        <Input
          name="time"
          type="datetime-local"
          required
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setPreviewAt(Date.now());
          }}
        />
      </label>
      <label>
        Meeting link (optional)
        <Input type="url" name="link" defaultValue={meeting?.link ?? ""} />
      </label>
      <fieldset>
        <legend>Internal participants</legend>
        <div className="max-h-48 overflow-auto">
          {members.map((m) => (
            <label className="flex items-center gap-2 py-2" key={m.id}>
              <input
                type="checkbox"
                name="member"
                value={m.id}
                disabled={m.id === organizer}
                defaultChecked={
                  m.id === organizer || meeting?.participants.includes(m.id)
                }
              />
              {m.name}
              {m.id === organizer ? " (organizer)" : ""}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Additional @zekindo.co.id emails
        <Input
          name="emails"
          defaultValue={meeting?.extra_emails?.join(", ")}
          placeholder="nama@zekindo.co.id"
        />
        <small>Separate addresses with commas.</small>
      </label>
      <fieldset>
        <legend>Email reminders</legend>
        {[
          { key: "day", hours: 24, on: day, set: setDay },
          { key: "hour", hours: 1, on: hour, set: setHour },
        ].map((r) => {
          const due = Date.parse(time + ":00+07:00") - r.hours * 3600000;
          return (
            <label className="flex items-center gap-2 py-2" key={r.key}>
              <input
                type="checkbox"
                name={r.key}
                checked={r.on}
                onChange={(e) => r.set(e.target.checked)}
              />
              {r.hours}h before{" "}
              {r.on &&
                Number.isFinite(due) &&
                (due > previewAt
                  ? " · " +
                    new Date(due).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    }) +
                    " WIB"
                  : " · reminder time has passed")}
            </label>
          );
        })}
      </fieldset>
      {status && <p role="status">{status}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending}>Save meeting</Button>
        <Button
          variant="outline"
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Close
        </Button>
        {meeting && (
          <Button
            type="submit"
            name="intent"
            value="cancel"
            formNoValidate
            variant="ghost"
            disabled={pending}
            onClick={(e) => {
              if (!window.confirm("Cancel this meeting?")) e.preventDefault();
            }}
          >
            Cancel meeting
          </Button>
        )}
      </div>
    </form>
  );
}
