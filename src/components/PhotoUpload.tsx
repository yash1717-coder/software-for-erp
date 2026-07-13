import React, { useState, useRef } from 'react';
import { Icon } from './Icons';

interface PhotoUploadProps {
  onUpload: (base64: string) => void;
  label?: string;
  required?: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onUpload,
  label = 'ATTACH PHOTO PROOF',
  required = false
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64String = ev.target?.result as string;
      setPreview(base64String);
      onUpload(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleContainerClick = () => {
    fileRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      
      <div
        onClick={handleContainerClick}
        className="border-2 border-dashed border-cyan-500/20 hover:border-cyan-400/50 bg-cyan-500/2 rounded p-5 text-center cursor-pointer transition-all duration-200"
      >
        {preview ? (
          <div className="relative group">
            <img
              src={preview}
              alt="Proof preview"
              className="max-h-48 mx-auto rounded border border-cyan-500/20 object-contain"
            />
            <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
              <span className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase">Click to Swap Snapped Photo</span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 font-mono text-xs py-3">
            <div className="flex justify-center mb-2.5">
              <Icon name="upload" size={24} color="var(--neon-cyan)" className="opacity-40 animate-pulse" />
            </div>
            <div>SNAP OR ATTACH FIELD PROOF IMAGE</div>
            <div className="text-[10px] text-slate-600 mt-1 uppercase">Supports JPG, PNG, WEBP (Camera capture enabled)</div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
