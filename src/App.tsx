import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import TokenGate from "./pages/TokenGate.tsx";

// Heavy / rarely-visited pages are code-split so the first paint stays fast.
const OwnerPanel = lazy(() => import("./pages/OwnerPanel.tsx"));
const PublicWatch = lazy(() => import("./pages/PublicWatch.tsx"));
const MembershipPanel = lazy(() => import("./pages/MembershipPanel.tsx"));
const OwnerWatch = lazy(() => import("./pages/OwnerWatch.tsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const CatalogPage = lazy(() => import("./pages/CatalogPage.tsx"));
const TopUpPage = lazy(() => import("./pages/TopUpPage.tsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));
const ReplayPage = lazy(() => import("./pages/ReplayPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/watch/:token" element={<TokenGate />} />
            <Route path="/owner" element={<OwnerPanel />} />
            <Route path="/live" element={<PublicWatch />} />
            <Route path="/membership-live" element={<PublicWatch mode="membership" />} />
            <Route path="/trial-live" element={<PublicWatch mode="trial" />} />
            <Route path="/membership" element={<MembershipPanel />} />
            <Route path="/owner-watch" element={<OwnerWatch />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/topup" element={<TopUpPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
