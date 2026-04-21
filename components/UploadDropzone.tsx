'use client';

import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onFile: (file: File) => void;
  accept?: Record<string, string[]>;
  busy?: boolean;
  label?: string;
}

export function UploadDropzone({ onFile, accept, busy, label }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files[0]) onFile(files[0]); },
    accept: accept ?? { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    disabled: busy
  });
  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center cursor-pointer transition',
        isDragActive ? 'border-primary bg-accent' : 'border-muted-foreground/30 hover:bg-muted/30',
        busy && 'opacity-60 pointer-events-none'
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{label ?? '파일을 끌어오거나 클릭하여 선택'}</div>
      <div className="text-xs text-muted-foreground">.xlsx · 50MB 이하</div>
    </div>
  );
}
