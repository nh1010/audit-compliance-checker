import { useCallback, useState, type DragEvent } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface Props {
  label: string;
  description: string;
  accept?: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
  loading?: boolean;
}

export default function FileUpload({ label, description, accept = ".pdf", multiple = false, files, onFiles, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (dropped.length) onFiles(multiple ? [...files, ...dropped] : [dropped[0]]);
  }, [files, multiple, onFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onFiles(multiple ? [...files, ...selected] : [selected[0]]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    onFiles(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">{label}</h3>
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-text-faint hover:bg-surface"}
          ${loading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {loading ? (
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-text-faint" />
        )}
        <div className="text-center">
          <span className="text-sm font-medium text-primary">Click to upload</span>
          <span className="text-sm text-text-muted"> or drag and drop</span>
        </div>
        <p className="text-xs text-text-faint">{description}</p>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-border">
              <FileText className="w-4 h-4 text-text-faint shrink-0" />
              <span className="text-sm text-text truncate flex-1">{f.name}</span>
              <span className="text-xs text-text-faint">{(f.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-border rounded">
                <X className="w-3.5 h-3.5 text-text-faint" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
