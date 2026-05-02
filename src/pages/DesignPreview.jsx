import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, AlertCircle, Clock, TrendingUp,
  Users, DollarSign, BarChart2, Zap
} from "lucide-react";

const ColorSwatch = ({ label, className, hex }) => (
  <div className="flex flex-col gap-2">
    <div className={`h-16 w-full rounded-lg ${className}`} />
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hex}</p>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, trend, color }) => (
  <Card className="glass hover:shadow-card-hover transition-all duration-300">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {trend && <p className="text-xs text-success mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-foreground" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function DesignPreview() {
  return (
    <div className="min-h-screen bg-background p-8 font-inter">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px] gradient-bg rounded" />
            <span className="text-xs uppercase tracking-[4px] text-muted-foreground">Design System</span>
          </div>
          <h1 className="text-4xl font-black">
            <span className="gradient-text">Marketing iO</span>
            <span className="text-foreground"> CRM</span>
          </h1>
          <p className="text-muted-foreground">Brand colour system preview — Too Good To Stay Hidden.</p>
        </div>

        <Separator className="opacity-20" />

        {/* Colour Palette */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Colour Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <ColorSwatch label="Primary Purple" className="gradient-bg" hex="#7729FF" />
            <ColorSwatch label="Accent Pink" className="bg-accent" hex="#FF2994" />
            <ColorSwatch label="Cyan" className="bg-[#00CCFF]" hex="#00CCFF" />
            <ColorSwatch label="Background" className="bg-background border border-border" hex="#0A0F1C" />
            <ColorSwatch label="Surface" className="bg-card border border-border" hex="#111827" />
            <ColorSwatch label="Surface 2" className="bg-secondary border border-border" hex="#1A2235" />
            <ColorSwatch label="Success" className="bg-success" hex="#22C55E" />
            <ColorSwatch label="Warning" className="bg-warning" hex="#F59E0B" />
            <ColorSwatch label="Destructive" className="bg-destructive" hex="#EF4444" />
            <ColorSwatch label="Muted" className="bg-muted border border-border" hex="rgba" />
            <ColorSwatch label="Border" className="border-2 border-border bg-transparent" hex="purple 20%" />
            <ColorSwatch label="Gradient" className="bg-gradient-brand" hex="Purple→Pink" />
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Typography — Inter</h2>
          <div className="space-y-3">
            <p className="text-5xl font-black gradient-text">Display / Hero</p>
            <p className="text-3xl font-bold text-foreground">Heading 1 — Dashboard Title</p>
            <p className="text-xl font-semibold text-foreground">Heading 2 — Section Title</p>
            <p className="text-base font-medium text-foreground">Body — Regular content text</p>
            <p className="text-sm text-muted-foreground">Small / Muted — Secondary information</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Caption — Labels &amp; Tags</p>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button className="gradient-bg text-white font-semibold hover:opacity-90 glow-purple">
              Primary Action
            </Button>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
              Secondary
            </Button>
            <Button variant="outline" className="border-accent text-accent hover:bg-accent/10">
              Accent Pink
            </Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Ghost
            </Button>
            <Button variant="destructive">
              Destructive
            </Button>
            <Button disabled className="opacity-40">
              Disabled
            </Button>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Status Badges</h2>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-success/15 text-success border border-success/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Active
            </Badge>
            <Badge className="bg-warning/15 text-warning border border-warning/30">
              <Clock className="w-3 h-3 mr-1" /> Pending
            </Badge>
            <Badge className="bg-destructive/15 text-destructive border border-destructive/30">
              <AlertCircle className="w-3 h-3 mr-1" /> Failed
            </Badge>
            <Badge className="bg-primary/15 text-primary border border-primary/30">
              <Zap className="w-3 h-3 mr-1" /> New Lead
            </Badge>
            <Badge className="bg-accent/15 text-accent border border-accent/30">
              Closed Won
            </Badge>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Cards — Stat preview */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Stat Cards (Dashboard Preview)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label="Total Clients"
              value="128"
              trend="↑ 12% this month"
              color="bg-primary/20"
            />
            <StatCard
              icon={DollarSign}
              label="Monthly Revenue"
              value="R94,200"
              trend="↑ 8% vs last month"
              color="bg-accent/20"
            />
            <StatCard
              icon={TrendingUp}
              label="Active Deals"
              value="34"
              trend="↑ 5 new this week"
              color="bg-[#00CCFF]/20"
            />
            <StatCard
              icon={BarChart2}
              label="Commissions Due"
              value="R3,480"
              trend="3 agents pending"
              color="bg-success/20"
            />
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Glass card example */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground">Glass Card / Panel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass shadow-card">
              <CardHeader>
                <CardTitle className="gradient-text text-base">Deal Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["New Lead", "Qualified", "Proposal Sent", "Closed Won"].map((stage, i) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{stage}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full gradient-bg"
                        style={{ width: `${[80, 60, 40, 20][i]}px` }}
                      />
                      <span className="text-xs text-muted-foreground">{[12, 8, 5, 3][i]}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass shadow-card">
              <CardHeader>
                <CardTitle className="gradient-text text-base">Onboarding Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Setup fee paid", done: true },
                  { label: "Onboarding form returned", done: true },
                  { label: "Debit mandate signed", done: false },
                  { label: "Brand assets received", done: false },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-3">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${done ? "text-success" : "text-muted-foreground/30"}`}
                    />
                    <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer tag */}
        <div className="text-center pb-8">
          <p className="text-xs italic text-muted-foreground/50">
            Too Good To Stay <span className="blur-sm">Hidden</span>.
          </p>
        </div>

      </div>
    </div>
  );
}