import type { UserNotification } from "@board-enthusiasts/migration-contract";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getCurrentUserNotifications, markCurrentUserNotificationRead } from "../api";
import { hasPlatformRole, useAuth } from "../auth";
import {
  appConfig,
  formatNotificationCategory,
  formatNotificationTimestamp,
  formatRoles,
  getInitials,
  isBrowsePath,
  landingBoardUrl,
  landingDiscordUrl,
  landingPrivacyRoute,
  landingSignupRoute,
  readSessionStorageValue,
  renderCurrentUserAvatar,
} from "./shared";
import { getUserFacingErrorMessage, supportRoute } from "./errors";
import { usePageAnalytics } from "./analytics";
import { DiscordIconButton, LandingUpdatesLink } from "./site";
import { ErrorPanel, LoadingPanel } from "./ui";
import { passwordRecoveryRedirectStorageKey } from "../auth";

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, currentUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const accessToken = session?.access_token ?? "";
  const homeShell = location.pathname === "/";
  const browseActive = isBrowsePath(location.pathname);
  const offeringsActive = location.pathname.startsWith("/offerings");
  const installActive = location.pathname.startsWith("/install-guide");
  const showSignedInSections = Boolean(session && currentUser);
  const accountReady = Boolean(currentUser);
  const showModerateSection = currentUser ? hasPlatformRole(currentUser.roles, "moderator") : false;
  const avatarInitials = getInitials(currentUser?.displayName ?? currentUser?.email);
  const signInHref = `/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const unreadNotificationCount = notifications.filter((notification) => !notification.isRead).length;
  const showDeveloperSection = currentUser ? hasPlatformRole(currentUser.roles, "developer") : false;
  usePageAnalytics(`${location.pathname}${location.search}`, session && currentUser ? "authenticated" : "anonymous");

  function navLinkClass(active: boolean): string {
    return active ? "app-nav-link active" : "app-nav-link";
  }

  function closeOverlays(): void {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
  }

  function navigateToAndClose(path: string): void {
    closeOverlays();
    navigate(path);
  }

  async function loadNotifications(): Promise<void> {
    if (!accessToken) {
      setNotifications([]);
      setNotificationError(null);
      return;
    }

    setNotificationsLoading(true);
    setNotificationError(null);
    try {
      const response = await getCurrentUserNotifications(appConfig.apiBaseUrl, accessToken);
      setNotifications([...response.notifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt)));
    } catch (nextError) {
      setNotificationError(getUserFacingErrorMessage(nextError, "We couldn't load your notifications right now. Please try again."));
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function toggleNotifications(): Promise<void> {
    setUserMenuOpen(false);
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications();
    }
  }

  async function openNotification(notification: UserNotification): Promise<void> {
    if (!notification.isRead && accessToken) {
      try {
        const response = await markCurrentUserNotificationRead(appConfig.apiBaseUrl, accessToken, notification.id);
        setNotifications((current) =>
          current
            .map((candidate) => (candidate.id === response.notification.id ? response.notification : candidate))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
        );
      } catch {
        // Keep navigation resilient even if the read mutation fails.
      }
    }

    setNotificationsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setNotifications([]);
      setNotificationError(null);
      setNotificationsLoading(false);
      return;
    }

    void loadNotifications();
  }, [accessToken]);

  useEffect(() => {
    const recoveryPending = readSessionStorageValue(passwordRecoveryRedirectStorageKey) === "true";
    const alreadyOnRecoveryRoute = location.pathname === "/auth/signin" && new URLSearchParams(location.search).get("mode") === "recovery";
    if (!recoveryPending || alreadyOnRecoveryRoute) {
      return;
    }

    navigate("/auth/signin?mode=recovery", { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className={homeShell ? "app-root landing-root" : "app-root"}>
      {userMenuOpen || notificationsOpen ? (
        <button className="fixed inset-0 z-40 cursor-default bg-transparent" type="button" aria-label="Close navigation menus" onClick={closeOverlays} />
      ) : null}
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="app-brand">
            <img className="app-brand-mark" src="/favicon_sm.png" alt="Board Enthusiasts logo" />
            <div>
              <div className="app-brand-title">Board Enthusiasts</div>
              <div className="app-brand-subtitle">For Board Players And Builders</div>
            </div>
          </Link>

          <nav className="app-nav" aria-label="Primary">
            <Link to="/browse" className={navLinkClass(browseActive)}>
              Browse
            </Link>
            <Link to="/offerings" className={navLinkClass(offeringsActive)}>
              Offerings
            </Link>
            {showSignedInSections ? (
              <>
                <NavLink to="/player" className={({ isActive }) => navLinkClass(isActive)}>
                  Play
                </NavLink>
                <NavLink to="/developer" className={({ isActive }) => navLinkClass(isActive)}>
                  Developer
                </NavLink>
                {showModerateSection ? (
                  <NavLink to="/moderate" className={({ isActive }) => navLinkClass(isActive)}>
                    Moderate
                  </NavLink>
                ) : null}
              </>
            ) : null}
            {!homeShell ? (
              <NavLink to="/install-guide" className={({ isActive }) => navLinkClass(isActive || installActive)}>
                Install
              </NavLink>
            ) : null}
            <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">
              Get Board
            </a>
          </nav>

          <div className="app-header-actions">
            <DiscordIconButton />

            {session ? (
              <>
                <div className="relative">
                  <button className="app-icon-button relative" type="button" aria-label="Open notifications" onClick={() => void toggleNotifications()}>
                    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 17a2.5 2.5 0 0 0 5 0" />
                    </svg>
                    {unreadNotificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 text-[0.62rem] font-black leading-none text-slate-950">
                        {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                      </span>
                    ) : null}
                  </button>
                  {notificationsOpen ? (
                    <section className="absolute right-0 z-50 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#111017] shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <div className="text-sm font-semibold text-white">Notifications</div>
                          <div className="text-xs text-slate-400">
                            {notifications.length === 0 ? "No recent activity" : `${notifications.length} recent item${notifications.length === 1 ? "" : "s"}`}
                          </div>
                        </div>
                        {unreadNotificationCount > 0 ? (
                          <div className="rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-amber-100">
                            {unreadNotificationCount} unread
                          </div>
                        ) : null}
                      </div>
                      <div className="border-t border-white/10" />
                      {notificationsLoading ? (
                        <div className="space-y-3 p-4">
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                          <div className="h-14 animate-pulse rounded-[1rem] bg-white/10" />
                        </div>
                      ) : notificationError ? (
                        <div className="p-4 text-sm leading-7 text-rose-100">{notificationError}</div>
                      ) : notifications.length === 0 ? (
                        <div className="p-4 text-sm leading-7 text-slate-300">No notifications yet.</div>
                      ) : (
                        <div className="max-h-[28rem] overflow-y-auto p-2">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              className={notification.isRead ? "block w-full rounded-[1rem] border border-transparent px-3 py-3 text-left text-slate-300 transition hover:bg-white/5" : "block w-full rounded-[1rem] border border-cyan-300/20 bg-cyan-300/8 px-3 py-3 text-left text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/12"}
                              type="button"
                              onClick={() => void openNotification(notification)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-white">{notification.title}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-100/70">{formatNotificationCategory(notification.category)}</div>
                                </div>
                                {!notification.isRead ? <span className="mt-1 inline-flex size-2.5 shrink-0 rounded-full bg-amber-300" /> : null}
                              </div>
                              <div className="mt-2 line-clamp-2 text-sm text-slate-300">{notification.body}</div>
                              <div className="mt-2 text-xs text-slate-500">{formatNotificationTimestamp(notification.createdAt)}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    className={`app-avatar-link ${accountReady ? "" : "pointer-events-none opacity-70"}`}
                    type="button"
                    disabled={!accountReady}
                    aria-label={loading || !accountReady ? "Loading account" : `Open account for ${formatRoles(currentUser)}`}
                    onClick={() => { setNotificationsOpen(false); setUserMenuOpen((current) => !current); }}
                  >
                    {renderCurrentUserAvatar(currentUser, loading, avatarInitials)}
                  </button>
                  {userMenuOpen && currentUser ? (
                    <section className="absolute right-0 z-50 mt-3 w-[min(92vw,21rem)] overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#111017] shadow-[0_28px_70px_rgba(0,0,0,0.48)]">
                      <div className="flex items-center gap-3 p-4">
                        <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-slate-800 text-sm font-bold text-slate-100">
                          {renderCurrentUserAvatar(currentUser, false, avatarInitials)}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{currentUser.displayName ?? currentUser.email ?? "Account"}</div>
                          <div className="truncate text-xs text-slate-300">{currentUser.email ?? "Signed-in account"}</div>
                        </div>
                      </div>
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=account-profile")}>Profile</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player")}>My Games</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player/wishlist")}>Wishlist</button>
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=reported-titles")}>Reported Titles</button>
                      </nav>
                      {showDeveloperSection ? (
                        <>
                          <div className="border-t border-white/10" />
                          <nav className="p-2 text-sm text-slate-200">
                            <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/developer")}>Developer Console</button>
                          </nav>
                        </>
                      ) : null}
                      {showModerateSection ? (
                        <>
                          <div className="border-t border-white/10" />
                          <nav className="p-2 text-sm text-slate-200">
                            <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/moderate")}>Moderate</button>
                          </nav>
                        </>
                      ) : null}
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <button className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10" type="button" onClick={() => navigateToAndClose("/player?workflow=account-settings")}>Account Settings</button>
                      </nav>
                      <div className="border-t border-white/10" />
                      <nav className="p-2 text-sm text-slate-200">
                        <Link className="block rounded-xl px-3 py-2 text-rose-100 transition hover:bg-rose-400/20" to="/auth/signout?returnTo=%2Fbrowse" onClick={closeOverlays}>
                          Sign Out
                        </Link>
                      </nav>
                    </section>
                  ) : null}
                </div>
              </>
            ) : (
              <Link to={signInHref} className="app-auth-link">
                Sign In
              </Link>
            )}
          </div>
        </div>

        <div className="app-mobile-nav" aria-label="Primary mobile">
          <Link to="/browse" className={`${navLinkClass(browseActive)} whitespace-nowrap`}>
            Browse
          </Link>
          <Link to="/offerings" className={`${navLinkClass(offeringsActive)} whitespace-nowrap`}>
            Offerings
          </Link>
          {showSignedInSections ? (
            <>
              <NavLink to="/player" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                Play
              </NavLink>
              <NavLink to="/developer" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                Developer
              </NavLink>
              {showModerateSection ? (
                <NavLink to="/moderate" className={({ isActive }) => `${navLinkClass(isActive)} whitespace-nowrap`}>
                  Moderate
                </NavLink>
              ) : null}
            </>
          ) : null}
          {!homeShell ? (
            <NavLink to="/install-guide" className={({ isActive }) => `${navLinkClass(isActive || installActive)} whitespace-nowrap`}>
              Install
            </NavLink>
          ) : null}
          <a href={landingBoardUrl} className={`${navLinkClass(false)} whitespace-nowrap`} target="_blank" rel="noreferrer">
            Get Board
          </a>
        </div>
      </header>

      <main className={homeShell ? "app-main landing-main" : "app-main"}>
        <div className="page-shell">{children}</div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div className="landing-footer-copy-block">
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Independent and community-built.</div>
            <div>Board Enthusiasts is an independent project for Board players and builders.</div>
          </div>
          <div className="app-footer-links">
            <Link to="/studios">Studios</Link>
            <Link to={supportRoute}>Contact Us</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/install-guide">Install Guide</Link>
          </div>
          <div className="landing-footer-copyright">
            © {currentYear} Matt Stroman | <a href="https://mattstroman.com" target="_blank" rel="noreferrer">Portfolio</a> | <a href="https://www.linkedin.com/in/mattstromandev/" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
        <div className="landing-footer-disclaimer-row">
          <div className="landing-footer-disclaimer">
            Board Enthusiasts is an independent community project and is not affiliated with, endorsed by, or sponsored by Harris Hill Products, Inc. or Board.
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ProtectedRoute({
  requiredRole,
  children,
}: {
  requiredRole: "player" | "developer" | "moderator";
  children: React.ReactNode;
}) {
  const { session, currentUser, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPanel title="Checking session..." />;
  }

  if (!session || !currentUser) {
    return <Navigate to={`/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!hasPlatformRole(currentUser.roles, requiredRole)) {
    return (
      <ErrorPanel
        title="Access not available"
        detail={authError ?? `You are signed in, but the ${requiredRole} workspace is not available to this account.`}
      />
    );
  }

  return <>{children}</>;
}

export function LandingShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileHeaderVisible, setMobileHeaderVisible] = useState(true);
  const lastMobileScrollY = useRef(0);
  usePageAnalytics(`${location.pathname}${location.search}`, "anonymous");

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = decodeURIComponent(location.hash.slice(1));
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [location.hash, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    let animationFrameId: number | null = null;

    const resetHeaderVisibility = () => {
      lastMobileScrollY.current = window.scrollY;
      setMobileHeaderVisible(true);
    };

    const updateHeaderVisibility = () => {
      animationFrameId = null;

      if (!mediaQuery.matches) {
        lastMobileScrollY.current = window.scrollY;
        setMobileHeaderVisible(true);
        return;
      }

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastMobileScrollY.current;

      if (currentScrollY <= 8) {
        setMobileHeaderVisible(true);
      } else if (Math.abs(delta) >= 6) {
        setMobileHeaderVisible(delta < 0);
      }

      lastMobileScrollY.current = currentScrollY;
    };

    const handleScroll = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateHeaderVisibility);
    };

    const handleViewportChange = () => {
      resetHeaderVisibility();
    };

    resetHeaderVisibility();

    window.addEventListener("scroll", handleScroll, { passive: true });
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
    } else {
      mediaQuery.addListener(handleViewportChange);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleViewportChange);
      } else {
        mediaQuery.removeListener(handleViewportChange);
      }
    };
  }, []);

  return (
    <div className="app-root landing-root">
      <header className={`app-header landing-header ${mobileHeaderVisible ? "is-visible" : "is-hidden"}`}>
        <div className="app-header-inner">
          <Link to="/" className="app-brand">
            <img className="app-brand-mark" src="/favicon_sm.png" alt="Board Enthusiasts logo" />
            <div>
              <div className="app-brand-title">Board Enthusiasts</div>
              <div className="app-brand-subtitle">For Board Players And Builders</div>
            </div>
          </Link>

          <nav className="app-nav" aria-label="Landing">
            <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">Get Board</a>
            <LandingUpdatesLink className="app-nav-link">Get Updates</LandingUpdatesLink>
          </nav>

          <div className="app-header-actions">
            <a className="secondary-button" href={landingDiscordUrl} target="_blank" rel="noreferrer">
              Join Discord
            </a>
          </div>
        </div>

        <nav className="app-mobile-nav" aria-label="Landing mobile">
          <a href={landingBoardUrl} className="app-nav-link" target="_blank" rel="noreferrer">Get Board</a>
          <LandingUpdatesLink className="app-nav-link">Get Updates</LandingUpdatesLink>
        </nav>
      </header>

      <main className="app-main landing-main">
        <div className="page-shell">{children}</div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <div className="landing-footer-copy-block">
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Independent and community-built.</div>
            <div>Board Enthusiasts is an independent project for Board players and builders.</div>
          </div>
          <div className="app-footer-links">
            <a href={landingDiscordUrl} target="_blank" rel="noreferrer">Discord</a>
            <a href={landingBoardUrl} target="_blank" rel="noreferrer">Get Board</a>
            <Link to={supportRoute}>Contact Us</Link>
            <Link to={landingPrivacyRoute}>Privacy</Link>
          </div>
          <div className="landing-footer-copyright">© {currentYear} Matt Stroman | <a href="https://mattstroman.com" target="_blank" rel="noreferrer">Portfolio</a> | <a href="https://www.linkedin.com/in/mattstromandev/" target="_blank" rel="noreferrer">LinkedIn</a></div>
        </div>
        <div className="landing-footer-disclaimer-row">
          <div className="landing-footer-disclaimer">
            Board Enthusiasts is an independent community project and is not affiliated with, endorsed by, or sponsored by Harris Hill Products, Inc. or Board.
          </div>
        </div>
      </footer>
    </div>
  );
}
