import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Pin, PinOff, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CATEGORY_CONFIG = {
  discovery_note: { label: "Discovery", color: "bg-blue-500/20 text-blue-300" },
  objection_note: { label: "Objection", color: "bg-orange-500/20 text-orange-300" },
  follow_up_note: { label: "Follow-up", color: "bg-purple-500/20 text-purple-300" },
  proposal_note: { label: "Proposal", color: "bg-cyan-500/20 text-cyan-300" },
  closing_note: { label: "Closing", color: "bg-green-500/20 text-green-300" },
  onboarding_note: { label: "Onboarding", color: "bg-pink-500/20 text-pink-300" },
  general_note: { label: "General", color: "bg-gray-500/20 text-gray-300" },
};

export default function InteractionNotesPanel({ clientId, leadId }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general_note");
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const entityType = clientId ? "client" : "lead";
  const entityId = clientId || leadId;

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        setLoading(true);
        const allNotes = await base44.entities.InteractionNote.list();
        const filtered = allNotes.filter((n) =>
          clientId ? n.client_id === clientId : n.lead_id === leadId
        );
        setNotes(filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      } catch (error) {
        console.error("Error fetching notes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [clientId, leadId]);

  // Add note
  const handleAddNote = async () => {
    if (!noteContent.trim()) return;

    try {
      setIsSubmitting(true);
      const newNote = await base44.entities.InteractionNote.create({
        content: noteContent,
        category: selectedCategory,
        author_name: user?.full_name || "Unknown",
        author_email: user?.email || "",
        ...(clientId ? { client_id: clientId } : { lead_id: leadId }),
      });

      setNotes([newNote, ...notes]);
      setNoteContent("");
      setSelectedCategory("general_note");
      setShowForm(false);
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle pin
  const handleTogglePin = async (noteId, isPinned) => {
    try {
      await base44.entities.InteractionNote.update(noteId, {
        is_pinned: !isPinned,
      });
      setNotes(
        notes.map((n) => (n.id === noteId ? { ...n, is_pinned: !isPinned } : n))
      );
    } catch (error) {
      console.error("Error updating pin status:", error);
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId) => {
    try {
      await base44.entities.InteractionNote.delete(noteId);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    const matchesSearch = n.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const regularNotes = filteredNotes.filter((n) => !n.is_pinned);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Interaction Notes</h3>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Write your note here..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            className="min-h-24"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={isSubmitting || !noteContent.trim()}
            >
              {isSubmitting ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
      ) : (
        <>
          {/* Pinned Notes */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Pinned</p>
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}

          {/* Regular Notes */}
          {regularNotes.length > 0 && (
            <div className="space-y-2">
              {pinnedNotes.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase">All Notes</p>
              )}
              {regularNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onTogglePin={handleTogglePin}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredNotes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {notes.length === 0 ? "No notes yet" : "No notes match your search"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoteCard({ note, onTogglePin, onDelete }) {
  const categoryConfig = CATEGORY_CONFIG[note.category];

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Badge className={categoryConfig.color}>
              {categoryConfig.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(note.created_date), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
          <p className="text-xs text-muted-foreground">by {note.author_name}</p>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => onTogglePin(note.id, note.is_pinned)}
            className="p-1 hover:bg-secondary rounded transition-colors"
            title={note.is_pinned ? "Unpin" : "Pin"}
          >
            {note.is_pinned ? (
              <PinOff className="w-4 h-4 text-primary" />
            ) : (
              <Pin className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 hover:bg-destructive/20 rounded transition-colors"
            title="Delete"
          >
            <X className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>
    </div>
  );
}