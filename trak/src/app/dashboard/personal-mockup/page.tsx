"use client";

import { useState } from "react";
import { 
  FileText, Calendar, CheckSquare, Plus, ChevronRight,
  Circle, CheckCircle2, FolderOpen,
  Inbox, StickyNote, Search, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

// Simple personal areas - no progress bars or gamification
const areas = [
  { id: "personal", name: "Personal", count: 12 },
  { id: "work", name: "Work", count: 8 },
  { id: "home", name: "Home", count: 5 },
  { id: "someday", name: "Someday", count: 23 },
];

const todayTasks = [
  { id: 1, text: "Review Q4 budget proposal", done: false, area: "work" },
  { id: 2, text: "Call dentist to reschedule", done: true, area: "personal" },
  { id: 3, text: "Pick up dry cleaning", done: false, area: "home" },
  { id: 4, text: "Send birthday card to mom", done: false, area: "personal" },
  { id: 5, text: "Prepare slides for Monday meeting", done: false, area: "work" },
];

const upcomingEvents = [
  { id: 1, title: "Team standup", time: "9:00 AM", date: "Today" },
  { id: 2, title: "Lunch with Alex", time: "12:30 PM", date: "Today" },
  { id: 3, title: "Dentist", time: "3:00 PM", date: "Tomorrow" },
  { id: 4, title: "Flight to Chicago", time: "7:00 AM", date: "Friday" },
];

const recentNotes = [
  { id: 1, title: "Meeting notes - Product roadmap", updated: "2 hours ago" },
  { id: 2, title: "Book notes: Deep Work", updated: "Yesterday" },
  { id: 3, title: "Ideas for kitchen renovation", updated: "3 days ago" },
];

const projects = [
  { id: 1, title: "Kitchen Renovation", tasks: 8, area: "home" },
  { id: 2, title: "Learn Photography", tasks: 12, area: "personal" },
  { id: 3, title: "Q4 Planning", tasks: 6, area: "work" },
  { id: 4, title: "Japan Trip Research", tasks: 15, area: "someday" },
];

export default function PersonalMockup() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const completedToday = todayTasks.filter(t => t.done).length;

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-[var(--border)] bg-[var(--background)] flex flex-col">
        {/* User */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-[2px] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] text-sm font-medium">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">Amna Ahmad</p>
              <p className="text-xs text-[var(--muted-foreground)]">Personal</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-[2px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
            <Search className="h-4 w-4" />
            <span>Search...</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <a href="#" className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm bg-[var(--primary)]/10 text-[var(--primary)] border-l-2 border-[var(--primary)]">
            <Inbox className="h-4 w-4" />
            <span className="font-medium">Inbox</span>
            <span className="ml-auto text-xs">3</span>
          </a>
          <a href="#" className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <CheckSquare className="h-4 w-4" />
            <span>Today</span>
            <span className="ml-auto text-xs">{todayTasks.length - completedToday}</span>
          </a>
          <a href="#" className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <Calendar className="h-4 w-4" />
            <span>Upcoming</span>
          </a>
          <a href="#" className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <StickyNote className="h-4 w-4" />
            <span>Notes</span>
          </a>

          {/* Areas */}
          <div className="pt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-[var(--tertiary-foreground)] uppercase tracking-wide">Areas</span>
              <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {areas.map((area) => (
              <button
                key={area.id}
                onClick={() => setSelectedArea(selectedArea === area.id ? null : area.id)}
                className={cn(
                  "flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm w-full text-left",
                  selectedArea === area.id
                    ? "bg-[var(--surface-hover)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                )}
              >
                <FolderOpen className="h-4 w-4" />
                <span>{area.name}</span>
                <span className="ml-auto text-xs">{area.count}</span>
              </button>
            ))}
          </div>

          {/* Projects */}
          <div className="pt-4">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-[var(--tertiary-foreground)] uppercase tracking-wide">Projects</span>
              <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {projects.slice(0, 3).map((project) => (
              <a
                key={project.id}
                href="#"
                className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                <span className="truncate">{project.title}</span>
              </a>
            ))}
            <button className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] w-full">
              <span>View all projects</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </nav>

        {/* Settings */}
        <div className="p-3 border-t border-[var(--border)]">
          <a href="#" className="flex items-center gap-3 rounded-[2px] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-8 py-5">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">{formattedDate}</h1>
        </header>

        <div className="p-8 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Column - Tasks */}
            <div className="lg:col-span-3 space-y-6">
              {/* Today's Tasks */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-[var(--foreground)] uppercase tracking-wide">Today</h2>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {completedToday} of {todayTasks.length} done
                  </span>
                </div>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                  {todayTasks.map((task) => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <button className="flex-shrink-0">
                        {task.done ? (
                          <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                        ) : (
                          <Circle className="h-5 w-5 text-[var(--border-strong)]" />
                        )}
                      </button>
                      <span className={cn(
                        "flex-1 text-sm",
                        task.done && "text-[var(--muted-foreground)] line-through"
                      )}>
                        {task.text}
                      </span>
                      <span className="text-xs text-[var(--tertiary-foreground)] capitalize">
                        {task.area}
                      </span>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <button className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </div>
                </div>
              </section>

              {/* Recent Notes */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-[var(--foreground)] uppercase tracking-wide">Recent Notes</h2>
                  <button className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1">
                    View all <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {recentNotes.map((note) => (
                    <div 
                      key={note.id}
                      className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
                        <span className="flex-1 text-sm text-[var(--foreground)]">{note.title}</span>
                        <span className="text-xs text-[var(--tertiary-foreground)]">{note.updated}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column - Calendar & Quick Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Upcoming */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-[var(--foreground)] uppercase tracking-wide">Upcoming</h2>
                </div>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                  {upcomingEvents.map((event) => (
                    <div 
                      key={event.id}
                      className="px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[var(--foreground)]">{event.title}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">{event.time}</span>
                      </div>
                      <span className="text-xs text-[var(--tertiary-foreground)]">{event.date}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Projects */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-[var(--foreground)] uppercase tracking-wide">Projects</h2>
                  <button className="rounded-[2px] bg-[var(--primary)] px-2.5 py-1 text-xs font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] transition-colors">
                    New
                  </button>
                </div>
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div 
                      key={project.id}
                      className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--foreground)]">{project.title}</span>
                        <span className="text-xs text-[var(--muted-foreground)]">{project.tasks} tasks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Capture */}
              <section>
                <div className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <input 
                    type="text"
                    placeholder="Quick capture... (⌘ + K)"
                    className="w-full bg-transparent text-sm placeholder:text-[var(--tertiary-foreground)] focus:outline-none"
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
