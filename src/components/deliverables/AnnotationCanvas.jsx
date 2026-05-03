import { useRef, useEffect, useState } from 'react';
import { Pen, Highlighter, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnnotationCanvas({ imageUrl, onSave, onClose }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState('draw'); // 'draw' or 'highlight'
  const [context, setContext] = useState(null);
  const [image, setImage] = useState(null);
  const [savedAnnotations, setSavedAnnotations] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    setContext(ctx);

    // Load image
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImage(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);

    if (mode === 'draw') {
      context.strokeStyle = '#ec4899';
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(x, y);
    } else if (mode === 'highlight') {
      context.fillStyle = 'rgba(236, 72, 153, 0.3)';
      context.strokeStyle = '#ec4899';
      context.lineWidth = 2;
      context.beginPath();
      context.rect(x, y, 1, 1);
    }
  };

  const draw = (e) => {
    if (!isDrawing || !context) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'draw') {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    context?.closePath();
  };

  const clearCanvas = () => {
    if (!context || !image) return;
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    context.drawImage(image, 0, 0);
  };

  const saveAnnotation = () => {
    const canvas = canvasRef.current;
    const annotationData = {
      id: Date.now(),
      imageData: canvas.toDataURL('image/png'),
      timestamp: new Date().toISOString(),
      mode
    };
    setSavedAnnotations([...savedAnnotations, annotationData]);
  };

  const handleSave = () => {
    if (savedAnnotations.length > 0) {
      onSave(savedAnnotations);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
        <span className="text-sm font-semibold text-muted-foreground">Tool:</span>
        <Button
          size="sm"
          variant={mode === 'draw' ? 'default' : 'outline'}
          onClick={() => setMode('draw')}
          className="gap-2"
        >
          <Pen className="w-4 h-4" /> Draw
        </Button>
        <Button
          size="sm"
          variant={mode === 'highlight' ? 'default' : 'outline'}
          onClick={() => setMode('highlight')}
          className="gap-2"
        >
          <Highlighter className="w-4 h-4" /> Highlight
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={clearCanvas}
          className="gap-2 ml-auto"
        >
          <RotateCcw className="w-4 h-4" /> Clear
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="w-full border-2 border-border rounded-lg cursor-crosshair bg-background"
        style={{ maxHeight: '500px' }}
      />

      <div className="flex gap-2 justify-between">
        <div className="text-sm text-muted-foreground">
          {savedAnnotations.length} annotation{savedAnnotations.length !== 1 ? 's' : ''} saved
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => {
              saveAnnotation();
              handleSave();
              onClose();
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90"
          >
            Save & Done
          </Button>
        </div>
      </div>
    </div>
  );
}