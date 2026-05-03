import { useRef, useState } from 'react';
import { MessageSquare, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function VideoFeedbackPanel({ videoUrl, onSubmitFeedback }) {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTimestampedFeedback = () => {
    if (!feedback.trim()) return;

    const newFeedback = {
      id: Date.now(),
      timestamp: currentTime,
      message: feedback,
      formattedTime: formatTime(currentTime),
      createdAt: new Date().toISOString()
    };

    setFeedbacks([...feedbacks, newFeedback]);
    setFeedback('');
    setSelectedTimestamp(null);
  };

  const jumpToTimestamp = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const handleSave = () => {
    if (feedbacks.length > 0) {
      onSubmitFeedback(feedbacks);
    }
  };

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="rounded-lg overflow-hidden bg-background">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full bg-black"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
        <Button size="sm" variant="outline" onClick={handlePlayPause}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-border rounded-full cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              jumpToTimestamp(percent * duration);
            }}>
              <div className="h-full bg-primary rounded-full" style={{ width: `${(currentTime / duration) * 100}%` }} />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Add Feedback */}
      <div className="p-4 bg-secondary/20 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Add Feedback at {formatTime(currentTime)}</span>
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={`Leave feedback about the content at ${formatTime(currentTime)}...`}
          rows={3}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFeedback('')}
            disabled={!feedback.trim()}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={addTimestampedFeedback}
            disabled={!feedback.trim()}
            className="bg-primary hover:bg-primary/90 ml-auto"
          >
            Add Feedback at {formatTime(currentTime)}
          </Button>
        </div>
      </div>

      {/* Feedback List */}
      {feedbacks.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <p className="text-sm font-semibold text-muted-foreground">Feedback ({feedbacks.length})</p>
          {feedbacks.map((fb) => (
            <div key={fb.id} className="p-3 bg-secondary/30 rounded-lg">
              <button
                onClick={() => jumpToTimestamp(fb.timestamp)}
                className="text-sm font-mono text-primary hover:underline"
              >
                {fb.formattedTime}
              </button>
              <p className="text-sm text-foreground mt-1">{fb.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1">Close</Button>
        <Button
          onClick={handleSave}
          disabled={feedbacks.length === 0}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          Save {feedbacks.length} Feedback Item{feedbacks.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}