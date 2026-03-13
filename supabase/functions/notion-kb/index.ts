import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin =
    ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  const token = Deno.env.get("NOTION_API_KEY");
  if (!token) throw new Error("NOTION_API_KEY is not configured");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

function extractPlainText(richText: Array<{ plain_text: string }>): string {
  return richText?.map((t) => t.plain_text).join("") ?? "";
}

function blockToMarkdown(block: NotionBlock): string {
  const type = block.type;
  const data = block[type] as { rich_text?: Array<{ plain_text: string }>; children?: NotionBlock[] } | undefined;
  if (!data) return "";

  const text = extractPlainText(data.rich_text ?? []);

  switch (type) {
    case "paragraph":
      return text ? `${text}\n` : "";
    case "heading_1":
      return `# ${text}\n`;
    case "heading_2":
      return `## ${text}\n`;
    case "heading_3":
      return `### ${text}\n`;
    case "bulleted_list_item":
      return `- ${text}\n`;
    case "numbered_list_item":
      return `1. ${text}\n`;
    case "to_do": {
      const checked = (block[type] as { checked?: boolean })?.checked;
      return `- [${checked ? "x" : " "}] ${text}\n`;
    }
    case "toggle":
      return `<details><summary>${text}</summary></details>\n`;
    case "code": {
      const lang = (block[type] as { language?: string })?.language ?? "";
      return `\`\`\`${lang}\n${text}\n\`\`\`\n`;
    }
    case "quote":
      return `> ${text}\n`;
    case "divider":
      return "---\n";
    case "callout": {
      const icon = (block[type] as { icon?: { emoji?: string } })?.icon?.emoji ?? "";
      return `> ${icon} ${text}\n`;
    }
    default:
      return text ? `${text}\n` : "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { action, databaseId, pageId, query } = await req.json();

    switch (action) {
      // List pages from a Notion database
      case "list": {
        if (!databaseId) throw new Error("databaseId is required for list action");
        const body: Record<string, unknown> = { page_size: 50 };
        if (query) {
          body.filter = {
            property: "title",
            title: { contains: query },
          };
        }
        body.sorts = [{ timestamp: "last_edited_time", direction: "descending" }];

        const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
          method: "POST",
          headers: notionHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error("Notion list error:", res.status, err);
          throw new Error(`Notion API error: ${res.status}`);
        }
        const data = await res.json();

        const pages = data.results.map((page: Record<string, unknown>) => {
          const props = page.properties as Record<string, { title?: Array<{ plain_text: string }>; [k: string]: unknown }>;
          const titleProp = Object.values(props).find((p) => p.title);
          const title = titleProp ? extractPlainText(titleProp.title ?? []) : "Untitled";
          const icon = (page.icon as { emoji?: string })?.emoji ?? null;
          const cover = (page.cover as { external?: { url: string }; file?: { url: string } })?.external?.url
            ?? (page.cover as { file?: { url: string } })?.file?.url
            ?? null;

          return {
            id: page.id,
            title,
            icon,
            cover,
            lastEdited: (page as { last_edited_time?: string }).last_edited_time,
            createdAt: (page as { created_time?: string }).created_time,
            url: (page as { url?: string }).url,
          };
        });

        return new Response(JSON.stringify({ pages }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Get a single page's content (blocks → markdown)
      case "page": {
        if (!pageId) throw new Error("pageId is required for page action");

        // Fetch page metadata
        const pageRes = await fetch(`${NOTION_API}/pages/${pageId}`, {
          headers: notionHeaders(),
        });
        if (!pageRes.ok) throw new Error(`Notion page error: ${pageRes.status}`);
        const pageData = await pageRes.json();

        const props = pageData.properties as Record<string, { title?: Array<{ plain_text: string }> }>;
        const titleProp = Object.values(props).find((p) => p.title);
        const title = titleProp ? extractPlainText(titleProp.title ?? []) : "Untitled";

        // Fetch blocks (content)
        const blocksRes = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
          headers: notionHeaders(),
        });
        if (!blocksRes.ok) throw new Error(`Notion blocks error: ${blocksRes.status}`);
        const blocksData = await blocksRes.json();

        const markdown = blocksData.results
          .map((block: NotionBlock) => blockToMarkdown(block))
          .join("\n");

        return new Response(
          JSON.stringify({
            id: pageData.id,
            title,
            icon: pageData.icon?.emoji ?? null,
            lastEdited: pageData.last_edited_time,
            content: markdown,
            url: pageData.url,
          }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          }
        );
      }

      // Search across all accessible Notion pages
      case "search": {
        const res = await fetch(`${NOTION_API}/search`, {
          method: "POST",
          headers: notionHeaders(),
          body: JSON.stringify({
            query: query ?? "",
            filter: { value: "page", property: "object" },
            sort: { direction: "descending", timestamp: "last_edited_time" },
            page_size: 20,
          }),
        });
        if (!res.ok) throw new Error(`Notion search error: ${res.status}`);
        const data = await res.json();

        const results = data.results.map((page: Record<string, unknown>) => {
          const props = page.properties as Record<string, { title?: Array<{ plain_text: string }> }>;
          const titleProp = Object.values(props).find((p) => p.title);
          const title = titleProp ? extractPlainText(titleProp.title ?? []) : "Untitled";
          return {
            id: page.id,
            title,
            icon: (page.icon as { emoji?: string })?.emoji ?? null,
            lastEdited: (page as { last_edited_time?: string }).last_edited_time,
            url: (page as { url?: string }).url,
          };
        });

        return new Response(JSON.stringify({ results }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("notion-kb error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
