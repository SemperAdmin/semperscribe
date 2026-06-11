"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Move, Download, Trash2, Maximize2, X, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { SignaturePosition } from "@/types";

// Dynamically import react-pdf to avoid SSR issues
const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });

// Configure PDF.js worker on client side only
if (typeof window !== "undefined") {
  import("react-pdf").then((pdfjs) => {
    pdfjs.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

// PDF page dimensions in points (8.5" x 11" at 72 DPI)
const PDF_WIDTH = 612;
const PDF_HEIGHT = 792;
const MIN_BOX_SIZE = 20;

interface SignaturePlacementModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (positions: SignaturePosition[]) => void;
  /** S2e: persist fields AND copy the signature request link in one step */
  onConfirmAndCopyLink?: (positions: SignaturePosition[]) => void;
  pdfBlob: Blob | null;
  totalPages: number;
}

type InteractionMode = "none" | "drawing" | "moving" | "resizing";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

export function SignaturePlacementModal({
  open,
  onClose,
  onConfirm,
  onConfirmAndCopyLink,
  pdfBlob,
  totalPages,
}: SignaturePlacementModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [signatureBoxes, setSignatureBoxes] = useState<SignaturePosition[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  
  // Interaction State
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("none");
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null); // For move/resize
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [tempRect, setTempRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Create object URL from blob
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfBlob]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPage(totalPages > 0 ? totalPages : 1); 
      setSignatureBoxes([]);
      setSelectedBoxId(null);
      setInteractionMode("none");
    }
  }, [open, totalPages]);

  // Handle page load to get dimensions
  const onPageLoadSuccess = useCallback(({ width, height }: { width: number; height: number }) => {
    setPageSize({ width, height });
  }, []);

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

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on a form input or button, ignore
    if ((e.target as HTMLElement).closest('.interaction-ignore')) return;

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

  const selectedBox = signatureBoxes.find(b => b.id === selectedBoxId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background z-10">
          <div>
            <DialogTitle>Configure Signature Fields</DialogTitle>
            <DialogDescription>
              Draw, move, and resize signature boxes. Add metadata for each signer.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="outline" onClick={() => onConfirm(signatureBoxes)} disabled={signatureBoxes.length === 0}>
              Save Fields
            </Button>
            {onConfirmAndCopyLink && (
              <Button onClick={() => onConfirmAndCopyLink(signatureBoxes)} disabled={signatureBoxes.length === 0}>
                Save &amp; Copy Request Link
              </Button>
            )}
          </div>
        </div>

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
                  <Label>Signer Name</Label>
                  <Input 
                    value={selectedBox.signerName || ''} 
                    onChange={(e) => updateBoxMetadata(selectedBox.id, 'signerName', e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input 
                    value={selectedBox.reason || ''} 
                    onChange={(e) => updateBoxMetadata(selectedBox.id, 'reason', e.target.value)}
                    placeholder="e.g. I am approving this document"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Info</Label>
                  <Textarea 
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
                <p className="text-xs mt-2">Click on a signature box to edit</p>
              </div>
            )}

            <div className="mt-auto p-4 border-t">
               <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300 text-xs">Instructions</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                  1. Click & Drag to draw a new box.<br/>
                  2. Click a box to select it.<br/>
                  3. Drag box to move, drag corners to resize.
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-32 text-center">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* PDF Render Area */}
            <div 
              className="flex-1 overflow-auto flex justify-center p-8 cursor-crosshair relative"
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
                {signatureBoxes.filter(b => b.page === currentPage).map((box) => (
                  <div
                    key={box.id}
                    className={cn(
                      "absolute border-2 cursor-move group transition-colors",
                      selectedBoxId === box.id 
                        ? "border-blue-600 bg-blue-500/20 z-40" 
                        : "border-blue-400 bg-blue-400/10 z-30 hover:border-blue-500"
                    )}
                    style={getBoxStyle(box)}
                    onMouseDown={(e) => handleBoxMouseDown(e, box.id)}
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
