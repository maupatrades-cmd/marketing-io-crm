import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { AlertCircle, Loader2, MessageSquare } from 'lucide-react';
import AnnotationCanvas from './AnnotationCanvas';
import VideoFeedbackPanel from './VideoFeedbackPanel';

export default function GranularFeedbackModal({
  isOpen,
  onClose,
  deliverable,
  client,
  user
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [annotations, setAnnotations] = useState([]);
  const [videoFeedbacks, setVideoFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSaveAnnotations = (annotationData) => {
    setAnnotations(annotationData);
    setActiveTab('general');
  };

  const handleSaveVideoFeedback = (feedbackData) => {
    setVideoFeedbacks(feedbackData);
    setActiveTab('general');
  };

  const handleSubmit = async () => {
    if (!generalFeedback.trim() && annotations.length === 0 && videoFeedbacks.length === 0) {
      setError('Please add at least some feedback');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create feedback record
      await base44.entities.DeliverableFeedback.create({
        deliverable_id: deliverable.id,
        deliverable_title: deliverable.title,
        client_id: client.id,
        client_name: client.business_name,
        staff_id: deliverable.assigned_to,
        staff_name: deliverable.assigned_to_name,
        phase: deliverable.phase,
        rating: 5, // Default rating, can be updated later
        comment: generalFeedback || null,
        submitted_at: new Date().toISOString()
      });

      // Store detailed feedback with annotations if any
      if (annotations.length > 0 || videoFeedbacks.length > 0) {
        await base44.entities.DeliverableFeedback.create({
          deliverable_id: deliverable.id,
          deliverable_title: deliverable.title,
          client_id: client.id,
          client_name: client.business_name,
          staff_id: deliverable.assigned_to,
          staff_name: deliverable.assigned_to_name,
          phase: deliverable.phase,
          rating: 5,
          comment: JSON.stringify({
            general: generalFeedback,
            annotations: annotations.length,
            videoFeedbacks: videoFeedbacks.length
          }),
          submitted_at: new Date().toISOString()
        });
      }

      // Notify staff
      await base44.functions.invoke('notifyClientCommunication', {
        client_id: client.id,
        message_type: 'feedback',
        subject: `Client Feedback on ${deliverable.title}`,
        message: generalFeedback || 'Client provided visual/video feedback with annotations'
      });

      onClose();
    } catch (err) {
      console.error('[GranularFeedback]', err);
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const hasImageFiles = deliverable.file_urls?.some(url => 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
  );
  const hasVideoFiles = deliverable.file_urls?.some(url => 
    /\.(mp4|webm|ogg)$/i.test(url)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border/50 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Detailed Feedback on "{deliverable.title}"
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Leave specific feedback with annotations, highlights, and timestamps
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General Feedback</TabsTrigger>
            {hasImageFiles && <TabsTrigger value="annotate">Annotate Images</TabsTrigger>}
            {hasVideoFiles && <TabsTrigger value="video">Video Feedback</TabsTrigger>}
          </TabsList>

          {/* General Feedback Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold block mb-2">Your Feedback</label>
              <Textarea
                value={generalFeedback}
                onChange={(e) => setGeneralFeedback(e.target.value)}
                placeholder="Share your thoughts on this deliverable..."
                rows={5}
                className="bg-secondary/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {annotations.length > 0 && `${annotations.length} annotation(s) ready`}
                {videoFeedbacks.length > 0 && ` • ${videoFeedbacks.length} video feedback(s)`}
              </p>
            </div>

            {error && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || (!generalFeedback.trim() && annotations.length === 0 && videoFeedbacks.length === 0)}
                className="ml-auto bg-primary hover:bg-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Annotation Tab */}
          {hasImageFiles && (
            <TabsContent value="annotate" className="mt-4">
              <AnnotationCanvas
                imageUrl={deliverable.file_urls?.find(url => /\.(jpg|jpeg|png|gif|webp)$/i.test(url))}
                onSave={handleSaveAnnotations}
                onClose={() => setActiveTab('general')}
              />
            </TabsContent>
          )}

          {/* Video Feedback Tab */}
          {hasVideoFiles && (
            <TabsContent value="video" className="mt-4">
              <VideoFeedbackPanel
                videoUrl={deliverable.file_urls?.find(url => /\.(mp4|webm|ogg)$/i.test(url))}
                onSubmitFeedback={handleSaveVideoFeedback}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}