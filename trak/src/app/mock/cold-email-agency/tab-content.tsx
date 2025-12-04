"use client";

import { useState } from "react";
import { CheckCircle2, Mail, Users, Target, BarChart3, Clock, AlertTriangle, TrendingUp, Send, Inbox, MousePointerClick, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sequences", label: "Sequences" },
  { id: "leads", label: "Lead Lists" },
  { id: "copy", label: "Email Copy" },
  { id: "deliverability", label: "Deliverability" },
  { id: "ab-tests", label: "A/B Tests" },
  { id: "results", label: "Results & Meetings" },
  { id: "client", label: "Client Updates" },
] as const;

const SEQUENCES = [
  { name: "VP Engineering - Pain Point", leads: 3200, sent: 2850, opened: "62%", replied: "8.4%", status: "Active" },
  { name: "CTO - Case Study", leads: 2800, sent: 2100, opened: "58%", replied: "6.2%", status: "Active" },
  { name: "Director Eng - ROI Focus", leads: 2400, sent: 1800, opened: "55%", replied: "5.8%", status: "Active" },
  { name: "VP Product - Integration", leads: 1800, sent: 900, opened: "48%", replied: "4.1%", status: "Paused" },
  { name: "Founder - Vision Pitch", leads: 1500, sent: 600, opened: "71%", replied: "9.2%", status: "Testing" },
] as const;

const LEAD_LISTS = [
  { name: "Series A-B SaaS (US)", count: 4200, source: "Apollo + LinkedIn", quality: "A", status: "Verified" },
  { name: "Series C+ Enterprise", count: 3100, source: "ZoomInfo", quality: "A", status: "Verified" },
  { name: "VC-Backed Tech (EU)", count: 2800, source: "Crunchbase + Apollo", quality: "B+", status: "Cleaning" },
  { name: "Fast-Growing Startups", count: 2400, source: "LinkedIn Sales Nav", quality: "B", status: "Enriching" },
  { name: "Recent Funding Round", count: 1800, source: "Crunchbase API", quality: "A+", status: "Fresh" },
] as const;

const CAMPAIGN_TIMELINE = [
  { date: "Jan 2", milestone: "Lead list finalized & verified", owner: "Research Team", status: "Complete" },
  { date: "Jan 4", milestone: "Email copy approved by client", owner: "Copy Team", status: "Complete" },
  { date: "Jan 6", milestone: "Domains warmed, sequences launched", owner: "Deliverability", status: "Complete" },
  { date: "Jan 20", milestone: "First A/B test results review", owner: "Strategy", status: "In progress" },
  { date: "Feb 1", milestone: "Mid-campaign optimization", owner: "Account Lead", status: "Upcoming" },
  { date: "Mar 15", milestone: "Final report & renewal discussion", owner: "Account Lead", status: "Upcoming" },
] as const;

const AB_TESTS = [
  {
    name: "Subject Line Test - VP Eng",
    variant_a: "Quick question about [Company] engineering",
    variant_b: "[First Name], saw your team is scaling",
    winner: "B",
    lift: "+23% open rate",
    status: "Concluded",
  },
  {
    name: "CTA Test - CTO Sequence",
    variant_a: "Worth a 15-min call?",
    variant_b: "Open to seeing a 2-min demo video?",
    winner: "A",
    lift: "+18% reply rate",
    status: "Concluded",
  },
  {
    name: "Personalization Depth",
    variant_a: "Company + role only",
    variant_b: "Company + role + recent news",
    winner: "TBD",
    lift: "Testing...",
    status: "Running",
  },
] as const;

const MEETINGS_BOOKED = [
  { company: "DataStream Inc", title: "VP Engineering", date: "Jan 15", source: "Sequence 1", outcome: "Demo scheduled" },
  { company: "CloudNine Tech", title: "CTO", date: "Jan 16", source: "Sequence 2", outcome: "Proposal sent" },
  { company: "ScaleUp Labs", title: "Director of Eng", date: "Jan 18", source: "Sequence 3", outcome: "Discovery call" },
  { company: "Nexus Software", title: "Co-founder", date: "Jan 20", source: "Sequence 5", outcome: "Demo scheduled" },
  { company: "Infinite Loop", title: "VP Engineering", date: "Jan 22", source: "Sequence 1", outcome: "Follow-up pending" },
] as const;

const TASK_BUCKETS = [
  {
    title: "Lead Research",
    iconType: "Users",
    items: [
      { label: "Verify EU GDPR compliance for list", status: "Complete" },
      { label: "Enrich missing LinkedIn URLs", status: "In progress" },
      { label: "Score leads by funding recency", status: "Upcoming" },
    ],
  },
  {
    title: "Copy & Sequences",
    iconType: "Mail",
    items: [
      { label: "Write follow-up 4 for VP Eng", status: "Complete" },
      { label: "Localize copy for EU prospects", status: "In progress" },
      { label: "Create breakup email variant", status: "Upcoming" },
    ],
  },
  {
    title: "Deliverability",
    iconType: "Target",
    items: [
      { label: "Warm new backup domain", status: "Complete" },
      { label: "Monitor inbox placement rates", status: "In progress" },
      { label: "Rotate sending IPs if needed", status: "Upcoming" },
    ],
  },
] as const;

export default function TabContent() {
  const [activeTab, setActiveTab] = useState("overview");

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "Users": return Users;
      case "Mail": return Mail;
      case "Target": return Target;
      default: return Mail;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-3 text-[13px] transition-all ${
                activeTab === tab.id
                  ? "text-white font-medium border-b-2 border-violet-500"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Emails Sent", value: "8,250", change: "+1,200 this week", icon: Send, color: "text-violet-400" },
                { label: "Open Rate", value: "58.3%", change: "Industry avg: 44%", icon: Inbox, color: "text-emerald-400" },
                { label: "Reply Rate", value: "6.8%", change: "+0.4% from last week", icon: Mail, color: "text-cyan-400" },
                { label: "Meetings Booked", value: "23", change: "Target: 40/month", icon: Calendar, color: "text-amber-400" },
              ].map((metric) => (
                <Card key={metric.label} className="border-slate-800 bg-slate-900/50 shadow-none">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-500">{metric.label}</p>
                        <p className="mt-1 text-2xl font-semibold text-white">{metric.value}</p>
                        <p className="mt-1 text-xs text-slate-500">{metric.change}</p>
                      </div>
                      <metric.icon className={`h-5 w-5 ${metric.color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr,1fr]">
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">Campaign Overview</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    TechFlow SaaS Q1 outbound strategy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Target ICP</p>
                    <p className="mt-2 text-sm font-medium text-white">VP Eng, CTO, Director Eng</p>
                    <p className="mt-2 text-xs text-slate-500">100-500 employees, Series A-C, US & EU markets.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Campaign Goal</p>
                    <p className="mt-2 text-sm font-medium text-white">40 qualified meetings/month</p>
                    <p className="mt-2 text-xs text-slate-500">Feeding client's AE team with SQLs for pipeline.</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Key Risks</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      <li className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        Domain reputation on backup
                      </li>
                      <li className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        EU list needs GDPR scrub
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">This Week's Focus</CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Priority items for the team.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { task: "Launch Founder sequence (500 leads)", done: true },
                    { task: "Conclude subject line A/B test", done: true },
                    { task: "Review EU deliverability metrics", done: false },
                    { task: "Client check-in call (Thursday)", done: false },
                  ].map((item) => (
                    <div key={item.task} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.done ? 'text-emerald-400' : 'text-slate-700'}`} />
                      <p className={`text-sm ${item.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{item.task}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Campaign Timeline</CardTitle>
                <CardDescription className="text-xs text-slate-500">Key milestones and deliverables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {CAMPAIGN_TIMELINE.map((item) => (
                  <div key={item.milestone} className="flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-xs font-mono font-medium text-slate-400">
                      {item.date.split(" ")[1] || item.date}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{item.milestone}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">
                          {item.owner}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                          item.status === "Complete" ? "bg-emerald-500/10 text-emerald-400" :
                          item.status === "In progress" ? "bg-violet-500/10 text-violet-400" :
                          "bg-slate-800 text-slate-500"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Task Buckets */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {TASK_BUCKETS.map((bucket) => {
                const Icon = getIcon(bucket.iconType);
                return (
                  <Card key={bucket.title} className="border-slate-800 bg-slate-900/50 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-slate-300">{bucket.title}</CardTitle>
                      <span className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-500">
                        <Icon className="h-4 w-4" />
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bucket.items.map((item) => (
                        <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                          <p className="text-sm text-slate-300">{item.label}</p>
                          <p className={`mt-1 text-[10px] uppercase tracking-wider ${
                            item.status === "Complete" ? "text-emerald-400" :
                            item.status === "In progress" ? "text-violet-400" :
                            "text-slate-600"
                          }`}>{item.status}</p>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="w-full text-slate-600 hover:text-slate-300 hover:bg-slate-800">
                        + Add task
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "sequences" && (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Active Sequences</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  All running email sequences for this campaign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-500">Sequence</TableHead>
                      <TableHead className="text-slate-500">Leads</TableHead>
                      <TableHead className="text-slate-500">Sent</TableHead>
                      <TableHead className="text-slate-500">Open Rate</TableHead>
                      <TableHead className="text-slate-500">Reply Rate</TableHead>
                      <TableHead className="text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SEQUENCES.map((seq) => (
                      <TableRow key={seq.name} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="font-medium text-white">{seq.name}</TableCell>
                        <TableCell className="text-slate-400">{seq.leads.toLocaleString()}</TableCell>
                        <TableCell className="text-slate-400">{seq.sent.toLocaleString()}</TableCell>
                        <TableCell className="text-slate-400">{seq.opened}</TableCell>
                        <TableCell className="text-slate-400">{seq.replied}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                            seq.status === "Active" ? "bg-emerald-500/10 text-emerald-400" :
                            seq.status === "Testing" ? "bg-violet-500/10 text-violet-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>
                            {seq.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">Sequence Structure</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Standard 5-email cadence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { step: 1, timing: "Day 0", type: "Initial outreach", focus: "Pain point hook" },
                    { step: 2, timing: "Day 3", type: "Value add", focus: "Case study / social proof" },
                    { step: 3, timing: "Day 7", type: "Different angle", focus: "ROI / time savings" },
                    { step: 4, timing: "Day 12", type: "Soft bump", focus: "Quick question" },
                    { step: 5, timing: "Day 18", type: "Breakup", focus: "Final attempt + value" },
                  ].map((email) => (
                    <div key={email.step} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-sm font-mono font-bold text-violet-400">
                        {email.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white">{email.type}</p>
                          <span className="text-xs text-slate-500">{email.timing}</span>
                        </div>
                        <p className="text-xs text-slate-500">{email.focus}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">Performance by Step</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Which emails are performing best.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { step: "Email 1", opens: "62%", replies: "3.2%", bar: 62 },
                    { step: "Email 2", opens: "48%", replies: "2.1%", bar: 48 },
                    { step: "Email 3", opens: "41%", replies: "1.8%", bar: 41 },
                    { step: "Email 4", opens: "35%", replies: "0.9%", bar: 35 },
                    { step: "Email 5", opens: "29%", replies: "0.6%", bar: 29 },
                  ].map((perf) => (
                    <div key={perf.step} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{perf.step}</p>
                        <div className="flex gap-4 text-xs">
                          <span className="text-slate-500">Opens: <span className="text-cyan-400">{perf.opens}</span></span>
                          <span className="text-slate-500">Replies: <span className="text-emerald-400">{perf.replies}</span></span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-600 to-cyan-500" style={{ width: `${perf.bar}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Lead Lists</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Segmented prospect lists for this campaign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-500">List Name</TableHead>
                      <TableHead className="text-slate-500">Count</TableHead>
                      <TableHead className="text-slate-500">Source</TableHead>
                      <TableHead className="text-slate-500">Quality</TableHead>
                      <TableHead className="text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {LEAD_LISTS.map((list) => (
                      <TableRow key={list.name} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="font-medium text-white">{list.name}</TableCell>
                        <TableCell className="text-slate-400">{list.count.toLocaleString()}</TableCell>
                        <TableCell className="text-slate-400">{list.source}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-[11px] font-mono font-bold ${
                            list.quality === "A+" ? "bg-emerald-500/10 text-emerald-400" :
                            list.quality === "A" ? "bg-cyan-500/10 text-cyan-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {list.quality}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-[11px] ${
                            list.status === "Verified" ? "bg-emerald-500/10 text-emerald-400" :
                            list.status === "Fresh" ? "bg-violet-500/10 text-violet-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>
                            {list.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-slate-300">Total Prospects</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-white">14,300</p>
                  <p className="text-xs text-slate-500">across all lists</p>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-slate-300">Verification Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-white">94.2%</p>
                  <p className="text-xs text-slate-500">emails verified valid</p>
                </CardContent>
              </Card>
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-slate-300">Avg Enrichment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold text-white">8.4</p>
                  <p className="text-xs text-slate-500">data points per lead</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">ICP Criteria</CardTitle>
                <CardDescription className="text-xs text-slate-500">Targeting parameters for lead sourcing.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                  <p className="text-sm font-medium text-white mb-3">Must-Have Criteria</p>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li>✓ Title: VP Engineering, CTO, Director of Eng</li>
                    <li>✓ Company size: 100-500 employees</li>
                    <li>✓ Funding: Series A through C</li>
                    <li>✓ Industry: B2B SaaS, Tech</li>
                    <li>✓ Geography: US, UK, Germany, France</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                  <p className="text-sm font-medium text-white mb-3">Nice-to-Have Signals</p>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li>+ Recent funding in last 6 months</li>
                    <li>+ Hiring for engineering roles</li>
                    <li>+ Using competitor tools</li>
                    <li>+ Active on LinkedIn</li>
                    <li>+ Previous startup experience</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "copy" && (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Email Templates</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Approved copy for all sequences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-white">VP Engineering - Email 1 (Pain Point)</p>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">62% open rate</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-500"><span className="text-slate-400">Subject:</span> {`{{First Name}}`}, saw your team is scaling</p>
                    <div className="rounded-lg bg-slate-950 p-3 text-slate-400 font-mono text-xs leading-relaxed">
                      <p>Hi {`{{First Name}}`},</p>
                      <p className="mt-2">Noticed {`{{Company}}`} just raised your Series {`{{Funding Round}}`} — congrats! Scaling engineering teams post-funding is exciting but comes with its own headaches.</p>
                      <p className="mt-2">We help companies like {`{{Similar Company}}`} cut their deployment time by 40% without adding headcount.</p>
                      <p className="mt-2">Worth a 15-min call to see if it's relevant for {`{{Company}}`}?</p>
                      <p className="mt-2">Best,<br/>{`{{Sender Name}}`}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-white">CTO - Email 1 (Case Study)</p>
                    <span className="rounded-md bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-400">58% open rate</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-500"><span className="text-slate-400">Subject:</span> Quick question about {`{{Company}}`} engineering</p>
                    <div className="rounded-lg bg-slate-950 p-3 text-slate-400 font-mono text-xs leading-relaxed">
                      <p>Hi {`{{First Name}}`},</p>
                      <p className="mt-2">Just helped {`{{Case Study Company}}`} (similar stage to {`{{Company}}`}) ship 2x faster by streamlining their CI/CD pipeline.</p>
                      <p className="mt-2">Their CTO said it was "the easiest infrastructure decision we've made."</p>
                      <p className="mt-2">Curious if this resonates with what you're seeing at {`{{Company}}`}?</p>
                      <p className="mt-2">Happy to share the case study if useful.</p>
                      <p className="mt-2">—{`{{Sender Name}}`}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Copy Guidelines</CardTitle>
                <CardDescription className="text-xs text-slate-500">Voice and style rules for this client.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                  <p className="text-sm font-medium text-white mb-3">Do's</p>
                  <ul className="space-y-1 text-xs text-slate-400">
                    <li>✓ Keep it under 100 words</li>
                    <li>✓ Personalize with company + funding data</li>
                    <li>✓ One clear CTA per email</li>
                    <li>✓ Sound human, not salesy</li>
                    <li>✓ Use specific numbers and results</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-4">
                  <p className="text-sm font-medium text-white mb-3">Don'ts</p>
                  <ul className="space-y-1 text-xs text-slate-400">
                    <li>✗ No "hope you're doing well"</li>
                    <li>✗ No multiple CTAs or choices</li>
                    <li>✗ No jargon or buzzwords</li>
                    <li>✗ No attachments in cold emails</li>
                    <li>✗ No calendar links in email 1</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "deliverability" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Inbox Placement", value: "94.2%", status: "healthy", target: ">90%" },
                { label: "Bounce Rate", value: "1.8%", status: "healthy", target: "<3%" },
                { label: "Spam Rate", value: "0.2%", status: "healthy", target: "<0.5%" },
                { label: "Domain Health", value: "9.2/10", status: "healthy", target: ">8" },
              ].map((metric) => (
                <Card key={metric.label} className="border-slate-800 bg-slate-900/50 shadow-none">
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-1 text-xs text-emerald-400">Target: {metric.target}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Domain Infrastructure</CardTitle>
                <CardDescription className="text-xs text-slate-500">Sending domains and their health status.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-500">Domain</TableHead>
                      <TableHead className="text-slate-500">Daily Limit</TableHead>
                      <TableHead className="text-slate-500">Sent Today</TableHead>
                      <TableHead className="text-slate-500">Inbox Rate</TableHead>
                      <TableHead className="text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { domain: "outreach.techflow.io", limit: 150, sent: 142, inbox: "96%", status: "Primary" },
                      { domain: "connect.techflow.io", limit: 150, sent: 138, inbox: "94%", status: "Primary" },
                      { domain: "hello.techflow.io", limit: 100, sent: 45, inbox: "91%", status: "Warming" },
                      { domain: "team.techflow.io", limit: 50, sent: 0, inbox: "—", status: "Backup" },
                    ].map((domain) => (
                      <TableRow key={domain.domain} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="font-mono text-sm text-white">{domain.domain}</TableCell>
                        <TableCell className="text-slate-400">{domain.limit}/day</TableCell>
                        <TableCell className="text-slate-400">{domain.sent}</TableCell>
                        <TableCell className="text-slate-400">{domain.inbox}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-[11px] ${
                            domain.status === "Primary" ? "bg-emerald-500/10 text-emerald-400" :
                            domain.status === "Warming" ? "bg-amber-500/10 text-amber-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {domain.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Technical Setup</CardTitle>
                <CardDescription className="text-xs text-slate-500">Authentication and DNS records.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { record: "SPF", status: "Configured", details: "v=spf1 include:_spf.google.com ~all" },
                  { record: "DKIM", status: "Configured", details: "2048-bit key, rotating monthly" },
                  { record: "DMARC", status: "Configured", details: "p=none, monitoring mode" },
                  { record: "Custom tracking domain", status: "Configured", details: "track.techflow.io" },
                ].map((item) => (
                  <div key={item.record} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.record}</p>
                      <p className="text-xs text-slate-500 font-mono">{item.details}</p>
                    </div>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400">
                      {item.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "ab-tests" && (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">A/B Test Results</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Testing and optimization experiments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {AB_TESTS.map((test) => (
                  <div key={test.name} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-white">{test.name}</p>
                      <span className={`rounded-md px-2 py-1 text-[10px] ${
                        test.status === "Concluded" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-violet-500/10 text-violet-400"
                      }`}>
                        {test.status}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className={`rounded-lg border px-3 py-2 ${
                        test.winner === "A" ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800 bg-slate-950"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-400">Variant A</span>
                          {test.winner === "A" && <span className="text-[10px] text-emerald-400">WINNER</span>}
                        </div>
                        <p className="text-sm text-slate-300">{test.variant_a}</p>
                      </div>
                      <div className={`rounded-lg border px-3 py-2 ${
                        test.winner === "B" ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800 bg-slate-950"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-400">Variant B</span>
                          {test.winner === "B" && <span className="text-[10px] text-emerald-400">WINNER</span>}
                        </div>
                        <p className="text-sm text-slate-300">{test.variant_b}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm text-cyan-400">{test.lift}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Upcoming Tests</CardTitle>
                <CardDescription className="text-xs text-slate-500">Planned experiments in the queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { test: "Send time: 8am vs 10am vs 2pm", hypothesis: "Morning sends may have higher open rates for VPs" },
                  { test: "Personalization: Company news vs funding data", hypothesis: "Recent news mentions feel more relevant" },
                  { test: "Email length: 50 words vs 100 words", hypothesis: "Shorter emails may get more replies" },
                ].map((item) => (
                  <div key={item.test} className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
                    <p className="text-sm font-medium text-white">{item.test}</p>
                    <p className="mt-1 text-xs text-slate-500">Hypothesis: {item.hypothesis}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "results" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Total Meetings", value: "23", target: "40 goal", progress: 58 },
                { label: "Positive Replies", value: "156", target: "—", progress: null },
                { label: "Pipeline Generated", value: "$287K", target: "$500K goal", progress: 57 },
                { label: "Cost per Meeting", value: "$127", target: "<$150", progress: null },
              ].map((metric) => (
                <Card key={metric.label} className="border-slate-800 bg-slate-900/50 shadow-none">
                  <CardContent className="pt-4">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{metric.target}</p>
                    {metric.progress && (
                      <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-600 to-cyan-500" style={{ width: `${metric.progress}%` }} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Meetings Booked</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Qualified meetings from this campaign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-500">Company</TableHead>
                      <TableHead className="text-slate-500">Title</TableHead>
                      <TableHead className="text-slate-500">Date</TableHead>
                      <TableHead className="text-slate-500">Source</TableHead>
                      <TableHead className="text-slate-500">Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MEETINGS_BOOKED.map((meeting) => (
                      <TableRow key={meeting.company} className="border-slate-800 hover:bg-slate-800/50">
                        <TableCell className="font-medium text-white">{meeting.company}</TableCell>
                        <TableCell className="text-slate-400">{meeting.title}</TableCell>
                        <TableCell className="text-slate-400">{meeting.date}</TableCell>
                        <TableCell className="text-slate-400">{meeting.source}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-[11px] ${
                            meeting.outcome === "Demo scheduled" ? "bg-emerald-500/10 text-emerald-400" :
                            meeting.outcome === "Proposal sent" ? "bg-cyan-500/10 text-cyan-400" :
                            "bg-slate-800 text-slate-400"
                          }`}>
                            {meeting.outcome}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Funnel Breakdown</CardTitle>
                <CardDescription className="text-xs text-slate-500">Conversion at each stage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { stage: "Emails Sent", count: 8250, pct: "100%" },
                  { stage: "Opened", count: 4814, pct: "58.3%" },
                  { stage: "Replied", count: 561, pct: "6.8%" },
                  { stage: "Positive Reply", count: 156, pct: "1.9%" },
                  { stage: "Meeting Booked", count: 23, pct: "0.28%" },
                ].map((item, idx) => (
                  <div key={item.stage} className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-mono font-bold text-slate-400">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-white">{item.stage}</p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400">{item.count.toLocaleString()}</span>
                          <span className="text-cyan-400 font-mono">{item.pct}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-600 to-cyan-500" 
                          style={{ width: item.pct }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "client" && (
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/50 shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-white">Client Communication Log</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Updates and check-ins with TechFlow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { date: "Jan 20", type: "Weekly call", summary: "Reviewed first 2 weeks. Client happy with open rates. Requested more focus on CTO titles.", action: "Adjust sequence priority" },
                  { date: "Jan 15", type: "Slack update", summary: "Shared first 5 meetings booked. Client AEs confirmed quality is strong.", action: "None" },
                  { date: "Jan 10", type: "Email report", summary: "Sent week 1 metrics. Highlighted subject line test results.", action: "Implement winning variant" },
                  { date: "Jan 6", type: "Kickoff call", summary: "Campaign launched. Walked through sequences and lead lists. Set expectations for ramp.", action: "Begin outreach" },
                ].map((log) => (
                  <div key={log.date} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500">{log.date}</span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{log.type}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">{log.summary}</p>
                    {log.action !== "None" && (
                      <p className="mt-2 text-xs text-violet-400">Action: {log.action}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">Client Details</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Account information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Company</span>
                    <span className="text-white">TechFlow SaaS</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Main Contact</span>
                    <span className="text-white">Sarah Chen (VP Sales)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Contract</span>
                    <span className="text-white">3-month pilot</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Monthly Retainer</span>
                    <span className="text-white">$4,500/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Meeting Target</span>
                    <span className="text-white">40/month</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-800 bg-slate-900/50 shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-white">Next Steps</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Upcoming client deliverables.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { task: "Send week 3 performance report", due: "Jan 27", owner: "Account Lead" },
                    { task: "Mid-campaign strategy call", due: "Feb 1", owner: "Team" },
                    { task: "Propose Q2 expansion", due: "Feb 15", owner: "Account Lead" },
                    { task: "Final report + case study draft", due: "Mar 31", owner: "Account Lead" },
                  ].map((item) => (
                    <div key={item.task} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2.5">
                      <Clock className="mt-0.5 h-4 w-4 text-slate-600" />
                      <div className="flex-1">
                        <p className="text-sm text-slate-300">{item.task}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span>Due: {item.due}</span>
                          <span>•</span>
                          <span>{item.owner}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

