"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageSelectorProps {
  onImagesSelected: (images: string[]) => void;
  maxImages: number;
}

// Check if file is HEIC/HEIF format
function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif")
  );
}

// Convert HEIC to JPEG using heic2any (dynamically imported to avoid SSR issues)
async function convertHeicToJpeg(file: File): Promise<File> {
  console.log("Converting HEIC file:", file.name);

  // Dynamically import heic2any only on client side
  const heic2any = (await import("heic2any")).default;

  const blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.8,
  });

  // heic2any can return a single blob or array of blobs
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;

  // Create a new File from the blob
  const convertedFile = new File(
    [resultBlob],
    file.name.replace(/\.(heic|heif)$/i, ".jpg"),
    { type: "image/jpeg" }
  );
  console.log("HEIC conversion complete:", convertedFile.name);
  return convertedFile;
}

// Compress and resize image to reduce size for socket transmission
function compressImage(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for consistent format and smaller size
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function ImageSelector({
  onImagesSelected,
  maxImages,
}: ImageSelectorProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    const newImages: string[] = [];
    const failedFiles: string[] = [];

    for (const file of files) {
      if (selectedImages.length + newImages.length >= maxImages) break;

      try {
        let processableFile = file;

        // Convert HEIC/HEIF to JPEG first
        if (isHeicFile(file)) {
          console.log("Detected HEIC file, converting:", file.name);
          processableFile = await convertHeicToJpeg(file);
        }

        // Now compress the image (either original or converted)
        if (processableFile.type.startsWith("image/")) {
          const compressed = await compressImage(processableFile);
          newImages.push(compressed);
          console.log("Successfully processed:", file.name);
        }
      } catch (error) {
        console.error("Failed to process image:", file.name, error);
        failedFiles.push(file.name);
      }
    }

    if (failedFiles.length > 0) {
      alert(
        `Some files couldn't be processed:\n${failedFiles.join(
          ", "
        )}\n\nPlease try different images.`
      );
    }

    const allImages = [...selectedImages, ...newImages].slice(0, maxImages);
    setSelectedImages(allImages);
    onImagesSelected(allImages);
    setIsProcessing(false);

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    onImagesSelected(newImages);
  };

  const remaining = maxImages - selectedImages.length;

  return (
    <Card className="w-full max-w-2xl mx-auto fun-card overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="title-gradient">Select Your Photos</span>
          <span
            className={`text-sm font-normal px-3 py-1 rounded-full ${
              selectedImages.length === maxImages
                ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300"
                : "bg-primary/10 text-primary"
            }`}
          >
            {selectedImages.length}/{maxImages}
          </span>
        </CardTitle>

        {/* Progress indicator */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-3">
          <div
            className="h-full progress-bar-glow transition-all duration-300"
            style={{ width: `${(selectedImages.length / maxImages) * 100}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing && (
          <div className="text-center py-8 space-y-4">
            <div className="animate-spin w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full mx-auto"></div>
            <div className="space-y-1">
              <p className="font-medium">Processing images...</p>
              <p className="text-sm text-muted-foreground">
                Converting & compressing (HEIC files may take a moment)
              </p>
            </div>
          </div>
        )}

        {/* Image grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {selectedImages.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-all image-thumbnail group animate-bounce-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <img
                src={image}
                alt={`Selected ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Number badge */}
              <div className="absolute top-2 left-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {index + 1}
              </div>
              {/* Remove button */}
              <button
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                ×
              </button>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}

          {/* Add more placeholder */}
          {selectedImages.length < maxImages && !isProcessing && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square border-3 border-dashed border-primary/40 hover:border-primary rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-all group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">
                +
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {remaining} more
              </span>
            </button>
          )}
        </div>

        {/* Action buttons */}
        {selectedImages.length < maxImages && !isProcessing && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-14 text-lg fun-button bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
            variant="default"
          >
            Choose Photos ({remaining} remaining)
          </Button>
        )}

        {selectedImages.length === maxImages && (
          <div className="text-center py-4 px-6 rounded-xl bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30">
            <p className="font-bold text-green-700 dark:text-green-300">
              All photos selected! Uploading...
            </p>
          </div>
        )}

        {/* Tips */}
        {selectedImages.length < maxImages && !isProcessing && (
          <div className="text-center text-sm text-muted-foreground pt-2">
            <p>
              <strong>Tip:</strong> Pick photos that are uniquely you - the more
              personal, the harder to guess!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
