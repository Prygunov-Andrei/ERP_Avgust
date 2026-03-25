'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenshotDropZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  compact?: boolean;
}

export function ScreenshotDropZone({ files, onFilesChange, compact }: ScreenshotDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const images = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
      if (images.length > 0) {
        onFilesChange([...files, ...images]);
      }
    },
    [files, onFilesChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        addFiles(imageFiles);
      }
    },
    [addFiles]
  );

  return (
    <div onPaste={handlePaste}>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, i) => (
            <div key={i} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-16 h-16 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`
          border border-dashed rounded-md transition-colors cursor-pointer
          ${compact ? 'p-2' : 'p-3'}
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
        `}
        onClick={() => inputRef.current?.click()}
      >
        <div className={`flex items-center gap-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
          <ImagePlus className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          <span>Перетащите скриншот или нажмите для выбора</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) {
              addFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
