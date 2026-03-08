import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Trash2,
  Brain,
  Plus,
} from "lucide-react";

type Document = {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
  storage_path: string;
  extracted_text?: string | null;
};

interface KnowledgeSidebarProps {
  documents: Document[];
  onRefresh: () => void;
}

const KnowledgeSidebar = ({ documents, onRefresh }: KnowledgeSidebarProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const isPdf = ext === "pdf";
        const isImage = ["jpg", "jpeg", "png"].includes(ext || "");

        if (!isPdf && !isImage) {
          toast.error(`Unsupported file: ${file.name}. Use PDF, JPG, or PNG.`);
          continue;
        }

        const storagePath = `guest/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file);

        if (uploadError) throw uploadError;

        // Insert document record with "processing" status for images
        const { data: docData, error: dbError } = await supabase
          .from("documents")
          .insert({
            filename: file.name,
            file_type: isPdf ? "pdf" : "image",
            storage_path: storagePath,
            status: isImage ? "processing" : "ready",
            file_size: file.size,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        toast.success(`Uploaded ${file.name}`);
        onRefresh();

        // For images, trigger OCR extraction via edge function
        if (isImage && docData) {
          const { data: urlData } = supabase.storage
            .from("documents")
            .getPublicUrl(storagePath);

          try {
            const ocrResponse = await supabase.functions.invoke("ocr-extract", {
              body: {
                imageUrl: urlData.publicUrl,
                documentId: docData.id,
              },
            });

            if (ocrResponse.error) {
              console.error("OCR error:", ocrResponse.error);
              toast.error(`OCR failed for ${file.name}`);
            } else {
              toast.success(`Text extracted from ${file.name}`);
            }
            onRefresh();
          } catch (ocrErr) {
            console.error("OCR invoke error:", ocrErr);
            toast.error(`OCR failed for ${file.name}`);
            onRefresh();
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
      toast.success("Deleted");
      onRefresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="w-72 h-screen flex flex-col bg-[hsl(var(--sidebar-background))] border-r border-border/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">RAG Assistant</h1>
            <p className="text-xs text-muted-foreground">AI Researcher</p>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
        <Button
          variant="outline"
          className="w-full border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Upload Files
        </Button>
      </div>

      {/* File List */}
      <div className="px-3 py-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Knowledge Base ({documents.length})
        </p>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              {doc.file_type === "pdf" ? (
                <FileText className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{doc.filename}</p>
                <div className="flex items-center gap-1">
              {doc.status === "ready" ? (
                    <CheckCircle2 className="w-3 h-3 status-ready" />
                  ) : (
                    <Loader2 className="w-3 h-3 status-processing animate-spin" />
                  )}
                  <span className={`text-xs ${doc.status === "ready" ? "status-ready" : "status-processing"}`}>
                    {doc.status === "ready" ? "Ready" : "Processing..."}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {documents.length === 0 && (
            <div className="text-center py-8">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No files yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default KnowledgeSidebar;
