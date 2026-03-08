import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const fetchDocuments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setDocuments(data);
  };

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <KnowledgeSidebar documents={documents} onRefresh={fetchDocuments} />
      <ChatInterface documents={documents} />
    </div>
  );
};

export default Index;
