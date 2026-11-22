import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, Eraser, Palette, Shapes, Type, Undo2 } from 'lucide-react';
import type { ItemCategory } from '../types';

interface PngCreatorProps {
  itemName: string;
  category: ItemCategory;
  onAttachPng: (file: File) => Promise<void>;
  disabled?: boolean;
}

const CANVAS_W = 800;
const CANVAS_H = 600;

const BG_OPTIONS = [
  { id: 'cream', label: 'Warm Cream', color: '#FFFBF5' },
  { id: 'sun', label: 'Sun Soft', color: '#FFF1C7' },
  { id: 'bluesoft', label: 'Sky Blue Soft', color: '#E3ECFF' },
  { id: 'blue', label: 'Royal Blue', color: '#0B57F0' },
  { id: 'navy', label: 'Deep Navy', color: '#14163D' },
  { id: 'transparent', label: 'Transparent PNG', color: 'transparent' },
] as const;

const BRUSH_COLORS = [
  { label: 'Royal Blue', hex: '#0B57F0' },
  { label: 'Navy', hex: '#14163D' },
  { label: 'Orange', hex: '#F5811F' },
  { label: 'Sun', hex: '#FFC531' },
  { label: 'Cream', hex: '#FFFBF5' },
  { label: 'Coral', hex: '#FF9A4D' },
] as const;

const BRUSH_SIZES = [
  { label: 'Fine', size: 4 },
  { label: 'Medium', size: 10 },
  { label: 'Bold', size: 20 },
] as const;

function drawCategoryGraphic(
  ctx: CanvasRenderingContext2D,
  category: ItemCategory,
  strokeColor: string,
  accentColor: string
) {
  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 22);
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = accentColor;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.arc(0, 0, 128, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  switch (category) {
    case 'Tools':
      ctx.moveTo(-48, 48);
      ctx.lineTo(24, -24);
      ctx.arc(42, -42, 28, Math.PI * 0.75, Math.PI * 2.25);
      ctx.lineTo(14, -14);
      break;
    case 'Electronics':
      ctx.roundRect(-64, -44, 128, 88, 14);
      ctx.moveTo(-20, 0);
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      break;
    case 'Outdoor':
      ctx.moveTo(-72, 46);
      ctx.lineTo(0, -58);
      ctx.lineTo(72, 46);
      ctx.closePath();
      ctx.moveTo(0, -58);
      ctx.lineTo(0, 46);
      break;
    case 'Education':
      ctx.moveTo(0, -40);
      ctx.quadraticCurveTo(-36, -54, -68, -36);
      ctx.lineTo(-68, 42);
      ctx.quadraticCurveTo(-36, 26, 0, 42);
      ctx.quadraticCurveTo(36, 26, 68, 42);
      ctx.lineTo(68, -36);
      ctx.quadraticCurveTo(36, -54, 0, -40);
      ctx.moveTo(0, -40);
      ctx.lineTo(0, 42);
      break;
    case 'Household':
      ctx.moveTo(-66, 0);
      ctx.lineTo(0, -56);
      ctx.lineTo(66, 0);
      ctx.moveTo(-48, -14);
      ctx.lineTo(-48, 48);
      ctx.lineTo(48, 48);
      ctx.lineTo(48, -14);
      break;
    case 'Sports':
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.moveTo(-46, -30);
      ctx.quadraticCurveTo(0, 0, 46, -30);
      ctx.moveTo(-46, 30);
      ctx.quadraticCurveTo(0, 0, 46, 30);
      break;
    case 'Events':
      ctx.moveTo(-68, -34);
      ctx.quadraticCurveTo(0, -6, 68, -34);
      ctx.moveTo(-54, -26);
      ctx.lineTo(-34, 24);
      ctx.lineTo(-14, -20);
      ctx.moveTo(-4, -18);
      ctx.lineTo(16, 28);
      ctx.lineTo(36, -22);
      break;
    default:
      ctx.roundRect(-54, -48, 108, 96, 12);
      ctx.moveTo(-54, -12);
      ctx.lineTo(54, -12);
      ctx.moveTo(0, -48);
      ctx.lineTo(0, -12);
      break;
  }
  ctx.stroke();
  ctx.restore();
}

export function PngCreator({
  itemName,
  category,
  onAttachPng,
  disabled = false,
}: PngCreatorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const [bgId, setBgId] = useState<(typeof BG_OPTIONS)[number]['id']>('sun');
  const [brushColor, setBrushColor] = useState<string>('#0B57F0');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [includeLabel, setIncludeLabel] = useState<boolean>(true);
  const [showEmblem, setShowEmblem] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [attaching, setAttaching] = useState<boolean>(false);

  const ensureDrawingLayer = useCallback(() => {
    if (!drawingCanvasRef.current) {
      const layer = document.createElement('canvas');
      layer.width = CANVAS_W;
      layer.height = CANVAS_H;
      drawingCanvasRef.current = layer;
    }
    return drawingCanvasRef.current;
  }, []);

  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bg = BG_OPTIONS.find((b) => b.id === bgId) || BG_OPTIONS[1];
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (bg.color !== 'transparent') {
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const isDarkBg = bgId === 'blue' || bgId === 'navy';

    if (showEmblem) {
      const stroke = isDarkBg ? '#FFFBF5' : '#0B57F0';
      const fill = isDarkBg ? 'rgba(255,255,255,0.16)' : 'rgba(255, 197, 49, 0.35)';
      drawCategoryGraphic(ctx, category, stroke, fill);
    }

    const layer = ensureDrawingLayer();
    ctx.drawImage(layer, 0, 0);

    const displayTitle = itemName.trim() || category;
    if (includeLabel && displayTitle) {
      ctx.save();
      ctx.font = '800 32px "Manrope", system-ui, sans-serif';
      const metrics = ctx.measureText(displayTitle);
      const pillW = Math.min(CANVAS_W - 80, metrics.width + 56);
      const pillH = 56;
      const pillX = (CANVAS_W - pillW) / 2;
      const pillY = CANVAS_H - 92;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.3)' : 'rgba(20, 22, 61, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#14163D';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayTitle, CANVAS_W / 2, pillY + pillH / 2 + 1, pillW - 36);
      ctx.restore();
    }
  }, [bgId, category, ensureDrawingLayer, includeLabel, itemName, showEmblem]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const pushSnapshot = () => {
    const layer = ensureDrawingLayer();
    const lctx = layer.getContext('2d');
    if (!lctx) return;
    historyRef.current.push(lctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    if (historyRef.current.length > 25) {
      historyRef.current.shift();
    }
    setCanUndo(historyRef.current.length > 0);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || attaching) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushSnapshot();
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    lastPointRef.current = pt;

    const layer = ensureDrawingLayer();
    const lctx = layer.getContext('2d');
    if (lctx) {
      lctx.fillStyle = brushColor;
      lctx.beginPath();
      lctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      lctx.fill();
      renderComposite();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    const pt = getCanvasPoint(e);
    const layer = ensureDrawingLayer();
    const lctx = layer.getContext('2d');
    if (lctx) {
      lctx.strokeStyle = brushColor;
      lctx.lineWidth = brushSize;
      lctx.lineCap = 'round';
      lctx.lineJoin = 'round';
      lctx.beginPath();
      lctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      lctx.lineTo(pt.x, pt.y);
      lctx.stroke();
      lastPointRef.current = pt;
      renderComposite();
    }
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const handleUndo = () => {
    const prev = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (!prev) return;
    const layer = ensureDrawingLayer();
    const lctx = layer.getContext('2d');
    if (lctx) {
      lctx.putImageData(prev, 0, 0);
      renderComposite();
    }
  };

  const handleClearDrawing = () => {
    pushSnapshot();
    const layer = ensureDrawingLayer();
    const lctx = layer.getContext('2d');
    if (lctx) {
      lctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      renderComposite();
    }
  };

  const exportPngBlob = async (): Promise<Blob> => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas is not ready yet.');
    renderComposite();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!blob) throw new Error('Could not export PNG image.');
    return blob;
  };

  const safeSlug =
    itemName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'shareshelf-item';

  const handleDownloadPng = async () => {
    try {
      const blob = await exportPngBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeSlug}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // ignore download error
    }
  };

  const handleUsePng = async () => {
    setAttaching(true);
    try {
      const blob = await exportPngBlob();
      const file = new File([blob], `${safeSlug}.png`, { type: 'image/png' });
      await onAttachPng(file);
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-[var(--line)] bg-white p-3.5 sm:p-4">
      {/* Canvas surface */}
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm"
        style={
          bgId === 'transparent'
            ? {
                backgroundImage:
                  'linear-gradient(45deg, #ede6da 25%, transparent 25%), linear-gradient(-45deg, #ede6da 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ede6da 75%), linear-gradient(-45deg, transparent 75%, #ede6da 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
              }
            : undefined
        }
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block aspect-[4/3] w-full cursor-crosshair touch-none"
          aria-label="Draw or design your item PNG image"
        />
      </div>

      {/* Background swatches + Draw tools */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--navy)]">
            <Palette className="h-3.5 w-3.5 text-[var(--blue)]" aria-hidden="true" />
            Canvas background
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {BG_OPTIONS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                title={bg.label}
                aria-label={bg.label}
                onClick={() => setBgId(bg.id)}
                className={`h-7 w-7 rounded-full border transition-transform ${
                  bgId === bg.id
                    ? 'scale-110 border-[var(--blue)] ring-2 ring-[var(--blue)]/30'
                    : 'border-[var(--line)] hover:scale-105'
                }`}
                style={
                  bg.color === 'transparent'
                    ? {
                        backgroundImage:
                          'linear-gradient(45deg, #d7ded7 25%, transparent 25%), linear-gradient(-45deg, #d7ded7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d7ded7 75%), linear-gradient(-45deg, transparent 75%, #d7ded7 75%)',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                      }
                    : { backgroundColor: bg.color }
                }
              />
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-bold text-[var(--navy)]">
            Brush color &amp; size
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              {BRUSH_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.label}
                  aria-label={`Brush ${c.label}`}
                  onClick={() => setBrushColor(c.hex)}
                  className={`h-6 w-6 rounded-full border transition-transform ${
                    brushColor === c.hex
                      ? 'scale-110 border-[var(--navy)] ring-2 ring-[var(--blue)]/30'
                      : 'border-[var(--line)] hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--cream)] p-0.5">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setBrushSize(s.size)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors ${
                    brushSize === s.size
                      ? 'bg-[var(--navy)] text-white'
                      : 'text-[var(--navy)] hover:bg-[var(--sun-soft)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toggles & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowEmblem((v) => !v)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
              showEmblem
                ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
                : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[var(--sun-soft)]'
            }`}
          >
            <Shapes className="h-3.5 w-3.5" aria-hidden="true" />
            Icon badge
          </button>

          <button
            type="button"
            onClick={() => setIncludeLabel((v) => !v)}
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
              includeLabel
                ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue)]'
                : 'border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[var(--sun-soft)]'
            }`}
          >
            <Type className="h-3.5 w-3.5" aria-hidden="true" />
            Title label
          </button>

          <button
            type="button"
            disabled={!canUndo}
            onClick={handleUndo}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-bold text-[var(--navy)] hover:bg-[var(--sun-soft)] disabled:opacity-45"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Undo
          </button>

          <button
            type="button"
            onClick={handleClearDrawing}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-bold text-[var(--navy)] hover:bg-[var(--sun-soft)]"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            Clear ink
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--navy)] hover:bg-[var(--sun-soft)] sm:flex-initial"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Save .png
          </button>

          <button
            type="button"
            disabled={disabled || attaching}
            onClick={handleUsePng}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--blue)] px-4 py-1.5 text-xs font-bold text-white hover:bg-[var(--blue-deep)] disabled:opacity-60 sm:flex-initial"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {attaching ? 'Attaching PNG...' : 'Use this PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
