"use client";

import { useState } from "react";
import { CheckCircle2, Instagram, Package, Target, Timer } from "lucide-react";
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

// Move all static data outside component for better performance
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "production", label: "Production Schedule" },
  { id: "marketing", label: "Marketing Assets" },
  { id: "packaging", label: "Packaging" },
  { id: "distribution", label: "Distribution" },
  { id: "budget", label: "Budget & Costs" },
  { id: "team", label: "Team & Responsibilities" },
  { id: "quality", label: "Quality Control" },
  { id: "metrics", label: "Launch Metrics" },
] as const;

const PRODUCTION_RUN = [
  { sku: "Classic Buckeye", qty: "2,400 boxes", ship: "Dec 8", status: "Locked" },
  { sku: "Peppermint Buckeye", qty: "1,600 boxes", ship: "Dec 9", status: "Packaging art in review" },
  { sku: "Mocha Crunch", qty: "1,200 boxes", ship: "Dec 10", status: "Waiting on ingredient delivery" },
  { sku: "Salted Caramel Buckeye", qty: "2,000 boxes", ship: "Dec 11", status: "Recipe testing" },
] as const;

const LAUNCH_TIMELINE = [
  { date: "Nov 18", milestone: "Finalize flavor lineup & recipe tweaks", owner: "Maria (Ops)", status: "Complete" },
  { date: "Nov 25", milestone: "Shoot hero product photography", owner: "Dev (Creative)", status: "In progress" },
  { date: "Dec 2", milestone: "Schedule Klaviyo flows + SMS", owner: "Fiona (Lifecycle)", status: "Queued" },
  { date: "Dec 5", milestone: "Influencer seeding kits shipped", owner: "Logan (Growth)", status: "On track" },
  { date: "Dec 12", milestone: "Launch day livestream + giveaways", owner: "All-hands", status: "Upcoming" },
] as const;

const CONTENT_CALENDAR = [
  {
    channel: "Instagram Reels",
    concept: "Behind-the-scenes: dipping buckeyes",
    publish: "Nov 27",
    owner: "Dev",
    status: "Editing",
  },
  {
    channel: "TikTok",
    concept: "Holiday countdown day 10",
    publish: "Nov 28",
    owner: "Maya",
    status: "Drafting",
  },
  {
    channel: "Email",
    concept: "VIP early access (with bundle upsell)",
    publish: "Dec 11",
    owner: "Fiona",
    status: "Approved",
  },
  {
    channel: "Instagram Stories",
    concept: "Day-of launch countdown",
    publish: "Dec 12",
    owner: "Dev",
    status: "Scheduled",
  },
] as const;

const TASK_BUCKETS = [
  {
    title: "Recipe & Production",
    iconType: "Package",
    items: [
      { label: "Lock final ingredient suppliers", status: "Complete" },
      { label: "Confirm allergen statements for Peppermint batch", status: "In progress" },
      { label: "QA taste test with loyal customers", status: "Upcoming" },
    ],
  },
  {
    title: "Marketing",
    iconType: "Target",
    items: [
      { label: "Holiday landing page refresh", status: "Complete" },
      { label: "Paid social creatives (carousel + UGC)", status: "In progress" },
      { label: "Influencer giveaway partnerships", status: "Upcoming" },
    ],
  },
  {
    title: "Launch Day Ops",
    iconType: "Timer",
    items: [
      { label: "Staffing schedule for packaging line", status: "Locked" },
      { label: "Allocate 200 boxes for VIP overnight ship", status: "In progress" },
      { label: "Set up live chat macros", status: "Upcoming" },
    ],
  },
] as const;

export default function TabContent() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-[var(--foreground)] border-b-2 border-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr,1fr]">
              <Card className="border-[var(--border)]">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Launch Snapshot</CardTitle>
                  <CardDescription className="text-xs text-[var(--muted-foreground)]">
                    What Buckeye Brownies needs ready before the holiday drop goes live.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Target sell-through</p>
                    <p className="mt-1 text-xl font-semibold">92% in 72 hrs</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">Stretch goal: fully sold out before Christmas shipping cut-off.</p>
                  </div>
                  <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Key audiences</p>
                    <p className="mt-1 text-sm font-medium">VIP email list, TikTok holiday shoppers, Columbus locals</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">VIP early access unlocks 24 hrs before general sale.</p>
                  </div>
                  <div className="rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Critical risks</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      <li>• Peppermint drizzle supplier shipping delay.</li>
                      <li>• Overnight shipping slots fill by Dec 11.</li>
                      <li>• Influencer kits must arrive before the 8th.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[var(--border)]">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Launch Day Checklist</CardTitle>
                  <CardDescription className="text-xs text-[var(--muted-foreground)]">
                    Snapshot owned by Logan (Growth Lead).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "SMS ready to send at 10:00am EST",
                    "IG Reel scheduled + pinned",
                    "Inventory buffer confirmed with Ops",
                    "Giveaway winners queue prepared",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                      <p className="text-xs text-[var(--foreground)]">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Launch Timeline</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Shared with fulfillment, growth, and customer experience.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {LAUNCH_TIMELINE.map((item) => (
                  <div key={item.milestone} className="flex items-start gap-3 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[var(--surface-hover)] text-xs font-semibold text-[var(--foreground)]">
                      {item.date.split(" ")[1] || item.date}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">{item.milestone}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--muted-foreground)]">
                        <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--surface-hover)] px-2 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" /> Owner: {item.owner}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] px-2 py-0.5">
                          Status: {item.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {TASK_BUCKETS.map((bucket) => {
                const Icon = bucket.iconType === "Package" ? Package : bucket.iconType === "Target" ? Target : Timer;
                return (
                <Card key={bucket.title} className="border-[var(--border)]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium text-[var(--foreground)]">{bucket.title}</CardTitle>
                    <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--muted-foreground)]">
                      <Icon className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bucket.items.map((item) => (
                      <div key={item.label} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                        <p className="text-sm text-[var(--foreground)]">{item.label}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">{item.status}</p>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="w-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      + Add task
                    </Button>
                  </CardContent>
                </Card>
              )})}
            </div>
          </div>
        )}

        {activeTab === "production" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Production Run</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Coordinated with the Columbus kitchen.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Batch Size</TableHead>
                      <TableHead>Ship Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PRODUCTION_RUN.map((row) => (
                      <TableRow key={row.sku}>
                        <TableCell className="font-medium text-[var(--foreground)]">{row.sku}</TableCell>
                        <TableCell>{row.qty}</TableCell>
                        <TableCell>{row.ship}</TableCell>
                        <TableCell>
                          <span className="rounded-[999px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                            {row.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="border-[var(--border)]">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Week-by-Week Schedule</CardTitle>
                  <CardDescription className="text-xs text-[var(--muted-foreground)]">Production timeline breakdown</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Week 1-2: Recipe Development</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      <li>• Test base brownie recipe</li>
                      <li>• Develop buckeye filling consistency</li>
                      <li>• Flavor profile testing</li>
                      <li>• Shelf life testing</li>
                    </ul>
                  </div>
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Week 3-4: Production Setup</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      <li>• Equipment calibration</li>
                      <li>• Staff training</li>
                      <li>• Quality control protocols</li>
                      <li>• Packaging line setup</li>
                    </ul>
                  </div>
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">Week 5-6: Pre-Launch Production</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--muted-foreground)]">
                      <li>• Small batch production runs</li>
                      <li>• Quality assurance testing</li>
                      <li>• Inventory management setup</li>
                      <li>• Distribution coordination</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[var(--border)]">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">Production Tasks</CardTitle>
                  <CardDescription className="text-xs text-[var(--muted-foreground)]">Active production checklist</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { task: "Order ingredients in bulk", status: "Complete" },
                    { task: "Schedule production staff", status: "In progress" },
                    { task: "Set up quality control checkpoints", status: "In progress" },
                    { task: "Coordinate with packaging team", status: "Upcoming" },
                    { task: "Run test batches", status: "Upcoming" },
                  ].map((item) => (
                    <div key={item.task} className="flex items-start gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      {item.status === "Complete" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                      ) : (
                        <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-[var(--border)]" />
                      )}
                      <div className="flex-1">
                        <p className="text-xs text-[var(--foreground)]">{item.task}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--tertiary-foreground)]">{item.status}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "marketing" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Content Calendar</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Owned by the Creative Pod.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {CONTENT_CALENDAR.map((row) => (
                  <div key={row.concept} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                      <span className="font-medium text-[var(--foreground)]">{row.channel}</span>
                      <span>{row.publish}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{row.concept}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--tertiary-foreground)]">
                      <span>Owner: {row.owner}</span>
                      <span>{row.status}</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full">Open content board</Button>
              </CardContent>
            </Card>

            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Social Launch Kit</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Assets prepared for partners & loyal customers to repost.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "Influencer dropbox",
                    body: "Zip file with product shots, story frames, and SKU breakdowns.",
                    cta: "Open folder",
                  },
                  {
                    title: "Creator talking points",
                    body: "Key flavor notes, allergy info, and launch mechanics for live streams.",
                    cta: "View doc",
                  },
                  {
                    title: "Holiday soundtrack",
                    body: "Licensed audio bed used across reels + TikTok countdown series.",
                    cta: "Play playlist",
                  },
                ].map((asset) => (
                  <div key={asset.title} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-sm font-medium text-[var(--foreground)]">{asset.title}</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">{asset.body}</p>
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      {asset.cta}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Required Marketing Materials</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Checklist of all marketing assets needed</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Photography</p>
                  <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <li>• Product shots (hero images)</li>
                    <li>• Lifestyle photography</li>
                    <li>• Behind-the-scenes content</li>
                    <li>• Social media assets</li>
                  </ul>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Copy</p>
                  <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <li>• Product descriptions</li>
                    <li>• Website content</li>
                    <li>• Social media captions</li>
                    <li>• Email marketing copy</li>
                  </ul>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Design</p>
                  <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <li>• Packaging design</li>
                    <li>• Website graphics</li>
                    <li>• Social media templates</li>
                    <li>• Print materials</li>
                  </ul>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Links</p>
                  <div className="space-y-2">
                    <a href="https://www.instagram.com/buckeyebrownies" className="flex items-center gap-2 text-xs text-[var(--info)] hover:underline">
                      <Instagram className="h-3.5 w-3.5" />
                      Buckeye Brownies Instagram
                    </a>
                    <p className="text-xs text-[var(--muted-foreground)]">Follow us for behind-the-scenes content and updates</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "packaging" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Packaging Requirements</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Design specifications and timeline</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Design Specifications</p>
                  <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <li>• Eco-friendly materials</li>
                    <li>• Window for product visibility</li>
                    <li>• Brand logo prominently displayed</li>
                    <li>• Nutritional information panel</li>
                    <li>• Barcode placement</li>
                  </ul>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Timeline</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">Design approval</span>
                      <span className="font-medium text-[var(--foreground)]">Nov 15</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">Print production</span>
                      <span className="font-medium text-[var(--foreground)]">Nov 20</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">Delivery</span>
                      <span className="font-medium text-[var(--foreground)]">Nov 25</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">Assembly</span>
                      <span className="font-medium text-[var(--foreground)]">Nov 28</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "distribution" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Distribution Partners</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Retail and online distribution channels</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Retailer</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Order Qty</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { retailer: "Whole Foods", location: "Regional", qty: "500 boxes", status: "Confirmed" },
                      { retailer: "Local Markets", location: "Various", qty: "300 boxes", status: "Pending" },
                      { retailer: "Online Store", location: "N/A", qty: "1,000 boxes", status: "Live" },
                      { retailer: "Farmers Markets", location: "Columbus Area", qty: "200 boxes", status: "Confirmed" },
                    ].map((row) => (
                      <TableRow key={row.retailer}>
                        <TableCell className="font-medium text-[var(--foreground)]">{row.retailer}</TableCell>
                        <TableCell>{row.location}</TableCell>
                        <TableCell>{row.qty}</TableCell>
                        <TableCell>
                          <span className="rounded-[999px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                            {row.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "budget" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Budget Breakdown</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Financial overview and tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Budgeted</TableHead>
                      <TableHead>Spent</TableHead>
                      <TableHead>Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { category: "Ingredients", budgeted: "$25,000", spent: "$12,500", remaining: "$12,500" },
                      { category: "Packaging", budgeted: "$15,000", spent: "$8,200", remaining: "$6,800" },
                      { category: "Marketing", budgeted: "$20,000", spent: "$5,000", remaining: "$15,000" },
                      { category: "Distribution", budgeted: "$10,000", spent: "$2,500", remaining: "$7,500" },
                      { category: "Labor", budgeted: "$18,000", spent: "$9,000", remaining: "$9,000" },
                    ].map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium text-[var(--foreground)]">{row.category}</TableCell>
                        <TableCell>{row.budgeted}</TableCell>
                        <TableCell>{row.spent}</TableCell>
                        <TableCell>{row.remaining}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Budget Summary</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Overall financial status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Total Budget</p>
                    <p className="mt-1 text-xl font-semibold">$88,000</p>
                  </div>
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Total Spent</p>
                    <p className="mt-1 text-xl font-semibold">$37,200</p>
                  </div>
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">Remaining</p>
                    <p className="mt-1 text-xl font-semibold">$50,800</p>
                  </div>
                </div>
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <p className="text-sm font-medium text-[var(--foreground)] mb-2">Notes</p>
                  <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                    <li>• Ingredients costs are on track</li>
                    <li>• Packaging slightly over budget due to premium materials</li>
                    <li>• Marketing spend is conservative, room for expansion</li>
                    <li>• Distribution costs lower than expected</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "team" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Team & Responsibilities</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Project team members and their roles</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[
                  { name: "Maria", role: "Operations Lead", department: "Ops", tasks: ["Production coordination", "Supplier management", "Quality control"] },
                  { name: "Dev", role: "Creative Director", department: "Creative", tasks: ["Photography", "Design assets", "Content creation"] },
                  { name: "Fiona", role: "Lifecycle Marketing", department: "Marketing", tasks: ["Email campaigns", "SMS flows", "Customer journey"] },
                  { name: "Logan", role: "Growth Lead", department: "Growth", tasks: ["Launch strategy", "Influencer partnerships", "Social media"] },
                  { name: "Maya", role: "Content Creator", department: "Creative", tasks: ["TikTok content", "Reels production", "Social posts"] },
                ].map((member) => (
                  <div key={member.name} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{member.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{member.role}</p>
                      </div>
                      <span className="rounded-[4px] bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)]">
                        {member.department}
                      </span>
                    </div>
                    <ul className="space-y-1 text-xs text-[var(--muted-foreground)]">
                      {member.tasks.map((task, idx) => (
                        <li key={idx}>• {task}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "quality" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Quality Control Checklist</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">QA protocols and testing procedures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { item: "Ingredient quality inspection", status: "Complete", owner: "Maria" },
                  { item: "Recipe consistency testing", status: "In progress", owner: "Maria" },
                  { item: "Allergen statement verification", status: "In progress", owner: "Maria" },
                  { item: "Shelf life testing", status: "Upcoming", owner: "QA Team" },
                  { item: "Packaging integrity test", status: "Upcoming", owner: "QA Team" },
                  { item: "Customer taste test panel", status: "Upcoming", owner: "Logan" },
                ].map((item) => (
                  <div key={item.item} className="flex items-start gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    {item.status === "Complete" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--success)]" />
                    ) : (
                      <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-[var(--border)]" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-[var(--foreground)]">{item.item}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                        <span>{item.status}</span>
                        <span>•</span>
                        <span>Owner: {item.owner}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Launch Metrics</CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)]">Real-time dashboard for the first 72 hours after go-live.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { metric: "Site sessions", value: "18,240", description: "Unique visitors to launch page" },
                  { metric: "Conversion rate", value: "4.6%", description: "Visitors who completed purchase" },
                  { metric: "Average order value", value: "$42.10", description: "Mean transaction amount" },
                  { metric: "Repeat purchase window", value: "16 days", description: "Average time to second order" },
                ].map((item) => (
                  <div key={item.metric} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--tertiary-foreground)]">{item.metric}</p>
                    <p className="mt-1 text-xl font-semibold">{item.value}</p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

