import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search, ArrowLeft, FileText,
  BookOpen, Sparkles, Home, Zap, BarChart3, Filter, Columns,
  Globe, Shield, HelpCircle, ChevronRight
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

/* ── Built-in help articles ── */
interface HelpArticle {
  id: string;
  icon: React.ReactNode;
  titleEn: string;
  titleHe: string;
  categoryEn: string;
  categoryHe: string;
  contentEn: string;
  contentHe: string;
}

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    icon: <Home className="h-5 w-5 text-primary" />,
    titleEn: "Getting Started with RentelX",
    titleHe: "תחילת עבודה עם RentelX",
    categoryEn: "Basics",
    categoryHe: "בסיס",
    contentEn: `## Welcome to RentelX! 🏠

RentelX is your AI-powered apartment hunting co-pilot for Israel's rental market.

### Quick Start (3 Steps)

**1. Create a Search Profile**
Go to **Profiles** → Click "New Profile" → Set your preferences:
- Select cities (Tel Aviv, Givatayim, Ramat Gan, etc.)
- Set budget range (min/max monthly rent)
- Choose must-have amenities (parking, elevator, balcony, etc.)

**2. Add Listings**
- **Paste URL**: Copy any listing link (Yad2, Facebook, Madlan) → AI extracts all data automatically
- **Manual Entry**: Fill in listing details yourself
- **Watchlist Scan**: Auto-scan Yad2 for new listings matching your criteria

**3. Track & Compare**
- Each listing gets an AI **Match Score (0-100)** based on your profile
- Move listings through the **Pipeline** (New → Contacted → Viewed → ... → Signed)
- **Compare** listings side-by-side with AI insights`,
    contentHe: `## ברוכים הבאים ל-RentelX! 🏠

RentelX הוא עוזר חכם מבוסס AI לחיפוש דירות בישראל.

### התחלה מהירה (3 צעדים)

**1. צרו פרופיל חיפוש**
לכו ל**פרופילים** → לחצו "פרופיל חדש" → הגדירו העדפות:
- בחרו ערים (תל אביב, גבעתיים, רמת גן, וכו')
- הגדירו טווח תקציב (שכירות חודשית מינ'/מקס')
- בחרו מאפיינים חובה (חניה, מעלית, מרפסת, וכו')

**2. הוסיפו דירות**
- **הדבקת קישור**: העתיקו קישור מיד2, פייסבוק, מדלן → ה-AI שולף הכל אוטומטית
- **הזנה ידנית**: מלאו את פרטי הדירה בעצמכם
- **סריקת מעקב**: סריקה אוטומטית של יד2 לדירות חדשות

**3. עקבו והשוו**
- כל דירה מקבלת **ציון התאמה (0-100)** על בסיס הפרופיל שלכם
- העבירו דירות דרך ה**תהליך** (חדש → נוצר קשר → נצפה → ... → נחתם)
- **השוו** דירות זו מול זו עם תובנות AI`,
  },
  {
    id: "ai-extraction",
    icon: <Sparkles className="h-5 w-5 text-violet-500" />,
    titleEn: "AI Data Extraction (URL Paste)",
    titleHe: "שליפת נתונים עם AI (הדבקת קישור)",
    categoryEn: "AI Features",
    categoryHe: "תכונות AI",
    contentEn: `## How AI Extraction Works

When you paste a listing URL, RentelX's AI engine:

1. **Fetches the actual page** — Downloads the listing page content in real-time
2. **Analyzes the content** — AI reads the page text, metadata, and structured data
3. **Extracts key fields** — Address, price, rooms, sqm, floor, amenities, contact info
4. **Finds images** — Extracts listing photos from the page
5. **Returns structured data** — Clean, organized data ready to save

### Supported Sources
- **Yad2** (yad2.co.il) — Full support, all fields
- **Facebook** (facebook.com) — Groups & Marketplace posts
- **Madlan** (madlan.co.il) — Full listing data
- **Any URL** — Best-effort extraction from any rental listing page

### Tips for Best Results
- Use **direct links** to specific listings (not search results pages)
- For Facebook: use the public post link, not the group feed link
- If extraction misses some data, you can edit the listing manually after saving`,
    contentHe: `## איך שליפת AI עובדת

כשמדביקים קישור לדירה, מנוע ה-AI של RentelX:

1. **מוריד את הדף** — מוריד את תוכן דף המודעה בזמן אמת
2. **מנתח את התוכן** — ה-AI קורא את טקסט הדף, מטא-דאטה ונתונים מובנים
3. **מחלץ שדות מפתח** — כתובת, מחיר, חדרים, מ"ר, קומה, מאפיינים, פרטי קשר
4. **מוצא תמונות** — מחלץ תמונות מהדף
5. **מחזיר נתונים מסודרים** — נתונים נקיים ומאורגנים מוכנים לשמירה

### מקורות נתמכים
- **יד2** (yad2.co.il) — תמיכה מלאה, כל השדות
- **פייסבוק** (facebook.com) — פוסטים בקבוצות ומרקטפלייס
- **מדלן** (madlan.co.il) — נתוני מודעה מלאים
- **כל URL** — חילוץ מיטבי מכל דף מודעת שכירות

### טיפים לתוצאות מיטביות
- השתמשו ב**קישורים ישירים** למודעות ספציפיות (לא דפי חיפוש)
- לפייסבוק: השתמשו בקישור הפוסט הציבורי, לא בפיד הקבוצה
- אם החילוץ מפספס נתונים, ניתן לערוך את הדירה ידנית אחרי שמירה`,
  },
  {
    id: "watchlist-scanning",
    icon: <Zap className="h-5 w-5 text-amber-500" />,
    titleEn: "Watchlist & Auto-Scanning",
    titleHe: "רשימת מעקב וסריקה אוטומטית",
    categoryEn: "Scanning",
    categoryHe: "סריקה",
    contentEn: `## Real-Time General Scanning

The Watchlist performs a general scan of the Israeli rental market in real-time.

### How to Use
1. Go to **Watchlist** page
2. Select cities to scan (Tel Aviv, Givatayim, Ramat Gan, etc.)
3. Click **"Scan Now"** for immediate organized results
4. Toggle **"Auto-Scan"** for automatic scanning every 5 minutes

### Filters
- The scanner uses your **active search profile** to filter and score results
- Set price range, room count, and preferred cities in your profile
- Results are sorted by AI match score (highest first)

### Saving Listings
- Click the **+** button on any scan result to save it to your Inbox
- Saved listings are scored against all your active profiles
- Images, amenities, and all data are preserved`,
    contentHe: `## סריקה כללית בזמן אמת

רשימת המעקב מבצעת סריקה כללית של שוק השכירות הישראלי בזמן אמת.

### איך להשתמש
1. לכו לדף **רשימת מעקב**
2. בחרו ערים לסריקה (תל אביב, גבעתיים, רמת גן, וכו')
3. לחצו **"סרוק עכשיו"** לתוצאות מסודרות מיידיות
4. הפעילו **"סריקה אוטומטית"** לסריקה אוטומטית כל 5 דקות

### פילטרים
- הסורק משתמש ב**פרופיל החיפוש הפעיל** לסינון ודירוג
- הגדירו טווח מחירים, מספר חדרים וערים מועדפות בפרופיל
- התוצאות ממוינות לפי ציון התאמה (הגבוה ביותר קודם)

### שמירת דירות
- לחצו על כפתור ה-**+** בכל תוצאת סריקה לשמירה בתיבה
- דירות שנשמרות מדורגות כנגד כל הפרופילים הפעילים
- תמונות, מאפיינים וכל הנתונים נשמרים`,
  },
  {
    id: "scoring-system",
    icon: <BarChart3 className="h-5 w-5 text-green-500" />,
    titleEn: "AI Scoring System (0-100)",
    titleHe: "מערכת ציון AI (0-100)",
    categoryEn: "AI Features",
    categoryHe: "תכונות AI",
    contentEn: `## How Scoring Works

Every listing is scored 0-100 based on how well it matches your search profile.

### Score Breakdown
| Category | Weight | How it's calculated |
|----------|--------|-------------------|
| **City** | 30% | 100 if city matches your profile, 0 otherwise |
| **Price** | 30% | 100 if within budget, decreases with distance from range |
| **Rooms** | 20% | 100 if within range, -33% per room difference |
| **Amenities** | 20% | Must-haves weighted 2x more than nice-to-haves |

### Score Colors
- **80-100**: Excellent match — highly recommended
- **50-79**: Good match — worth considering
- **0-49**: Low match — may not meet your criteria

### Tips
- Create a detailed search profile for more accurate scores
- Set realistic price ranges for your target cities
- Mark the most important amenities as "must-have" (they count double)`,
    contentHe: `## איך הציון עובד

כל דירה מקבלת ציון 0-100 על בסיס התאמתה לפרופיל החיפוש שלכם.

### פירוט הציון
| קטגוריה | משקל | איך מחושב |
|----------|--------|-------------------|
| **עיר** | 30% | 100 אם העיר תואמת לפרופיל, 0 אחרת |
| **מחיר** | 30% | 100 אם בתקציב, יורד עם המרחק מהטווח |
| **חדרים** | 20% | 100 אם בטווח, -33% לכל הפרש חדר |
| **מאפיינים** | 20% | דרישות חובה שוקלות פי 2 מיתרונות |

### צבעי ציון
- **80-100**: התאמה מצוינת — מומלץ מאוד
- **50-79**: התאמה טובה — שווה בדיקה
- **0-49**: התאמה נמוכה — עשוי לא לענות על הקריטריונים

### טיפים
- צרו פרופיל חיפוש מפורט לציונים מדויקים יותר
- הגדירו טווח מחירים ריאלי לערים הרלוונטיות
- סמנו את המאפיינים החשובים ביותר כ"חובה" (הם נספרים כפול)`,
  },
  {
    id: "pipeline-management",
    icon: <Columns className="h-5 w-5 text-blue-500" />,
    titleEn: "Pipeline (Kanban Board)",
    titleHe: "תהליך (לוח קנבן)",
    categoryEn: "Features",
    categoryHe: "תכונות",
    contentEn: `## Track Your Apartment Search

The Pipeline gives you a visual Kanban board to track every listing through 7 stages:

### Stages
1. **New** — Just added, not yet reviewed
2. **Contacted** — You reached out to the landlord/agent
3. **Viewing Scheduled** — Apartment visit is planned
4. **Viewed** — You've seen the apartment
5. **Negotiating** — Discussing terms and price
6. **Application Sent** — You've submitted your application
7. **Signed** — Lease is signed!

### How to Use
- **Drag and drop** listings between stages
- Click a listing to see full details and AI analysis
- Use the score badge to quickly identify the best options
- Add **notes** and **reminders** to each listing`,
    contentHe: `## עקבו אחרי חיפוש הדירה

התהליך מעניק לכם לוח קנבן ויזואלי לעקוב אחרי כל דירה ב-7 שלבים:

### שלבים
1. **חדש** — רק נוסף, טרם נבדק
2. **נוצר קשר** — יצרתם קשר עם המשכיר/סוכן
3. **סיור מתוכנן** — תואם ביקור בדירה
4. **נצפה** — ראיתם את הדירה
5. **משא ומתן** — דנים בתנאים ובמחיר
6. **בקשה נשלחה** — שלחתם את המועמדות
7. **נחתם** — החוזה נחתם!

### איך להשתמש
- **גררו ושחררו** דירות בין שלבים
- לחצו על דירה לפרטים מלאים וניתוח AI
- השתמשו בתג הציון לזיהוי מהיר של האפשרויות הטובות
- הוסיפו **הערות** ו**תזכורות** לכל דירה`,
  },
  {
    id: "compare-listings",
    icon: <Filter className="h-5 w-5 text-orange-500" />,
    titleEn: "Comparing Listings",
    titleHe: "השוואת דירות",
    categoryEn: "Features",
    categoryHe: "תכונות",
    contentEn: `## Side-by-Side Comparison

Compare multiple listings to make the best decision.

### How to Use
1. Go to **Compare** page
2. Select listings from your inbox
3. View side-by-side: price, rooms, sqm, score, amenities
4. Click **"Analyze with AI"** for a detailed comparison summary

### Filters & Sorting
- Filter by city, minimum score
- Sort by score, price, rooms, or size
- Search by address or city name

### AI Analysis
The AI comparison provides:
- Which listing offers the best value
- Key differences between listings
- Recommendations based on your profile`,
    contentHe: `## השוואה זו מול זו

השוו מספר דירות לקבלת ההחלטה הטובה ביותר.

### איך להשתמש
1. לכו לדף **השוואה**
2. בחרו דירות מהתיבה שלכם
3. צפו בהשוואה: מחיר, חדרים, מ"ר, ציון, מאפיינים
4. לחצו **"נתח עם AI"** לסיכום השוואתי מפורט

### פילטרים ומיון
- סננו לפי עיר, ציון מינימלי
- מיינו לפי ציון, מחיר, חדרים או גודל
- חפשו לפי כתובת או שם עיר

### ניתוח AI
ניתוח ה-AI מספק:
- איזו דירה מציעה את הערך הטוב ביותר
- הבדלים עיקריים בין הדירות
- המלצות על בסיס הפרופיל שלכם`,
  },
  {
    id: "languages-rtl",
    icon: <Globe className="h-5 w-5 text-cyan-500" />,
    titleEn: "Languages & RTL Support",
    titleHe: "שפות ותמיכת RTL",
    categoryEn: "Settings",
    categoryHe: "הגדרות",
    contentEn: `## Multilingual Support

RentelX supports 3 languages with full RTL layout:

### Supported Languages
- **English** (LTR)
- **Hebrew** (RTL) — with Rubik font
- **Spanish** (LTR)

### How to Switch
Click the language toggle (EN/עב) in the top navigation bar.

### RTL Support
- Full right-to-left layout for Hebrew
- All icons and directional elements flip automatically
- Logical CSS properties ensure correct spacing in both directions`,
    contentHe: `## תמיכה רב-שפתית

RentelX תומך ב-3 שפות עם תצוגת RTL מלאה:

### שפות נתמכות
- **אנגלית** (LTR)
- **עברית** (RTL) — עם גופן Rubik
- **ספרדית** (LTR)

### איך להחליף
לחצו על כפתור השפה (EN/עב) בסרגל הניווט העליון.

### תמיכת RTL
- תצוגה מלאה מימין לשמאל בעברית
- כל האייקונים והאלמנטים הכיווניים מתהפכים אוטומטית
- מאפייני CSS לוגיים מבטיחים ריווח נכון בשני הכיוונים`,
  },
  {
    id: "security-privacy",
    icon: <Shield className="h-5 w-5 text-red-500" />,
    titleEn: "Security & Privacy",
    titleHe: "אבטחה ופרטיות",
    categoryEn: "Security",
    categoryHe: "אבטחה",
    contentEn: `## Your Data is Protected

### Security Features
- **Row-Level Security (RLS)** — Your data is visible only to you
- **Rate-limited authentication** — Protection against brute-force attacks
- **Input sanitization** — XSS and injection protection
- **Secure redirects** — No open redirect vulnerabilities

### Data Privacy
- All listing data is stored in your personal account
- No data is shared between users
- You can delete your data at any time
- AI analysis is processed through secure APIs`,
    contentHe: `## המידע שלכם מוגן

### תכונות אבטחה
- **אבטחה ברמת שורה (RLS)** — המידע שלכם גלוי רק לכם
- **הגבלת ניסיונות הזדהות** — הגנה מפני התקפות כוח גס
- **ניקוי קלט** — הגנה מ-XSS והזרקות
- **ניתוב מאובטח** — ללא פגיעויות הפניה פתוחה

### פרטיות מידע
- כל נתוני הדירות מאוחסנים בחשבון האישי שלכם
- אין שיתוף מידע בין משתמשים
- ניתן למחוק את המידע בכל עת
- ניתוח AI מעובד דרך APIs מאובטחים`,
  },
];

export default function KnowledgeBase() {
  const { t, language, direction } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Filter help articles by search
  const filteredArticles = searchQuery.trim()
    ? HELP_ARTICLES.filter((a) => {
        const q = searchQuery.toLowerCase();
        const title = language === "he" ? a.titleHe : a.titleEn;
        const content = language === "he" ? a.contentHe : a.contentEn;
        const category = language === "he" ? a.categoryHe : a.categoryEn;
        return title.toLowerCase().includes(q)
          || content.toLowerCase().includes(q)
          || category.toLowerCase().includes(q);
      })
    : HELP_ARTICLES;

  const selectedArticle = selectedArticleId
    ? HELP_ARTICLES.find((a) => a.id === selectedArticleId) ?? null
    : null;

  // Article detail view
  if (selectedArticle) {
    const content = language === "he" ? selectedArticle.contentHe : selectedArticle.contentEn;
    return (
      <div className="p-6 max-w-4xl mx-auto" dir={direction}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedArticleId(null)}
          className="mb-4 gap-1"
        >
          <ArrowLeft className="h-4 w-4 flip-rtl" />
          {t("common.back")}
        </Button>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                {selectedArticle.icon}
                {language === "he" ? selectedArticle.titleHe : selectedArticle.titleEn}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {language === "he" ? selectedArticle.categoryHe : selectedArticle.categoryEn}
              </span>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed">
                {content.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(3)}</h2>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
                  if (line.startsWith("- ")) return <li key={i} className="ms-4 text-sm">{renderBold(line.slice(2))}</li>;
                  if (line.startsWith("| ")) return <p key={i} className="text-sm font-mono text-xs bg-muted/50 px-2 py-0.5 rounded">{line}</p>;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-sm leading-relaxed">{renderBold(line)}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Main view
  return (
    <div className="p-6 max-w-4xl mx-auto" dir={direction}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <PageHeader
          title={t("knowledgeBase.title")}
          subtitle={language === "he"
            ? "מדריכים ועזרה — הכל במקום אחד"
            : "Guides & help — all in one place"}
        />
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "he" ? "חפשו מדריכים, עזרה..." : "Search guides, help..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-9"
        />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-3"
      >
        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {language === "he" ? "לא נמצאו תוצאות" : "No results found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredArticles.map((article) => (
            <motion.div key={article.id} variants={item} layout>
              <Card
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 group"
                onClick={() => setSelectedArticleId(article.id)}
              >
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    {article.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {language === "he" ? article.titleHe : article.titleEn}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {language === "he" ? article.categoryHe : article.categoryEn}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors flip-rtl" />
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}

/* ── Helper: render bold text (**text**) ── */
function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
