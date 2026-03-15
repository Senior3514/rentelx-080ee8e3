import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/i18n/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { AccessibilityWidget } from "./components/AccessibilityWidget";

// Lazy load all page components for code-splitting
const Landing = lazy(() => import("./pages/Landing"));
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inbox = lazy(() => import("./pages/Inbox"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Profiles = lazy(() => import("./pages/Profiles"));
const Settings = lazy(() => import("./pages/Settings"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Compare = lazy(() => import("./pages/Compare"));
const Relocation = lazy(() => import("./pages/Relocation"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/onboarding" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Protected app routes */}
                  <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/listings/:id" element={<ListingDetail />} />
                    <Route path="/pipeline" element={<Pipeline />} />
                    <Route path="/watchlist" element={<Watchlist />} />
                    <Route path="/compare" element={<Compare />} />
                    <Route path="/relocation" element={<Relocation />} />
                    <Route path="/knowledge-base" element={<KnowledgeBase />} />
                    <Route path="/profiles" element={<Profiles />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <AccessibilityWidget />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
