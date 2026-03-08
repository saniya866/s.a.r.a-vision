import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import KnowledgeSidebar from "@/components/KnowledgeSidebar";
import ChatInterface from "@/components/ChatInterface";

type Document = {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
  storage_path: string;
  extracted_text?: string | null;
};

const Index = () => {
  const [documents, setDocuments] = useState<Document[]>([]);

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <KnowledgeSidebar documents={documents} onRefresh={fetchDocuments} />
      <ChatInterface documents={documents} />
    </div>
  );
};

export default Index;
