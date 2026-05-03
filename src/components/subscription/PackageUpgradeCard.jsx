import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight } from "lucide-react";

const PACKAGE_TIERS = {
  ignite: {
    name: "Ignite",
    price: "R 2,499",
    setup: "R 5,000",
    description: "Perfect for getting started",
    features: ["Basic social media setup", "Monthly content calendar", "Monthly reporting"],
    color: "bg-blue-500/10 border-blue-500/30",
    icon: "⚡",
  },
  accelerate: {
    name: "Accelerate",
    price: "R 4,999",
    setup: "R 10,000",
    description: "For growing businesses",
    features: ["Everything in Ignite", "Paid ads management", "Video content", "Lead capture setup"],
    color: "bg-purple-500/10 border-purple-500/30",
    icon: "🚀",
  },
  dominate: {
    name: "Dominate",
    price: "R 9,999",
    setup: "R 20,000",
    description: "Complete marketing dominance",
    features: ["Everything in Accelerate", "AI chatbot", "SMS & email automation", "Full video strategy"],
    color: "bg-pink-500/10 border-pink-500/30",
    icon: "👑",
  },
};

export default function PackageUpgradeCard({ currentPackage, onUpgrade }) {
  const [selectedPackage, setSelectedPackage] = useState(null);

  const upgradePath = {
    ignite: ["accelerate", "dominate"],
    accelerate: ["dominate"],
    dominate: [],
  };

  const available = upgradePath[currentPackage] || [];

  if (available.length === 0) {
    return (
      <Card className="glass border-slate-700/40 p-8 text-center">
        <p className="text-foreground font-semibold">You're on our premium package! 👑</p>
        <p className="text-sm text-muted-foreground mt-2">Contact us for custom enhancements.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {available.map((pkg) => {
        const info = PACKAGE_TIERS[pkg];
        return (
          <Card key={pkg} className={`${info.color} border p-6 hover:border-opacity-100 transition cursor-pointer`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{info.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{info.name}</h3>
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              </div>
              <Badge className="bg-primary/20 text-primary">Upgrade Available</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                <p className="font-bold text-foreground">{info.price}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Setup Fee</p>
                <p className="font-bold text-foreground">{info.setup}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {info.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-green-400" />
                  {feature}
                </div>
              ))}
            </div>

            <Button onClick={() => onUpgrade(pkg)} className="w-full gradient-bg text-white gap-2">
              Upgrade to {info.name} <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        );
      })}
    </div>
  );
}