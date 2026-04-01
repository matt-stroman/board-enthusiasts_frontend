import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { appConfig, landingPrivacyRoute, LandingShell, ProtectedRoute, Shell } from "../app-core";
import { BrowsePage, StudioDetailPage, TitleDetailPage } from "../browse";
import { DevelopPage } from "../developer";
import { HomePage, InstallGuidePage, LandingPage, LandingPrivacyPage, LivePrivacyPage, NotFoundPage } from "../general";
import { ModeratePage } from "../moderator";
import { PlayerPage, SignInPage, SignOutPage } from "../player";

function protectedRoute(requiredRole: "player" | "developer" | "moderator", element: ReactNode) {
  return <ProtectedRoute requiredRole={requiredRole}>{element}</ProtectedRoute>;
}

export function AppRoutes() {
  if (appConfig.landingMode) {
    return (
      <LandingShell>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path={landingPrivacyRoute} element={<LandingPrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </LandingShell>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privacy" element={<LivePrivacyPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/:studioSlug/:titleSlug" element={<TitleDetailPage />} />
        <Route path="/studios/:studioSlug" element={<StudioDetailPage />} />
        <Route path="/install-guide" element={<InstallGuidePage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signout" element={<SignOutPage />} />
        <Route path="/signin" element={<Navigate to="/auth/signin" replace />} />
        <Route path="/player" element={protectedRoute("player", <PlayerPage />)} />
        <Route path="/player/wishlist" element={protectedRoute("player", <PlayerPage />)} />
        <Route path="/account" element={protectedRoute("player", <Navigate to="/player?workflow=account-profile" replace />)} />
        <Route path="/account/board-profile" element={protectedRoute("player", <Navigate to="/player?workflow=account-profile" replace />)} />
        <Route path="/develop" element={protectedRoute("player", <DevelopPage />)} />
        <Route path="/moderate" element={protectedRoute("moderator", <ModeratePage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}
