import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Book, Search, ArrowLeft, ExternalLink, Clock, FileText, Database, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listKnowledgeBasePages,
  getKnowledgeBasePage,
  searchKnowledgeBase,
  getKnowledgeBaseDatabaseId,
  setKnowledgeBaseDatabaseId,
  type NotionPage,
  type NotionPageContent,
} from "@/lib/notionService";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function KnowledgeBase() {
  const { t } = useLanguage();
  const [dbId, setDbId] = useState(getKnowledgeBaseDatabaseId() ?? "");
  const [dbIdInput, setDbIdInput] = useState(dbId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const isConfigured = Boolean(dbId);

  // List pages from the database
  const {
    data: pages,
    isLoading: pagesLoading,
    error: pagesError,
  } = useQuery({
    queryKey: ["notion-kb-pages", dbId, searchQuery],
    queryFn: () => {
      if (searchQuery.trim()) {
        return searchKnowledgeBase(searchQuery);
      }
      return listKnowledgeBasePages(dbId, undefined);
    },
    enabled: isConfigured,
    staleTime: 60_000,
  });

  // Load selected page content
  const {
    data: pageContent,
    isLoading: pageLoading,
  } = useQuery({
    queryKey: ["notion-kb-page", selectedPageId],
    queryFn: () => getKnowledgeBasePage(selectedPageId!),
    enabled: Boolean(selectedPageId),
    staleTime: 120_000,
  });

  function handleConnect() {
    const trimmed = dbIdInput.trim();
    if (!trimmed) return;
    setKnowledgeBaseDatabaseId(trimmed);
    setDbId(trimmed);
  }

  function handleDisconnect() {
    localStorage.removeItem("rentelx_notion_db_id");
    setDbId("");
    setDbIdInput("");
    setSelectedPageId(null);
  }

  // Setup screen
  if (!isConfigured) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <PageHeader
          title={t("knowledgeBase.title")}
          subtitle={t("knowledgeBase.subtitle")}
        />
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              {t("knowledgeBase.connectNotion")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("knowledgeBase.connectInstructions")}
            </p>
            <ol className="text-sm text-muted-foreground list-decimal ps-5 space-y-2">
              <li>{t("knowledgeBase.step1")}</li>
              <li>{t("knowledgeBase.step2")}</li>
              <li>{t("knowledgeBase.step3")}</li>
            </ol>
            <div className="flex gap-2">
              <Input
                placeholder={t("knowledgeBase.dbIdPlaceholder")}
                value={dbIdInput}
                onChange={(e) => setDbIdInput(e.target.value)}
                className="font-mono text-sm"
              />
              <Button onClick={handleConnect} disabled={!dbIdInput.trim()}>
                {t("knowledgeBase.connect")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Page detail view
  if (selectedPageId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedPageId(null)}
          className="mb-4 gap-1"
        >
          <ArrowLeft className="h-4 w-4 flip-rtl" />
          {t("common.back")}
        </Button>

        {pageLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pageContent ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    {pageContent.icon && <span>{pageContent.icon}</span>}
                    {pageContent.title}
                  </CardTitle>
                  {pageContent.url && (
                    <a
                      href={pageContent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("knowledgeBase.lastEdited")}: {new Date(pageContent.lastEdited).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {pageContent.content || (
                    <p className="text-muted-foreground italic">{t("knowledgeBase.emptyPage")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </div>
    );
  }

  // Pages list view
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          icon={Book}
          title={t("knowledgeBase.title")}
          subtitle={t("knowledgeBase.subtitle")}
        />
        <Button variant="outline" size="sm" onClick={handleDisconnect}>
          {t("knowledgeBase.disconnect")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("knowledgeBase.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Content */}
      {pagesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pagesError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{t("knowledgeBase.error")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pagesError instanceof Error ? pagesError.message : String(pagesError)}
            </p>
          </CardContent>
        </Card>
      ) : !pages?.length ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t("knowledgeBase.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("knowledgeBase.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-3"
        >
          <AnimatePresence>
            {pages.map((page: NotionPage) => (
              <motion.div key={page.id} variants={item} layout>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="text-2xl shrink-0 w-8 text-center">
                      {page.icon ?? <FileText className="h-5 w-5 text-muted-foreground mx-auto" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{page.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(page.lastEdited).toLocaleDateString()}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
