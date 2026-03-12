import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageGalleryProps {
  images: string[];
}

export const ImageGallery = ({ images }: ImageGalleryProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-muted/50 rounded-xl">
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No images</p>
        </div>
      </div>
    );
  }

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const prev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setActiveIndex((i) => (i + 1) % images.length);

  return (
    <>
      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.slice(0, 6).map((url, i) => (
          <div
            key={i}
            className="relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer group"
            onClick={() => openLightbox(i)}
          >
            <img
              src={url}
              alt={`Listing photo ${i + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {i === 5 && images.length > 6 && (
              <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">+{images.length - 6}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-background/95 backdrop-blur-xl border-none">
          <div className="relative flex items-center justify-center min-h-[60vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 end-2 z-10 text-foreground"
              onClick={() => setLightboxOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>

            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute start-2 top-1/2 -translate-y-1/2 z-10"
                  onClick={prev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute end-2 top-1/2 -translate-y-1/2 z-10"
                  onClick={next}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.img
                key={activeIndex}
                src={images[activeIndex]}
                alt={`Photo ${activeIndex + 1}`}
                className="max-h-[80vh] max-w-full object-contain rounded-lg"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              />
            </AnimatePresence>

            {images.length > 1 && (
              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                    onClick={() => setActiveIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
