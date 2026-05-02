import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { BookOpen, Copy, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function QuickScriptsWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scripts, setScripts] = useState([]);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    const fetchScripts = async () => {
      const all = await base44.entities.Playbook.list();
      
      // Filter by user's role, content type = script, and limit to 3 random ones
      const userScripts = all.filter(pb => 
        pb.visible_to_roles.includes(user.role) &&
        pb.content_type === "script"
      );
      
      // Get 3 random scripts
      const shuffled = [...userScripts].sort(() => Math.random() - 0.5);
      setScripts(shuffled.slice(0, 3));
    };
    
    if (user) fetchScripts();
  }, [user]);

  const copyToClipboard = (content, id) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="glass border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Today's Quick Scripts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {scripts.map((script) => (
          <div 
            key={script.id}
            className="bg-secondary/40 rounded-lg p-3 space-y-2 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{script.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{script.short_description}</p>
              </div>
              <Button
                onClick={() => copyToClipboard(script.full_content, script.id)}
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
              >
                <Copy className={`w-3 h-3 ${copied === script.id ? "text-green-400" : "text-muted-foreground"}`} />
              </Button>
            </div>
          </div>
        ))}
        
        <Link to="/playbooks">
          <Button variant="outline" className="w-full text-xs" size="sm">
            View All Scripts
            <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}