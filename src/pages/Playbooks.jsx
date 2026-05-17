import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BookOpen, Copy, Heart, ChevronDown, ChevronUp, Search, Edit2, Zap } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIES = [
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "discovery", label: "Discovery" },
  { value: "objection_handler", label: "Objections" },
  { value: "closing", label: "Closing" },
  { value: "follow_up", label: "Follow-ups" },
  { value: "upsell", label: "Upsells" },
  { value: "escalation", label: "Escalation" },
  { value: "daily_routine", label: "Daily Routines" }
];

const CONTENT_TYPE_COLORS = {
  script: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  framework: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  checklist: "bg-green-500/20 text-green-300 border-green-500/30",
  template: "bg-orange-500/20 text-orange-300 border-orange-500/30"
};

export default function Playbooks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [playbooks, setPlaybooks] = useState([]);
  const [filteredPlaybooks, setFilteredPlaybooks] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const fetchPlaybooks = async () => {
      setLoading(true);
      const token = localStorage.getItem('mio_session_token');
      const res = await base44.functions.invoke('getPlaybooks', { token });
      const all = res.data?.playbooks || [];
      
      // Owner/founder/admin sees all playbooks; others filtered by role
      const adminRoles = ['owner', 'founder', 'admin'];
      const userPlaybooks = adminRoles.includes(user.role)
        ? all
        : all.filter(pb => pb.visible_to_roles?.includes(user.role));
      
      setPlaybooks(userPlaybooks);
      setFilteredPlaybooks(userPlaybooks);
      
      // Load favorites from localStorage
      const saved = localStorage.getItem(`playbook_favorites_${user.email}`);
      if (saved) setFavorites(new Set(JSON.parse(saved)));
      
      setLoading(false);
    };
    
    if (user) fetchPlaybooks();
  }, [user]);

  // Filter and search
  useEffect(() => {
    let result = playbooks;
    
    if (selectedCategory) {
      result = result.filter(pb => pb.category === selectedCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(pb => 
        pb.title.toLowerCase().includes(query) ||
        pb.short_description.toLowerCase().includes(query) ||
        pb.full_content.toLowerCase().includes(query)
      );
    }
    
    setFilteredPlaybooks(result);
  }, [selectedCategory, searchQuery, playbooks]);

  const toggleFavorite = (id) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
    localStorage.setItem(`playbook_favorites_${user.email}`, JSON.stringify([...newFavorites]));
    toast({ title: newFavorites.has(id) ? "Added to favorites" : "Removed from favorites" });
  };

  const copyToClipboard = (content) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!" });
  };

  const startEdit = (pb) => {
    setEditingId(pb.id);
    setEditForm(pb);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    const token = localStorage.getItem('mio_session_token');
    await base44.functions.invoke('updatePlaybook', {
      token,
      playbook_id: editingId,
      data: { full_content: editForm.full_content, usage_notes: editForm.usage_notes }
    });
    
    setPlaybooks(playbooks.map(pb => pb.id === editingId ? editForm : pb));
    setEditingId(null);
    setEditForm(null);
    toast({ title: "Playbook updated!" });
  };

  const handleSeedPlaybooks = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke("seedPlaybooks", {});
      sonnerToast.success(res?.data?.message || "Playbooks seeded!");
      // Reload
      const token = localStorage.getItem('mio_session_token');
      const reloadRes = await base44.functions.invoke('getPlaybooks', { token });
      const all = reloadRes.data?.playbooks || [];
      const userPlaybooks = all.filter(pb => pb.visible_to_roles?.includes(user.role));
      setPlaybooks(userPlaybooks);
      setFilteredPlaybooks(userPlaybooks);
    } catch (err) {
      sonnerToast.error("Failed to seed playbooks");
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <AppLayout title="Playbooks & Scripts"><div className="text-center py-8">Loading...</div></AppLayout>;

  return (
    <AppLayout 
      title="Playbooks & Scripts" 
      subtitle="Your day-1 reference for what to do, when, how, and what to say"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Owner seed button */}
        {["owner", "admin", "founder"].includes(user?.role) && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedPlaybooks}
              disabled={seeding}
              className="gap-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
            >
              <Zap className="w-3.5 h-3.5" />
              {seeding ? "Seeding..." : "Seed Default Playbooks"}
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search playbooks by title or content..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setSelectedCategory(null)}
            variant={selectedCategory === null ? "default" : "outline"}
            className="text-xs"
          >
            All Categories
          </Button>
          {CATEGORIES.map(cat => (
            <Button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              className="text-xs"
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Playbooks grid */}
        {filteredPlaybooks.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No playbooks found</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {filteredPlaybooks.map((pb) => {
              const isExpanded = expandedId === pb.id;
              const isFavorited = favorites.has(pb.id);
              const isEditing = editingId === pb.id;
              const isObjectionHandler = pb.category === "objection_handler";

              return (
                <Card key={pb.id} className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-sm">{pb.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{pb.short_description}</p>
                    </div>
                    {pb.is_favorite_eligible && (
                      <button
                        onClick={() => toggleFavorite(pb.id)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Heart 
                          className={`w-4 h-4 ${isFavorited ? "fill-pink-500 text-pink-500" : "text-muted-foreground"}`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={CONTENT_TYPE_COLORS[pb.content_type]}>
                      {pb.content_type}
                    </Badge>
                    {isObjectionHandler && pb.related_objection && (
                      <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                        "{pb.related_objection}"
                      </Badge>
                    )}
                  </div>

                  {/* Content preview / full */}
                  {isExpanded && !isEditing ? (
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-3">
                      {isObjectionHandler ? (
                        <>
                          <div>
                            <p className="text-xs font-semibold text-amber-300 mb-1">Customer says:</p>
                            <p className="text-sm text-foreground italic">"{pb.related_objection}"</p>
                          </div>
                          <div className="border-t border-white/10 pt-3">
                            <p className="text-xs font-semibold text-green-300 mb-1">You say:</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{pb.full_content}</p>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{pb.full_content}</p>
                        </div>
                      )}
                      {pb.usage_notes && (
                        <div className="border-t border-white/10 pt-3">
                          <p className="text-xs font-semibold text-blue-300 mb-1">When to use:</p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{pb.usage_notes}</p>
                        </div>
                      )}
                    </div>
                  ) : isEditing ? (
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Content</label>
                        <textarea
                          value={editForm.full_content}
                          onChange={(e) => setEditForm({...editForm, full_content: e.target.value})}
                          className="w-full h-32 bg-input text-foreground rounded border border-white/10 p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Usage notes</label>
                        <textarea
                          value={editForm.usage_notes || ""}
                          onChange={(e) => setEditForm({...editForm, usage_notes: e.target.value})}
                          className="w-full h-24 bg-input text-foreground rounded border border-white/10 p-2 text-xs"
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => isExpanded ? setExpandedId(null) : setExpandedId(pb.id)}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3 mr-1" /> Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3 mr-1" /> Expand
                        </>
                      )}
                    </Button>
                    
                    {!isEditing && (pb.content_type === "script" || pb.content_type === "template") && (
                      <Button
                        onClick={() => copyToClipboard(pb.full_content)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    )}
                    
                    {["founder", "owner", "admin"].includes(user.role) && !isEditing && (
                      <Button
                        onClick={() => startEdit(pb)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    )}

                    {isEditing && (
                      <>
                        <Button
                          onClick={saveEdit}
                          variant="default"
                          size="sm"
                          className="text-xs"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingId(null)}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}