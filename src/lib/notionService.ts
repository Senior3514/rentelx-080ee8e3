import { supabase } from "@/integrations/supabase/client";

export interface NotionPage {
  id: string;
  title: string;
  icon: string | null;
  cover: string | null;
  lastEdited: string;
  createdAt?: string;
  url: string;
}

export interface NotionPageContent extends NotionPage {
  content: string;
}

export interface NotionSearchResult {
  id: string;
  title: string;
  icon: string | null;
  lastEdited: string;
  url: string;
}

/** List pages from the configured Notion knowledge base database */
export async function listKnowledgeBasePages(
  databaseId: string,
  query?: string
): Promise<NotionPage[]> {
  const { data, error } = await supabase.functions.invoke("notion-kb", {
    body: { action: "list", databaseId, query },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.pages as NotionPage[];
}

/** Get a single page's content rendered as markdown */
export async function getKnowledgeBasePage(
  pageId: string
): Promise<NotionPageContent> {
  const { data, error } = await supabase.functions.invoke("notion-kb", {
    body: { action: "page", pageId },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as NotionPageContent;
}

/** Search across all accessible Notion pages */
export async function searchKnowledgeBase(
  query: string
): Promise<NotionSearchResult[]> {
  const { data, error } = await supabase.functions.invoke("notion-kb", {
    body: { action: "search", query },
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.results as NotionSearchResult[];
}

/** Default database ID — set via env or Settings page */
export function getKnowledgeBaseDatabaseId(): string | null {
  return localStorage.getItem("rentelx_notion_db_id");
}

export function setKnowledgeBaseDatabaseId(id: string): void {
  localStorage.setItem("rentelx_notion_db_id", id);
}
