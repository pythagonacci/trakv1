"use client";

import { useState } from "react";
import { CheckCircle2, Droplets, Camera, FlaskConical, Megaphone } from "lucide-react";
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
  { id: "formulation", label: "Formulation" },
  { id: "shades", label: "Shade Development" },
  { id: "creative", label: "Creative & Content" },
  { id: "influencers", label: "Influencer Seeding" },
  { id: "production", label: "Production" },
  { id: "launch", label: "Launch Plan" },
  { id: "metrics", label: "Success Metrics" },
] as const;

const SHADES = [
  { name: "Toast", hex: "#C4917A", status: "Approved", description: "Warm nude brown" },
  { name: "Ribbon", hex: "#D4A5A5", status: "Approved", description: "Dusty mauve pink" },
  { name: "Caramel", hex: "#B8826C", status: "In review", description: "Rich caramel nude" },
  { name: "Mocha", hex: "#8B6355", status: "Approved", description: "Deep chocolate brown" },
  { name: "Petal", hex: "#E8C4C4", status: "Testing", description: "Soft pink glaze" },
  { name: "Espresso", hex: "#5C4033", status: "Testing", description: "Dark roast brown" },
] as const;

const FORMULATION_TIMELINE = [
  { date: "Sep 15", milestone: "Initial peptide complex testing", owner: "R&D Team", status: "Complete" },
  { date: "Oct 1", milestone: "Texture refinement (glaze factor)", owner: "Lab Lead", status: "Complete" },
  { date: "Oct 20", milestone: "Stability testing begins", owner: "QA Team", status: "In progress" },
  { date: "Nov 5", milestone: "Dermatologist review & approval", owner: "Medical Affairs", status: "Queued" },
  { date: "Nov 20", milestone: "Final formula lock", owner: "R&D Director", status: "Upcoming" },
] as const;

const CONTENT_CALENDAR = [
  {
    channel: "Instagram Reels",
    concept: "Hailey's morning lip routine with Peptide Lip Shape",
    publish: "Launch Day",
    owner: "Brand Team",
    status: "Scripted",
  },
  {
    channel: "TikTok",
    concept: "'Get ready with me' peptide application technique",
    publish: "Launch +1",
    owner: "Social",
    status: "Storyboarded",
  },
  {
    channel: "YouTube",
    concept: "The science behind our peptide complex",
    publish: "Launch +3",
    owner: "Content",
    status: "In production",
  },
  {
    channel: "Email",
    concept: "VIP early access + BTS development story",
    publish: "Launch -2",
    owner: "Lifecycle",
    status: "Copy approved",
  },
] as const;

const INFLUENCER_TIERS = [
  { tier: "A-List Talent", count: 8, status: "Confirmed", examples: "Kendall, Bella, Rosie" },
  { tier: "Beauty Editors", count: 15, status: "Outreach", examples: "Allure, Vogue, Glamour" },
  { tier: "Skincare TikTok", count: 50, status: "Shortlisting", examples: "Hyram, Dr. Dray, Susan Yara" },
  { tier: "Micro-Influencers", count: 200, status: "Planning", examples: "Curated clean beauty community" },
] as const;

const TASK_BUCKETS = [
  {
    title: "Formulation",
    iconType: "Flask",
    items: [
      { label: "Peptide complex efficacy studies", status: "Complete" },
      { label: "Glaze finish texture optimization", status: "In progress" },
      { label: "Fragrance-free certification", status: "Upcoming" },
    ],
  },
  {
    title: "Creative",
    iconType: "Camera",
    items: [
      { label: "Campaign concept deck approval", status: "Complete" },
      { label: "Product photography (hero shots)", status: "In progress" },
      { label: "Launch video edit", status: "Upcoming" },
    ],
  },
  {
    title: "Go-to-Market",
    iconType: "Megaphone",
    items: [
      { label: "Sephora exclusive window negotiation", status: "Complete" },
      { label: "PR seeding kit design", status: "In progress" },
      { label: "Waitlist email sequence", status: "Upcoming" },
    ],
  },
] as const;

// Rhode brand colors
const rhodeColors = {
  cream: "#FDFCFA",
  warmWhite: "#FDF6F0",
  blush: "#F5E6DD",
  nude: "#E8DED8",
  warmGray: "#8A7E79",
  espresso: "#3D3937",
  accent: "#C9A38B",
};

export default function TabContent() {
  const [activeTab, setActiveTab] = useState("overview");

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "Flask": return FlaskConical;
      case "Camera": return Camera;
      case "Megaphone": return Megaphone;
      default: return Droplets;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation - Rhode aesthetic */}
      <div className="border-b border-[#EBE5E0]">
        <div className="flex items-center gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-5 py-3 text-[13px] transition-all ${
                activeTab === tab.id
                  ? "text-[#3D3937] font-medium border-b-2 border-[#3D3937]"
                  : "text-[#A69690] hover:text-[#6B5F5A]"
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
            {/* Hero Stats */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr,1fr]">
              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-[#3D3937]">Launch Snapshot</CardTitle>
                  <CardDescription className="text-xs text-[#A69690]">
                    Everything needed to bring Peptide Lip Shape to the world.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#A69690]">Launch Target</p>
                    <p className="mt-2 text-2xl font-light text-[#3D3937]">Jan 15, 2025</p>
                    <p className="mt-2 text-xs text-[#8A7E79]">Global DTC + Sephora exclusive first 2 weeks.</p>
                  </div>
                  <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#A69690]">Hero Benefit</p>
                    <p className="mt-2 text-lg font-medium text-[#3D3937]">Visible lip plumping in 2 weeks</p>
                    <p className="mt-2 text-xs text-[#8A7E79]">Clinically proven with 4% peptide complex.</p>
                  </div>
                  <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#A69690]">Key Risks</p>
                    <ul className="mt-2 space-y-1 text-xs text-[#8A7E79]">
                      <li>• Peptide sourcing lead time</li>
                      <li>• Shade matching for inclusivity</li>
                      <li>• PR embargo coordination</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-[#3D3937]">Pre-Launch Checklist</CardTitle>
                  <CardDescription className="text-xs text-[#A69690]">
                    Owned by Product Marketing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "Final formula sign-off",
                    "Campaign hero imagery approved",
                    "Influencer kits shipped",
                    "Sephora inventory allocated",
                  ].map((item, idx) => (
                    <div key={item} className="flex items-start gap-3 rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2.5">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 ${idx < 2 ? 'text-[#7D9E8A]' : 'text-[#D4C8C3]'}`} />
                      <p className="text-sm text-[#5D534F]">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Timeline */}
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Development Timeline</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">From concept to counter.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {FORMULATION_TIMELINE.map((item) => (
                  <div key={item.milestone} className="flex items-start gap-4 rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF6F0] text-xs font-medium text-[#8A7E79]">
                      {item.date.split(" ")[1] || item.date}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#3D3937]">{item.milestone}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[#A69690]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF6F0] px-2.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#C9A38B]" /> {item.owner}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
                          item.status === "Complete" ? "bg-[#E8F0EA] text-[#5A7D64]" :
                          item.status === "In progress" ? "bg-[#FDF6F0] text-[#9C7B6E]" :
                          "bg-[#F5F3F0] text-[#8A7E79]"
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
                  <Card key={bucket.title} className="border-[#EBE5E0] bg-white shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-medium text-[#5D534F]">{bucket.title}</CardTitle>
                      <span className="rounded-full border border-[#EBE5E0] bg-[#FDFCFA] p-2 text-[#A69690]">
                        <Icon className="h-4 w-4" />
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {bucket.items.map((item) => (
                        <div key={item.label} className="rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2.5">
                          <p className="text-sm text-[#5D534F]">{item.label}</p>
                          <p className={`mt-1 text-[10px] uppercase tracking-wider ${
                            item.status === "Complete" ? "text-[#7D9E8A]" :
                            item.status === "In progress" ? "text-[#C9A38B]" :
                            "text-[#A69690]"
                          }`}>{item.status}</p>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="w-full text-[#A69690] hover:text-[#6B5F5A] hover:bg-[#FDF6F0]">
                        + Add task
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "formulation" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Peptide Lip Shape Formula</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">
                  Clean, effective, Rhode-approved ingredients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-sm font-medium text-[#3D3937] mb-3">Hero Ingredients</p>
                    <ul className="space-y-2 text-sm text-[#6B5F5A]">
                      <li className="flex items-start gap-2">
                        <Droplets className="h-4 w-4 text-[#C9A38B] mt-0.5" />
                        <div>
                          <span className="font-medium">4% Peptide Complex</span>
                          <p className="text-xs text-[#A69690]">Signals collagen production for natural plumping</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Droplets className="h-4 w-4 text-[#C9A38B] mt-0.5" />
                        <div>
                          <span className="font-medium">Hyaluronic Acid Spheres</span>
                          <p className="text-xs text-[#A69690]">Multi-weight HA for deep hydration</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Droplets className="h-4 w-4 text-[#C9A38B] mt-0.5" />
                        <div>
                          <span className="font-medium">Baobab Oil</span>
                          <p className="text-xs text-[#A69690]">Nourishing omega fatty acids</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <Droplets className="h-4 w-4 text-[#C9A38B] mt-0.5" />
                        <div>
                          <span className="font-medium">Vitamin E</span>
                          <p className="text-xs text-[#A69690]">Antioxidant protection</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-sm font-medium text-[#3D3937] mb-3">Formula Specs</p>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8A7E79]">Texture</span>
                        <span className="text-[#5D534F]">Glazed balm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7E79]">Finish</span>
                        <span className="text-[#5D534F]">Dewy, non-sticky</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7E79]">Scent</span>
                        <span className="text-[#5D534F]">Fragrance-free</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7E79]">Format</span>
                        <span className="text-[#5D534F]">Squeeze tube, 10ml</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7E79]">Shelf life</span>
                        <span className="text-[#5D534F]">24 months unopened</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-4">
                  <p className="text-sm font-medium text-[#3D3937] mb-2">Clean Beauty Standards</p>
                  <div className="flex flex-wrap gap-2">
                    {["Vegan", "Cruelty-free", "Gluten-free", "Paraben-free", "Sulfate-free", "Dermatologist tested"].map((badge) => (
                      <span key={badge} className="rounded-full bg-[#E8F0EA] px-3 py-1 text-xs text-[#5A7D64]">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Clinical Results</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">
                  12-week consumer study, n=50.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                {[
                  { stat: "94%", label: "saw visibly plumper lips" },
                  { stat: "97%", label: "felt immediate hydration" },
                  { stat: "89%", label: "noticed improved texture" },
                  { stat: "96%", label: "would recommend to a friend" },
                ].map((result) => (
                  <div key={result.label} className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4 text-center">
                    <p className="text-3xl font-light text-[#3D3937]">{result.stat}</p>
                    <p className="mt-2 text-xs text-[#8A7E79]">{result.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "shades" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Shade Range</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">
                  6 universally flattering tinted glazes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SHADES.map((shade) => (
                    <div key={shade.name} className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] p-4">
                      <div className="flex items-start gap-4">
                        <div 
                          className="h-16 w-16 rounded-xl shadow-sm"
                          style={{ backgroundColor: shade.hex }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#3D3937]">{shade.name}</p>
                          <p className="text-xs text-[#8A7E79]">{shade.description}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-[#A69690]">{shade.hex}</p>
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${
                            shade.status === "Approved" ? "bg-[#E8F0EA] text-[#5A7D64]" :
                            shade.status === "In review" ? "bg-[#FDF6F0] text-[#9C7B6E]" :
                            "bg-[#F5F3F0] text-[#8A7E79]"
                          }`}>
                            {shade.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Shade Development Notes</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">
                  From the color development team.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                  <p className="text-sm text-[#5D534F]">
                    <span className="font-medium">Design philosophy:</span> Every shade is designed to enhance natural lip color, 
                    not mask it. The glazed finish means even the deepest shades feel weightless and fresh.
                  </p>
                </div>
                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                  <p className="text-sm text-[#5D534F]">
                    <span className="font-medium">Inclusive testing:</span> All shades tested across Fitzpatrick skin types I-VI 
                    to ensure universal flattery and accurate undertone representation.
                  </p>
                </div>
                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                  <p className="text-sm text-[#5D534F]">
                    <span className="font-medium">Shade expansion:</span> Q2 2025 planned expansion with 4 additional shades 
                    based on community feedback and sales data from initial launch.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "creative" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Content Calendar</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Launch content rollout plan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {CONTENT_CALENDAR.map((row) => (
                  <div key={row.concept} className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-[#A69690]">
                      <span className="font-medium text-[#5D534F]">{row.channel}</span>
                      <span>{row.publish}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#3D3937]">{row.concept}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#A69690]">
                      <span>Owner: {row.owner}</span>
                      <span className={`rounded-full px-2 py-0.5 ${
                        row.status === "Copy approved" || row.status === "Scripted" ? "bg-[#E8F0EA] text-[#5A7D64]" :
                        "bg-[#FDF6F0] text-[#9C7B6E]"
                      }`}>{row.status}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Campaign Visual Direction</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Creative guidelines for all launch assets.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Photography Style",
                    body: "Natural light, minimal retouching. Focus on texture and 'glazed' finish. Skin-forward, real beauty.",
                    cta: "View moodboard",
                  },
                  {
                    title: "Video Direction",
                    body: "Slow-mo application shots. ASMR-adjacent audio. Clean, white/cream backgrounds with soft shadows.",
                    cta: "Watch treatment",
                  },
                  {
                    title: "Copy Voice",
                    body: "Confident but approachable. Scientific credibility without being clinical. 'Your lips, but better.'",
                    cta: "Style guide",
                  },
                ].map((asset) => (
                  <div key={asset.title} className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                    <p className="text-sm font-medium text-[#3D3937]">{asset.title}</p>
                    <p className="mt-2 text-xs text-[#8A7E79]">{asset.body}</p>
                    <Button variant="outline" size="sm" className="mt-3 w-full rounded-full border-[#E8DED8] text-[#6B5F5A] hover:bg-[#FDF6F0]">
                      {asset.cta}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Asset Checklist</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Required creative deliverables.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {[
                  { category: "Photography", items: ["Hero product shots (all 6 shades)", "Lifestyle imagery", "Before/after lips", "Texture close-ups"] },
                  { category: "Video", items: ["15s social cut", "30s hero spot", "Application tutorial", "BTS content"] },
                  { category: "Design", items: ["Packaging mockups", "Website banners", "Email headers", "Social templates"] },
                  { category: "Copy", items: ["Product descriptions", "Email sequences", "Social captions", "PR press release"] },
                ].map((group) => (
                  <div key={group.category} className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                    <p className="text-sm font-medium text-[#3D3937] mb-2">{group.category}</p>
                    <ul className="space-y-1 text-xs text-[#8A7E79]">
                      {group.items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-[#C9A38B]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "influencers" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Influencer Seeding Strategy</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">
                  Tiered approach to pre-launch buzz.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#EBE5E0]">
                      <TableHead className="text-[#8A7E79]">Tier</TableHead>
                      <TableHead className="text-[#8A7E79]">Target Count</TableHead>
                      <TableHead className="text-[#8A7E79]">Examples</TableHead>
                      <TableHead className="text-[#8A7E79]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {INFLUENCER_TIERS.map((row) => (
                      <TableRow key={row.tier} className="border-[#EBE5E0]">
                        <TableCell className="font-medium text-[#3D3937]">{row.tier}</TableCell>
                        <TableCell className="text-[#6B5F5A]">{row.count}</TableCell>
                        <TableCell className="text-[#8A7E79]">{row.examples}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${
                            row.status === "Confirmed" ? "bg-[#E8F0EA] text-[#5A7D64]" :
                            row.status === "Outreach" ? "bg-[#FDF6F0] text-[#9C7B6E]" :
                            "bg-[#F5F3F0] text-[#8A7E79]"
                          }`}>
                            {row.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-[#3D3937]">PR Seeding Kit</CardTitle>
                  <CardDescription className="text-xs text-[#A69690]">What's inside each kit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "Full shade range (6 products)",
                    "Custom Rhode mirror",
                    "Peptide science explainer card",
                    "Personalized note from Hailey",
                    "Recyclable branded box",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#C9A38B]" />
                      <p className="text-sm text-[#5D534F]">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg font-medium text-[#3D3937]">Posting Guidelines</CardTitle>
                  <CardDescription className="text-xs text-[#A69690]">Briefing notes for creators.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2.5">
                    <p className="text-xs font-medium text-[#3D3937]">Embargo Date</p>
                    <p className="text-sm text-[#6B5F5A]">January 15, 2025 at 9am EST</p>
                  </div>
                  <div className="rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2.5">
                    <p className="text-xs font-medium text-[#3D3937]">Required Tags</p>
                    <p className="text-sm text-[#6B5F5A]">@rhode #peptidelipshape #rhodepartner</p>
                  </div>
                  <div className="rounded-lg border border-[#EBE5E0] bg-[#FDFCFA] px-3 py-2.5">
                    <p className="text-xs font-medium text-[#3D3937]">Key Messages</p>
                    <p className="text-sm text-[#6B5F5A]">Focus on peptide plumping, glazed finish, shade versatility</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "production" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Production Schedule</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Manufacturing timeline and inventory planning.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#EBE5E0]">
                      <TableHead className="text-[#8A7E79]">SKU</TableHead>
                      <TableHead className="text-[#8A7E79]">Initial Run</TableHead>
                      <TableHead className="text-[#8A7E79]">Ship Date</TableHead>
                      <TableHead className="text-[#8A7E79]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SHADES.map((shade) => (
                      <TableRow key={shade.name} className="border-[#EBE5E0]">
                        <TableCell className="font-medium text-[#3D3937]">
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: shade.hex }} />
                            {shade.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-[#6B5F5A]">25,000 units</TableCell>
                        <TableCell className="text-[#6B5F5A]">Jan 5, 2025</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${
                            shade.status === "Approved" ? "bg-[#E8F0EA] text-[#5A7D64]" :
                            "bg-[#FDF6F0] text-[#9C7B6E]"
                          }`}>
                            {shade.status === "Approved" ? "In production" : "Pending"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-[#5D534F]">Total Initial Run</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-light text-[#3D3937]">150,000</p>
                  <p className="text-xs text-[#8A7E79]">units across 6 shades</p>
                </CardContent>
              </Card>
              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-[#5D534F]">Reorder Point</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-light text-[#3D3937]">40%</p>
                  <p className="text-xs text-[#8A7E79]">inventory threshold for reorder</p>
                </CardContent>
              </Card>
              <Card className="border-[#EBE5E0] bg-white shadow-none">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-sm font-medium text-[#5D534F]">Lead Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-light text-[#3D3937]">6 weeks</p>
                  <p className="text-xs text-[#8A7E79]">from order to warehouse</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "launch" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Launch Day Playbook</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Hour-by-hour execution plan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { time: "6:00 AM", action: "Website goes live (soft launch)", owner: "Engineering" },
                  { time: "8:00 AM", action: "Email blast to waitlist (250K subscribers)", owner: "Lifecycle" },
                  { time: "9:00 AM", action: "Social embargo lifts - all influencers post", owner: "Influencer Team" },
                  { time: "9:15 AM", action: "Hailey's Instagram post goes live", owner: "Brand" },
                  { time: "10:00 AM", action: "Sephora.com and in-store availability", owner: "Retail" },
                  { time: "12:00 PM", action: "TikTok LIVE with Hailey", owner: "Social" },
                  { time: "6:00 PM", action: "Day 1 recap + restock alerts if needed", owner: "Ops" },
                ].map((item) => (
                  <div key={item.time} className="flex items-start gap-4 rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                    <div className="flex h-10 min-w-[60px] items-center justify-center rounded-full bg-[#FDF6F0] text-xs font-medium text-[#8A7E79]">
                      {item.time}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#3D3937]">{item.action}</p>
                      <p className="mt-1 text-[11px] text-[#A69690]">Owner: {item.owner}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Retail Distribution</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Channel launch strategy.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                  <p className="text-sm font-medium text-[#3D3937] mb-2">Week 1-2: Exclusive</p>
                  <ul className="space-y-1 text-xs text-[#8A7E79]">
                    <li>• Rhode DTC (rhodeskin.com)</li>
                    <li>• Sephora (online + 500 stores)</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4">
                  <p className="text-sm font-medium text-[#3D3937] mb-2">Week 3+: Expanded</p>
                  <ul className="space-y-1 text-xs text-[#8A7E79]">
                    <li>• Ulta Beauty rollout</li>
                    <li>• International markets (UK, EU, AU)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "metrics" && (
          <div className="space-y-6">
            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Success Metrics</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">KPIs we're tracking for the first 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { metric: "Revenue Target", value: "$5M", description: "First 30 days" },
                  { metric: "Units Sold", value: "75K", description: "First 30 days" },
                  { metric: "Waitlist Conversion", value: "15%", description: "Target rate" },
                  { metric: "Social Impressions", value: "500M", description: "Launch week" },
                ].map((item) => (
                  <div key={item.metric} className="rounded-xl border border-[#EBE5E0] bg-gradient-to-br from-[#FDF6F0] to-white px-4 py-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#A69690]">{item.metric}</p>
                    <p className="mt-2 text-3xl font-light text-[#3D3937]">{item.value}</p>
                    <p className="mt-1 text-xs text-[#8A7E79]">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Tracking Dashboard</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Real-time metrics post-launch.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-4">
                  <p className="text-sm font-medium text-[#3D3937] mb-3">Sales Metrics</p>
                  <ul className="space-y-2 text-xs text-[#6B5F5A]">
                    <li className="flex justify-between">
                      <span>Gross revenue</span>
                      <span className="font-medium">Real-time</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Units sold by shade</span>
                      <span className="font-medium">Hourly</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Average order value</span>
                      <span className="font-medium">Daily</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Conversion rate</span>
                      <span className="font-medium">Daily</span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-4">
                  <p className="text-sm font-medium text-[#3D3937] mb-3">Social Metrics</p>
                  <ul className="space-y-2 text-xs text-[#6B5F5A]">
                    <li className="flex justify-between">
                      <span>Total impressions</span>
                      <span className="font-medium">Real-time</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Engagement rate</span>
                      <span className="font-medium">Daily</span>
                    </li>
                    <li className="flex justify-between">
                      <span>UGC volume</span>
                      <span className="font-medium">Daily</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Sentiment analysis</span>
                      <span className="font-medium">Weekly</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#EBE5E0] bg-white shadow-none">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-medium text-[#3D3937]">Post-Launch Review Cadence</CardTitle>
                <CardDescription className="text-xs text-[#A69690]">Scheduled check-ins.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { timing: "Day 1", focus: "Real-time war room - sales velocity, site performance, social sentiment" },
                  { timing: "Day 7", focus: "First week recap - top performing channels, shade sell-through, restock triggers" },
                  { timing: "Day 30", focus: "Full launch debrief - P&L review, learnings document, Q2 planning" },
                ].map((review) => (
                  <div key={review.timing} className="flex items-start gap-4 rounded-xl border border-[#EBE5E0] bg-[#FDFCFA] px-4 py-3">
                    <div className="flex h-10 min-w-[60px] items-center justify-center rounded-full bg-[#FDF6F0] text-xs font-medium text-[#8A7E79]">
                      {review.timing}
                    </div>
                    <p className="text-sm text-[#5D534F] pt-2">{review.focus}</p>
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

