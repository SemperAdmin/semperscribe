"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSyncedState } from "@/hooks/useSyncedState";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Move, Trash2, AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { SignaturePosition } from "@/types";
import { getPdfWorkerSrc } from '@/lib/pdf-worker';
import { ShareLinkDialog, type ShareLinkOptions } from "@/components/ShareLinkDialog";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });

// Configure PDF.js worker on client side only
if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
  });
}

// PDF page dimensions in points (8.5" x 11" at 72 DPI)
const PDF_WIDTH = 612;
const PDF_HEIGHT = 792;
const MIN_BOX_SIZE = 20;

// P8-1: keyboard placement. "Add signature field" drops a default-size
// box where the signature block of a naval letter sits: flush with the
// page centre line (M-5216.5 says the signature block begins at the
// horizontal centre), about 2.5" up from the bottom edge, which is where
// the block lands on a one-page letter with the identification lines
// below it. Successive boxes on the same page stack downward so two
// fields are never created on top of each other.
const DEFAULT_BOX = { width: 200, height: 48 };
const SIGNATURE_BLOCK_ANCHOR = { x: PDF_WIDTH / 2, y: 180 };
const STACK_GAP = 8;
const KEY_STEP = 4;
const KEY_STEP_LARGE = 16;

function clampBox(box: SignaturePosition): SignaturePosition {
  const width = Math.min(Math.max(box.width, MIN_BOX_SIZE), PDF_WIDTH);
  const height = Math.min(Math.max(box.height, MIN_BOX_SIZE), PDF_HEIGHT);
  const x = Math.min(Math.max(box.x, 0), PDF_WIDTH - width);
  const y = Math.min(Math.max(box.y, 0), PDF_HEIGHT - height);
  return { ...box, x, y, width, height };
}

interface SignaturePlacementModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (positions: SignaturePosition[]) => void;
  /** S2e: persist fields AND copy the signature request link in one
   * step. P2-1: the modal collects the link password first (the request
   * link is always encrypted), and passes it along with the fields. */
  onConfirmAndCopyLink?: (positions: SignaturePosition[], options: ShareLinkOptions) => void | Promise<void>;
  pdfBlob: Blob | null;
  totalPages: number;
  /** ENC: pages beyond this are merged enclosures - visible for
   * context, but fields land on letter pages only (fields travel on
   * request links, and links never carry enclosure files). Defaults
   * to totalPages (everything placeable). */
  placeablePages?: number;
}

type InteractionMode = "none" | "drawing" | "moving" | "resizing";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

export function SignaturePlacementModal(props: SignaturePlacementModalProps) {
  const { open, pdfBlob, totalPages, placeablePages } = props;
  const lastLetterPage = placeablePages ?? totalPages;

  // Fresh state on every open. The body below is remounted (via key) each
  // time the dialog goes from closed to open, or the last letter page
  // changes while it is open, so every box, selection and page choice
  // starts over without an effect resetting them after the first paint.
  const [openCount] = useSyncedState(open, (isOpen, prev: number | undefined) => (isOpen ? (prev ?? 0) + 1 : prev ?? 0));

  // Object URL for the preview, one per blob, revoked when the blob
  // changes or the modal unmounts. Held here so a remount of the body
  // does not re-create it.
  const pdfUrl = useMemo(() => (pdfBlob ? URL.createObjectURL(pdfBlob) : null), [pdfBlob]);
  useEffect(() => {
    if (!pdfUrl) return;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  return (
    <SignaturePlacementBody
      key={`${openCount}:${lastLetterPage}`}
      {...props}
      pdfUrl={pdfUrl}
      lastLetterPage={lastLetterPage}
    />
  );
}

interface SignaturePlacementBodyProps extends SignaturePlacementModalProps {
  pdfUrl: string | null;
  lastLetterPage: number;
}

function SignaturePlacementBody({
  open,
  onClose,
  onConfirm,
  onConfirmAndCopyLink,
  totalPages,
  pdfUrl,
  lastLetterPage,
}: SignaturePlacementBodyProps) {
  // ENC: open on the LAST LETTER page (where the signature block lives).
  // With enclosures merged behind, the last document page is an
  // enclosure, not the letter.
  const [currentPage, setCurrentPage] = useState(lastLetterPage > 0 ? lastLetterPage : 1);
  const [signatureBoxes, setSignatureBoxes] = useState<SignaturePosition[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Interaction State
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none");
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null); // For move/resize
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [tempRect, setTempRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const boxRefs = useRef(new Map<string, HTMLDivElement>());
  // Box to focus once the box list has re-rendered: the one just added
  // from the keyboard, or the Add button once a focused box is deleted.
  const pendingFocus = useRef<string | "add" | null>(null);
  const instructionsId = React.useId();

  // P2-1: the request link needs a password before it is built. The
  // share dialog (signature-request mode) collects it; no window.prompt.
  const [showRequestLinkDialog, setShowRequestLinkDialog] = useState(false);

  // Handle page load to get dimensions
  const onPageLoadSuccess = useCallback(({ width, height }: { width: number; height: number }) => {
    setPageSize({ width, height });
  }, []);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "add") addButtonRef.current?.focus();
    else boxRefs.current.get(target)?.focus();
  }, [signatureBoxes]);

  // Coordinate Conversion
  const screenToPdfCoords = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current;
    if (!container || pageSize.width === 0) return { x: 0, y: 0 };

    const pageElement = container.querySelector(".react-pdf__Page__canvas") as HTMLElement;
    if (!pageElement) return { x: 0, y: 0 };

    const pageRect = pageElement.getBoundingClientRect();
    const relX = screenX - pageRect.left;
    const relY = screenY - pageRect.top;

    const scaleX = PDF_WIDTH / pageRect.width;
    const scaleY = PDF_HEIGHT / pageRect.height;

    // PDF coords: (0,0) is bottom-left
    const pdfX = relX * scaleX;
    const pdfY = PDF_HEIGHT - (relY * scaleY);

    return { x: pdfX, y: pdfY };
  }, [pageSize]);

  // Helper: Convert PDF coords to Style (CSS % or px relative to container)
  const getBoxStyle = (box: { x: number; y: number; width: number; height: number }) => {
    if (pageSize.width === 0) return {};
    
    // Scale factor from PDF points to Screen pixels
    const scaleX = pageSize.width / PDF_WIDTH;
    const scaleY = pageSize.height / PDF_HEIGHT;

    return {
      left: box.x * scaleX,
      bottom: box.y * scaleY, // PDF y is from bottom
      width: box.width * scaleX,
      height: box.height * scaleY,
      position: 'absolute' as const,
    };
  };

  // ENC: enclosure pages are view-only.
  const onEnclosurePage = currentPage > lastLetterPage;

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on a form input or button, ignore
    if ((e.target as HTMLElement).closest('.interaction-ignore')) return;
    // ENC: no drawing on enclosure pages - the banner explains why.
    if (onEnclosurePage) return;

    const coords = screenToPdfCoords(e.clientX, e.clientY);
    
    // Check if clicking on an existing box (if not already handled by box's onMouseDown)
    // Actually, box interaction should be handled on the box element itself to prevent propagation issues
    // But if we click empty space, we start drawing
    setStartPoint(coords);
    setInteractionMode("drawing");
    setSelectedBoxId(null); // Deselect when clicking background
  };

  const handleBoxMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent background click
    setSelectedBoxId(id);
    setActiveBoxId(id);
    setInteractionMode("moving");
    
    const coords = screenToPdfCoords(e.clientX, e.clientY);
    setStartPoint(coords);
  };

  const handleResizeMouseDown = (e: React.MouseEvent, id: string, handle: ResizeHandle) => {
    e.stopPropagation();
    setSelectedBoxId(id);
    setActiveBoxId(id);
    setActiveHandle(handle);
    setInteractionMode("resizing");
    
    const coords = screenToPdfCoords(e.clientX, e.clientY);
    setStartPoint(coords);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (interactionMode === "none" || !startPoint) return;

    const currentCoords = screenToPdfCoords(e.clientX, e.clientY);

    if (interactionMode === "drawing") {
      const x = Math.min(startPoint.x, currentCoords.x);
      const width = Math.abs(currentCoords.x - startPoint.x);
      // For Y, in PDF coords (0 at bottom), logic is a bit different
      // StartY and CurrentY are both from bottom.
      // If StartY > CurrentY, we are dragging DOWN visually.
      // The box bottom is min(StartY, CurrentY)
      const y = Math.min(startPoint.y, currentCoords.y);
      const height = Math.abs(currentCoords.y - startPoint.y);

      setTempRect({ x, y, width, height });
    } else if (interactionMode === "moving" && activeBoxId) {
      const dx = currentCoords.x - startPoint.x;
      const dy = currentCoords.y - startPoint.y; // Y is up

      setSignatureBoxes(prev => prev.map(box => {
        if (box.id === activeBoxId) {
          return {
            ...box,
            x: box.x + dx,
            y: box.y + dy,
          };
        }
        return box;
      }));
      setStartPoint(currentCoords); // Reset start point for relative move
    } else if (interactionMode === "resizing" && activeBoxId && activeHandle) {
       const dx = currentCoords.x - startPoint.x;
       const dy = currentCoords.y - startPoint.y;

       setSignatureBoxes(prev => prev.map(box => {
         if (box.id !== activeBoxId) return box;
         
         let { x, y, width, height } = box;
         
         // Logic depends on handle.
         // Remember: Y is from BOTTOM. 
         // Top edge is y + height. Bottom edge is y.
         // Left edge is x. Right edge is x + width.
         
         if (activeHandle.includes('e')) { // East (Right)
            width += dx;
         }
         if (activeHandle.includes('w')) { // West (Left)
            const newWidth = width - dx;
            if (newWidth > MIN_BOX_SIZE) {
                x += dx;
                width = newWidth;
            }
         }
         if (activeHandle.includes('n')) { // North (Top)
            height += dy;
         }
         if (activeHandle.includes('s')) { // South (Bottom)
            const newHeight = height - dy;
            if (newHeight > MIN_BOX_SIZE) {
                y += dy;
                height = newHeight;
            }
         }

         // Constraints
         if (width < MIN_BOX_SIZE) width = MIN_BOX_SIZE;
         if (height < MIN_BOX_SIZE) height = MIN_BOX_SIZE;
         
         return { ...box, x, y, width, height };
       }));
       setStartPoint(currentCoords);
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === "drawing" && tempRect) {
      if (tempRect.width > MIN_BOX_SIZE && tempRect.height > MIN_BOX_SIZE) {
        const newId = crypto.randomUUID();
        const newBox: SignaturePosition = {
          id: newId,
          page: currentPage,
          ...tempRect
        };
        setSignatureBoxes(prev => [...prev, newBox]);
        setSelectedBoxId(newId);
      }
    }

    setInteractionMode("none");
    setStartPoint(null);
    setTempRect(null);
    setActiveBoxId(null);
    setActiveHandle(null);
  };

  // Box Management
  const updateBoxMetadata = (id: string, field: keyof SignaturePosition, value: string) => {
    setSignatureBoxes(prev => prev.map(box => 
      box.id === id ? { ...box, [field]: value } : box
    ));
  };

  const removeBox = (id: string) => {
    setSignatureBoxes(prev => prev.filter(box => box.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // P8-1: keyboard placement. A default box at the signature block
  // position, stacked below any box already on this page.
  const addBoxAtSignatureBlock = () => {
    if (onEnclosurePage) return;
    const onThisPage = signatureBoxes.filter(b => b.page === currentPage).length;
    const newId = crypto.randomUUID();
    const newBox = clampBox({
      id: newId,
      page: currentPage,
      x: SIGNATURE_BLOCK_ANCHOR.x,
      y: SIGNATURE_BLOCK_ANCHOR.y - onThisPage * (DEFAULT_BOX.height + STACK_GAP),
      ...DEFAULT_BOX,
    });
    setSignatureBoxes(prev => [...prev, newBox]);
    setSelectedBoxId(newId);
    pendingFocus.current = newId;
  };

  // Arrow keys move by 4 pt (Shift: 16), Alt+arrows resize by the same
  // steps (Right/Down grow, Left/Up shrink), Delete removes, Enter and
  // Space toggle selection. Every handled key is consumed so the scroll
  // region and the dialog never see it.
  const handleBoxKeyDown = (e: React.KeyboardEvent, id: string) => {
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (e.key in arrows) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      setSignatureBoxes(prev => prev.map(box => {
        if (box.id !== id) return box;
        // Resizing: Right/Down widen and heighten, Left/Up narrow and
        // shorten, so the direction reads as "push the far edge".
        if (e.altKey) return clampBox({ ...box, width: box.width + dx, height: box.height - dy });
        return clampBox({ ...box, x: box.x + dx, y: box.y + dy });
      }));
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeBox(id);
      pendingFocus.current = "add";
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedBoxId(prev => (prev === id ? null : id));
    }
  };

  const selectedBox = signatureBoxes.find(b => b.id === selectedBoxId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background z-10">
          <div>
            <DialogTitle>Configure Signature Fields</DialogTitle>
            <DialogDescription>
              Draw, move, and resize signature boxes, or add one with the button and place it with the arrow keys. Add metadata for each signer.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={() => onConfirm(signatureBoxes)} disabled={signatureBoxes.length === 0}>
              Save Fields
            </Button>
            {onConfirmAndCopyLink && (
              <Button onClick={() => setShowRequestLinkDialog(true)} disabled={signatureBoxes.length === 0}>
                Save &amp; Copy Protected Request Link
              </Button>
            )}
          </div>
        </div>

        {onConfirmAndCopyLink && (
          <ShareLinkDialog
            open={showRequestLinkDialog}
            onOpenChange={setShowRequestLinkDialog}
            mode="signature-request"
            onCreate={async (options) => { await onConfirmAndCopyLink(signatureBoxes, options); }}
          />
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar for Metadata */}
          <div className="w-80 border-r bg-muted/10 flex flex-col overflow-y-auto interaction-ignore">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-1">Properties</h3>
              <p className="text-xs text-muted-foreground">Select a signature box to edit its details.</p>
            </div>

            {selectedBox ? (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signature-signer-name">Signer Name</Label>
                  <Input 
                    id="signature-signer-name"
                    value={selectedBox.signerName || ''} 
                    onChange={(e) => updateBoxMetadata(selectedBox.id, 'signerName', e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature-reason">Reason</Label>
                  <Input 
                    id="signature-reason"
                    value={selectedBox.reason || ''} 
                    onChange={(e) => updateBoxMetadata(selectedBox.id, 'reason', e.target.value)}
                    placeholder="e.g. I am approving this document"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature-contact-info">Contact Info</Label>
                  <Textarea 
                    id="signature-contact-info"
                    value={selectedBox.contactInfo || ''} 
                    onChange={(e) => updateBoxMetadata(selectedBox.id, 'contactInfo', e.target.value)}
                    placeholder="Email or Phone"
                    className="resize-none h-20"
                  />
                </div>
                <div className="pt-4 border-t">
                  <Button variant="destructive" size="sm" className="w-full" onClick={() => removeBox(selectedBox.id)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Field
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center h-64">
                <Move className="w-12 h-12 mb-4 opacity-20" />
                <p>No field selected</p>
                <p className="text-xs mt-2">Click on a signature box, or add one and press Enter, to edit</p>
              </div>
            )}

            <div className="mt-auto p-4 border-t">
               <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300 text-xs">Instructions</AlertTitle>
                <AlertDescription id={instructionsId} className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                  1. Click &amp; Drag to draw a new box, or press Add signature field.<br/>
                  2. Click a box, or Tab to it and press Enter, to select it.<br/>
                  3. Drag box to move, drag corners to resize.<br/>
                  4. Arrow keys move a focused box 4 pt (Shift: 16 pt); Alt+arrows resize; Delete removes.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Main Canvas Area */}
          <div className="flex-1 bg-muted/50 dark:bg-muted/20 overflow-hidden flex flex-col relative">
            
            {/* Toolbar */}
            <div className="h-12 border-b bg-background flex items-center justify-center gap-4 z-10 shadow-sm interaction-ignore">
               <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Previous page"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm font-medium w-44 text-center">
                  Page {currentPage} of {totalPages}
                  {onEnclosurePage && <span className="text-muted-foreground"> (enclosure)</span>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Next page"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  ref={addButtonRef}
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={addBoxAtSignatureBlock}
                  disabled={onEnclosurePage}
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add signature field
                </Button>
            </div>

            {/* ENC: enclosure pages are shown for context, never signed -
                fields ride request links and links never carry files. */}
            {onEnclosurePage && (
              <div role="note" className="border-b bg-amber-50 dark:bg-amber-950/40 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-200 interaction-ignore">
                Enclosure page, view only. Signature fields go on the letter (pages 1&ndash;{lastLetterPage}).
              </div>
            )}

            {/* PDF Render Area */}
            <div
              role="region"
              aria-label={`Document page ${currentPage} with signature fields`}
              tabIndex={0}
              className={cn("flex-1 overflow-auto flex justify-center p-8 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", onEnclosurePage ? "cursor-not-allowed" : "cursor-crosshair")}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div ref={containerRef} className="relative shadow-lg select-none" style={{ width: 'fit-content', height: 'fit-content' }}>
                {pdfUrl && (
                  <Document file={pdfUrl} loading={<div className="w-[612px] h-[792px] bg-white animate-pulse" />}>
                    <Page 
                      pageNumber={currentPage} 
                      width={PDF_WIDTH} // Fixed width for consistency
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onLoadSuccess={onPageLoadSuccess}
                    />
                  </Document>
                )}

                {/* Overlays */}
                {/* Temp Drawing Rect */}
                {tempRect && (
                  <div 
                    className="absolute border-2 border-green-500 bg-green-500/20 z-50 pointer-events-none"
                    style={getBoxStyle(tempRect)}
                  />
                )}

                {/* Existing Boxes */}
                {signatureBoxes.map((box, index) => ({ box, index })).filter(({ box }) => box.page === currentPage).map(({ box, index }) => (
                  <div
                    key={box.id}
                    ref={(el) => {
                      if (el) boxRefs.current.set(box.id, el);
                      else boxRefs.current.delete(box.id);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Signature field ${index + 1}, page ${box.page}`}
                    aria-pressed={selectedBoxId === box.id}
                    aria-describedby={instructionsId}
                    className={cn(
                      "absolute border-2 cursor-move group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selectedBoxId === box.id 
                        ? "border-blue-600 bg-blue-500/20 z-40" 
                        : "border-blue-400 bg-blue-400/10 z-30 hover:border-blue-500"
                    )}
                    style={getBoxStyle(box)}
                    onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
                    onKeyDown={(e) => handleBoxKeyDown(e, box.id)}
                  >
                    {/* Label */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-blue-700 pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-1">
                      {box.signerName ? box.signerName : "Signature"}
                    </div>

                    {/* Resize Handles (Only when selected) */}
                    {selectedBoxId === box.id && (
                      <>
                        <div 
                          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-600 cursor-nw-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'nw')}
                        />
                        <div 
                          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-600 cursor-ne-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'ne')}
                        />
                        <div 
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-600 cursor-sw-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'sw')}
                        />
                        <div 
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-600 cursor-se-resize"
                          onMouseDown={(e) => handleResizeMouseDown(e, box.id, 'se')}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
