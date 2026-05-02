import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, ChevronLeft, ChevronRight, Clock, User, Video } from "lucide-react";
import AppLayout from "@/components/AppLayout";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const EVENT_TYPE_COLORS = {
  meeting: { bg: "rgba(167,100,230,0.15)", border: "rgba(167,100,230,0.4)", text: "#a764e6" },
  call: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)", text: "#3b82f6" },
  deadline: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#ef4444" },
  followup: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", text: "#f59e0b" },
  google_meet: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.4)", text: "#10b981" },
};

const EMPTY_EVENT = {
  title: "", client_name: "", event_type: "meeting", date: "", time: "",
  duration_minutes: "60", description: "", meet_link: "", assigned_to_name: "",
};

export default function CalendarPage() {
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    base44.entities.Task.list("-due_date", 200),
    base44.entities.Client.list("-created_date", 200),
  ]).then(([tasks, c]) => {
    // Map tasks as calendar events
    setEvents(tasks.filter(t => t.due_date));
    setClients(c);
    setLoading(false);
  });

  useEffect(() => { load(); }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const eventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.due_date?.startsWith(dateStr));
  };

  const save = async () => {
    setSaving(true);
    await base44.entities.Task.create({
      title: form.title,
      client_name: form.client_name,
      status: "todo",
      priority: "medium",
      due_date: form.date,
      description: `[${form.event_type?.toUpperCase()}]${form.time ? ` at ${form.time}` : ""}${form.meet_link ? `\nMeet link: ${form.meet_link}` : ""}${form.description ? `\n${form.description}` : ""}`,
      assigned_to_name: form.assigned_to_name,
    });
    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_EVENT);
    load();
  };

  const openDay = (day) => {
    if (!day) return;
    setSelectedDay(selectedDay === day ? null : day);
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const dayEvs = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <AppLayout title="Calendar" subtitle="Meetings, deadlines & Google Meet sessions">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "#a8a8c0" }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold" style={{ color: "#f4f4fa" }}>{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "#a8a8c0" }}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setViewDate(new Date())} className="text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "#a764e6" }}>
            Today
          </button>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_EVENT, date: selectedDay ? `${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` : "" }); setShowForm(true); }}
          className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Add Event
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="glass rounded-2xl overflow-hidden mb-6">
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {DAYS.map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-medium" style={{ color: "#6b6b85" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayEvs = eventsForDay(day);
            const isToday = day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
            const isSelected = day === selectedDay;
            return (
              <div key={i} onClick={() => openDay(day)}
                className={`min-h-[72px] p-1.5 border-r border-b cursor-pointer transition-all ${day ? "hover:bg-white/3" : ""} ${isSelected ? "bg-white/5" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {day && (
                  <>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1 ${isToday ? "gradient-bg text-white" : ""}`}
                      style={!isToday ? { color: "#a8a8c0" } : {}}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 2).map((ev, j) => (
                        <div key={j} className="text-[10px] px-1 py-0.5 rounded truncate" style={{ background: "rgba(167,100,230,0.15)", color: "#a764e6" }}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvs.length > 2 && <div className="text-[10px]" style={{ color: "#6b6b85" }}>+{dayEvs.length - 2} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail */}
      {selectedDay && (
        <div className="glass rounded-2xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#f4f4fa" }}>
            {MONTHS[month]} {selectedDay}, {year}
          </h3>
          {dayEvs.length === 0 ? (
            <p className="text-sm" style={{ color: "#6b6b85" }}>No events — click "Add Event" to schedule something.</p>
          ) : (
            <div className="space-y-2">
              {dayEvs.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#a764e6" }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "#f4f4fa" }}>{ev.title}</p>
                    {ev.client_name && <p className="text-xs" style={{ color: "#a8a8c0" }}>{ev.client_name}</p>}
                    {ev.description && <p className="text-xs mt-1 whitespace-pre-line" style={{ color: "#6b6b85" }}>{ev.description}</p>}
                  </div>
                  <Badge className="text-[10px] border capitalize" style={{ background: "rgba(167,100,230,0.15)", color: "#a764e6", borderColor: "rgba(167,100,230,0.3)" }}>
                    {ev.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">New Calendar Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Strategy call with client" className="bg-secondary/50 border-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Type</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="google_meet">Google Meet</SelectItem>
                    <SelectItem value="deadline">Deadline</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Client</Label>
                <Select value={form.client_name} onValueChange={v => setForm(f => ({ ...f, client_name: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.business_name}>{c.business_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Time</Label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="bg-secondary/50 border-border/50" />
              </div>
            </div>
            {form.event_type === "google_meet" && (
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Google Meet Link</Label>
                <Input value={form.meet_link} onChange={e => setForm(f => ({ ...f, meet_link: e.target.value }))} placeholder="https://meet.google.com/…" className="bg-secondary/50 border-border/50" />
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Assigned To</Label>
              <Input value={form.assigned_to_name} onChange={e => setForm(f => ({ ...f, assigned_to_name: e.target.value }))} placeholder="Staff member name" className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "#a8a8c0" }}>Notes</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/50 border-border/50 h-16" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.title || !form.date} className="gradient-bg text-white hover:opacity-90">
              {saving ? "Saving…" : "Save Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}