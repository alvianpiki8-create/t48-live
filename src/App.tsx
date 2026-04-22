import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import OwnerPanel from "./pages/OwnerPanel.tsx";
import TokenGate from "./pages/TokenGate.tsx";
import PublicWatch from "./pages/PublicWatch.tsx";
import MembershipPanel from "./pages/MembershipPanel.tsx";
import OwnerWatch from "./pages/OwnerWatch.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import CatalogPage from "./pages/CatalogPage.tsx";
import TopUpPage from "./pages/TopUpPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
