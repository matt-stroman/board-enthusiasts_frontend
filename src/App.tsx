import type {
  CatalogTitleResponse,
  CatalogTitleSummary,
  CurrentUserResponse,
  DeveloperStudioSummary,
  ModerationDeveloperSummary,
  StudioLink,
  StudioSummary,
  UserProfile,
} from "@board-enthusiasts/migration-contract";
import { useDeferredValue, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  createStudio,
  createStudioLink,
  deleteStudio,
  deleteStudioLink,
  enrollAsDeveloper,
  getCatalogTitle,
  getDeveloperEnrollment,
  getPublicStudio,
  getUserProfile,
  getVerifiedDeveloperState,
  listCatalogTitles,
  listManagedStudios,
  listPublicStudios,
  listStudioLinks,
  searchModerationDevelopers,
  setVerifiedDeveloperState,
  updateStudio,
  updateStudioLink,
  updateUserProfile,
  uploadStudioMedia,
  type StudioLinkMutationRequest,
  type StudioMutationRequest,
} from "./api";
import { hasPlatformRole, useAuth } from "./auth";
import { readAppConfig } from "./config";

const appConfig = readAppConfig();
const localSeedPassword = "ChangeMe!123";

interface StudioEditorState {
  slug: string;
  displayName: string;
  description: string;
}

interface LinkEditorState {
  label: string;
  url: string;
}

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatRoles(user: CurrentUserResponse | null): string {
  if (!user || user.roles.length === 0) {
    return "Guest";
  }

  return user.roles.map((role) => role.replace(/_/g, " ")).join(", ");
}

function Panel({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {description ? <p className="panel-description">{description}</p> : null}
      {children}
    </section>
  );
}

function LoadingPanel({ title = "Loading..." }: { title?: string }) {
  return (
    <Panel title={title} eyebrow="Status">
      <div className="status-chip">Working</div>
    </Panel>
  );
}

function ErrorPanel({ title = "Something went wrong", detail }: { title?: string; detail: string }) {
  return (
    <Panel title={title} eyebrow="Error">
      <p>{detail}</p>
    </Panel>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function StudioCard({ studio }: { studio: StudioSummary | DeveloperStudioSummary }) {
  return (
    <article className="card">
      <div className="card-media">
        {studio.bannerUrl ? <img src={studio.bannerUrl} alt={`${studio.displayName} banner`} /> : <div className="card-fallback" />}
      </div>
      <div className="card-body">
        <div className="card-heading-row">
          <h3>{studio.displayName}</h3>
          {"role" in studio ? <span className="status-chip">{studio.role}</span> : null}
        </div>
        <p>{studio.description ?? "No studio summary yet."}</p>
        <div className="card-actions">
          <Link to={`/studios/${studio.slug}`}>Open studio</Link>
        </div>
      </div>
    </article>
  );
}

function TitleCard({ title }: { title: CatalogTitleSummary }) {
  return (
    <article className="card">
      <div className="card-media">
        {title.cardImageUrl ? <img src={title.cardImageUrl} alt={`${title.displayName} cover art`} /> : <div className="card-fallback" />}
      </div>
      <div className="card-body">
        <div className="eyebrow">{title.contentKind.toUpperCase()}</div>
        <h3>{title.displayName}</h3>
        <p>{title.shortDescription}</p>
        <div className="meta-row">
          <span>{title.genreDisplay}</span>
          <span>{title.playerCountDisplay}</span>
          <span>{title.ageDisplay}</span>
        </div>
        <div className="card-actions">
          <Link to={`/browse/${title.studioSlug}/${title.slug}`}>Open title</Link>
          <Link to={`/studios/${title.studioSlug}`}>{title.studioSlug}</Link>
        </div>
      </div>
    </article>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { session, currentUser, loading } = useAuth();
  const location = useLocation();

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand-block">
          <Link to="/" className="brand-mark">
            Board Enthusiasts
          </Link>
          <p>
            Third-party catalog browsing, studio management, and moderation on Cloudflare Pages, Workers, and Supabase.
          </p>
        </div>

        <div className="session-block">
          <div className="session-label">Current session</div>
          <strong>{currentUser?.displayName ?? (session ? "Authenticated" : "Guest mode")}</strong>
          <span>{loading ? "Loading session..." : formatRoles(currentUser)}</span>
          <div className="session-actions">
            {session ? (
              <Link to="/auth/signout" className="pill-button">
                Sign out
              </Link>
            ) : (
              <Link to={`/auth/signin?returnTo=${encodeURIComponent(location.pathname)}`} className="pill-button">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav className="primary-nav">
        <NavLink to="/" end>
          Home
        </NavLink>
        <NavLink to="/browse">Browse</NavLink>
        <NavLink to="/player">Player</NavLink>
        <NavLink to="/develop">Develop</NavLink>
        <NavLink to="/moderate">Moderate</NavLink>
      </nav>

      <main className="page-shell">{children}</main>
    </div>
  );
}

function ProtectedRoute({
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

function HomePage() {
  const [studios, setStudios] = useState<StudioSummary[]>([]);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [studioResponse, catalogResponse] = await Promise.all([
          listPublicStudios(appConfig.apiBaseUrl),
          listCatalogTitles(appConfig.apiBaseUrl),
        ]);
        if (cancelled) {
          return;
        }

        setStudios(studioResponse.studios);
        setTitles(catalogResponse.titles);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div className="eyebrow">Board Enthusiasts</div>
        <h1>Board Enthusiasts</h1>
        <p>
          Browse shipped games and apps, manage studio presence, and verify developers through the maintained Supabase and
          Workers stack.
        </p>
        <div className="hero-actions">
          <Link to="/browse" className="primary-button">
            Browse catalog
          </Link>
          <Link to="/auth/signin" className="secondary-button">
            Sign in
          </Link>
        </div>
      </section>

      <Panel
        title="Wave 3 cutover status"
        eyebrow="Frontend"
        description="The SPA is now the maintained frontend path and talks directly to the Workers API surface."
      >
        <ul className="bullet-list">
          <li>Public catalog and studio browsing</li>
          <li>Supabase session-based sign-in and sign-out</li>
          <li>Player profile and developer enrollment</li>
          <li>Developer studio CRUD and media uploads</li>
          <li>Moderation verification workflow</li>
        </ul>
      </Panel>

      {loading ? <LoadingPanel title="Loading catalog highlights..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}

      {!loading && !error ? (
        <>
          <Panel title="Featured titles" eyebrow="Public catalog">
            <div className="card-grid">
              {titles.slice(0, 3).map((title) => (
                <TitleCard key={title.id} title={title} />
              ))}
            </div>
          </Panel>

          <Panel title="Studios in this wave" eyebrow="Public studios">
            <div className="card-grid">
              {studios.slice(0, 3).map((studio) => (
                <StudioCard key={studio.id} studio={studio} />
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function BrowsePage() {
  const [studios, setStudios] = useState<StudioSummary[]>([]);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStudio, setSelectedStudio] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [studioResponse, catalogResponse] = await Promise.all([
          listPublicStudios(appConfig.apiBaseUrl),
          listCatalogTitles(appConfig.apiBaseUrl),
        ]);
        if (cancelled) {
          return;
        }

        setStudios(studioResponse.studios);
        setTitles(catalogResponse.titles);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTitles = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return titles.filter((title) => {
      const matchesStudio = selectedStudio === "all" || title.studioSlug === selectedStudio;
      const matchesQuery =
        !normalizedQuery ||
        [title.displayName, title.shortDescription, title.genreDisplay, title.studioSlug].join(" ").toLowerCase().includes(normalizedQuery);
      return matchesStudio && matchesQuery;
    });
  }, [deferredQuery, selectedStudio, titles]);

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div className="eyebrow">Browse</div>
        <h1>Browse</h1>
        <p>Search the maintained catalog surface with instant client filtering over the public Workers API response.</p>
      </section>

      <Panel title="Catalog filters" eyebrow="Live filter">
        <div className="form-grid">
          <Field label="Search titles">
            <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Lantern, puzzle, family..." />
          </Field>

          <Field label="Studio">
            <select value={selectedStudio} onChange={(event) => setSelectedStudio(event.currentTarget.value)}>
              <option value="all">All studios</option>
              {studios.map((studio) => (
                <option key={studio.id} value={studio.slug}>
                  {studio.displayName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Panel>

      {loading ? <LoadingPanel title="Loading browse surface..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}
      {!loading && !error ? (
        <Panel title="Catalog results" eyebrow={`${filteredTitles.length} visible`}>
          {filteredTitles.length === 0 ? (
            <EmptyState title="No titles match the current filters." detail="Try a different search term or reset the studio filter." />
          ) : (
            <div className="card-grid">
              {filteredTitles.map((title) => (
                <TitleCard key={title.id} title={title} />
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function StudioDetailPage() {
  const params = useParams<{ studioSlug: string }>();
  const studioSlug = params.studioSlug ?? "";
  const [studio, setStudio] = useState<StudioSummary | null>(null);
  const [titles, setTitles] = useState<CatalogTitleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [studioResponse, catalogResponse] = await Promise.all([
          getPublicStudio(appConfig.apiBaseUrl, studioSlug),
          listCatalogTitles(appConfig.apiBaseUrl, studioSlug),
        ]);
        if (cancelled) {
          return;
        }

        setStudio(studioResponse.studio);
        setTitles(catalogResponse.titles);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studioSlug]);

  if (loading) {
    return <LoadingPanel title="Loading studio..." />;
  }

  if (error) {
    return <ErrorPanel detail={error} />;
  }

  if (!studio) {
    return <ErrorPanel title="Studio not found" detail="The requested studio could not be loaded." />;
  }

  return (
    <div className="page-grid">
      <section className="hero-panel media-hero">
        <div className="hero-backdrop">
          {studio.bannerUrl ? <img src={studio.bannerUrl} alt={`${studio.displayName} banner`} /> : null}
        </div>
        <div className="hero-copy">
          <div className="eyebrow">Studio</div>
          <h1>{studio.displayName}</h1>
          <p>{studio.description ?? "No studio description is available yet."}</p>
          <div className="hero-actions">
            {studio.links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="secondary-button">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      <Panel title="Published and testing titles" eyebrow={`${titles.length} entries`}>
        {titles.length === 0 ? (
          <EmptyState title="No catalog titles yet." detail="This studio does not currently expose public titles through the maintained surface." />
        ) : (
          <div className="card-grid">
            {titles.map((title) => (
              <TitleCard key={title.id} title={title} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function TitleDetailPage() {
  const params = useParams<{ studioSlug: string; titleSlug: string }>();
  const studioSlug = params.studioSlug ?? "";
  const titleSlug = params.titleSlug ?? "";
  const [title, setTitle] = useState<CatalogTitleResponse["title"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await getCatalogTitle(appConfig.apiBaseUrl, studioSlug, titleSlug);
        if (cancelled) {
          return;
        }

        setTitle(response.title);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [studioSlug, titleSlug]);

  if (loading) {
    return <LoadingPanel title="Loading title..." />;
  }

  if (error) {
    return <ErrorPanel detail={error} />;
  }

  if (!title) {
    return <ErrorPanel title="Title not found" detail="The requested title could not be loaded." />;
  }

  const heroAsset = title.mediaAssets.find((asset) => asset.mediaRole === "hero") ?? null;
  const logoAsset = title.mediaAssets.find((asset) => asset.mediaRole === "logo") ?? null;

  return (
    <div className="page-grid">
      <section className="hero-panel media-hero">
        <div className="hero-backdrop">{heroAsset ? <img src={heroAsset.sourceUrl} alt={heroAsset.altText ?? title.displayName} /> : null}</div>
        <div className="hero-copy">
          <div className="eyebrow">{title.contentKind.toUpperCase()}</div>
          <h1>{title.displayName}</h1>
          <p>{title.description}</p>
          <div className="meta-row">
            <span>{title.genreDisplay}</span>
            <span>{title.playerCountDisplay}</span>
            <span>{title.ageDisplay}</span>
          </div>
          <div className="hero-actions">
            <Link to={`/studios/${title.studioSlug}`} className="secondary-button">
              Open studio
            </Link>
            {title.acquisitionUrl ? (
              <a href={title.acquisitionUrl} target="_blank" rel="noreferrer" className="primary-button">
                {title.acquisition?.label ?? "Open acquisition page"}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <Panel title="Release snapshot" eyebrow="Catalog detail">
        <div className="detail-grid">
          <div>
            <strong>Status</strong>
            <p>{title.lifecycleStatus}</p>
          </div>
          <div>
            <strong>Visibility</strong>
            <p>{title.visibility}</p>
          </div>
          <div>
            <strong>Revision</strong>
            <p>{title.currentMetadataRevision}</p>
          </div>
          <div>
            <strong>Publisher page</strong>
            <p>{title.acquisition?.providerDisplayName ?? "Not configured"}</p>
          </div>
        </div>
        {logoAsset ? <img className="detail-logo" src={logoAsset.sourceUrl} alt={logoAsset.altText ?? `${title.displayName} logo`} /> : null}
      </Panel>
    </div>
  );
}

function SignInPage() {
  const { session, signIn } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("emma.torres@boardtpl.local");
  const [password, setPassword] = useState(localSeedPassword);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnTo = searchParams.get("returnTo") || "/player";

  useEffect(() => {
    if (session) {
      navigate(returnTo, { replace: true });
    }
  }, [navigate, returnTo, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(returnTo, { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid narrow">
      <section className="hero-panel compact">
        <div className="eyebrow">Auth</div>
        <h1>Sign in</h1>
        <p>Use Supabase Auth to enter the player, developer, or moderation workspaces.</p>
      </section>

      <Panel title="Local seed credentials" eyebrow="Local workflow">
        <ul className="bullet-list">
          <li>Developer: `emma.torres@boardtpl.local`</li>
          <li>Moderator: `alex.rivera@boardtpl.local`</li>
          <li>Password: `ChangeMe!123`</li>
        </ul>
      </Panel>

      <Panel title="Sign in form" eyebrow="Supabase session">
        <form className="stack-form" onSubmit={handleSubmit}>
          <Field label="Email">
            <input value={email} onChange={(event) => setEmail(event.currentTarget.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              autoComplete="current-password"
            />
          </Field>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </Panel>
    </div>
  );
}

function SignOutPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      try {
        await signOut();
      } finally {
        if (!cancelled) {
          navigate("/", { replace: true });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, signOut]);

  return <LoadingPanel title="Signing out..." />;
}

function PlayerPage() {
  const { session, currentUser, refreshCurrentUser } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [developerAccessEnabled, setDeveloperAccessEnabled] = useState(false);
  const [verifiedDeveloper, setVerifiedDeveloper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [profileResponse, enrollmentResponse] = await Promise.all([
          getUserProfile(appConfig.apiBaseUrl, accessToken),
          getDeveloperEnrollment(appConfig.apiBaseUrl, accessToken),
        ]);
        if (cancelled) {
          return;
        }

        setProfile(profileResponse.profile);
        setDisplayName(profileResponse.profile.displayName ?? "");
        setDeveloperAccessEnabled(enrollmentResponse.developerEnrollment.developerAccessEnabled);
        setVerifiedDeveloper(enrollmentResponse.developerEnrollment.verifiedDeveloper);
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await updateUserProfile(appConfig.apiBaseUrl, accessToken, displayName);
      setProfile(response.profile);
      await refreshCurrentUser();
      setMessage("Profile updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrollment(): Promise<void> {
    setSaving(true);
    try {
      const response = await enrollAsDeveloper(appConfig.apiBaseUrl, accessToken);
      setDeveloperAccessEnabled(response.developerEnrollment.developerAccessEnabled);
      setVerifiedDeveloper(response.developerEnrollment.verifiedDeveloper);
      await refreshCurrentUser();
      setMessage("Developer access enabled for this account.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading player workspace..." />;
  }

  if (error && !profile) {
    return <ErrorPanel detail={error} />;
  }

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div className="eyebrow">Player</div>
        <h1>My Games</h1>
        <p>Wave 3 preserves the player workspace shell while moving the identity and enrollment flows to Supabase.</p>
      </section>

      <Panel title="Profile" eyebrow={currentUser?.displayName ?? "Current user"}>
        <form className="stack-form" onSubmit={handleProfileSubmit}>
          <Field label="Display name">
            <input value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} />
          </Field>

          <div className="detail-grid">
            <div>
              <strong>Username</strong>
              <p>{profile?.userName ?? "Not set"}</p>
            </div>
            <div>
              <strong>Email</strong>
              <p>{profile?.email ?? "Not set"}</p>
            </div>
            <div>
              <strong>Initials</strong>
              <p>{profile?.initials ?? "--"}</p>
            </div>
            <div>
              <strong>Roles</strong>
              <p>{formatRoles(currentUser)}</p>
            </div>
          </div>

          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </Panel>

      <Panel title="Developer access" eyebrow="Self-service enrollment">
        <div className="detail-grid">
          <div>
            <strong>Access enabled</strong>
            <p>{developerAccessEnabled ? "Yes" : "No"}</p>
          </div>
          <div>
            <strong>Verified developer</strong>
            <p>{verifiedDeveloper ? "Yes" : "No"}</p>
          </div>
        </div>

        {!developerAccessEnabled ? (
          <button type="button" className="primary-button" onClick={() => void handleEnrollment()} disabled={saving}>
            {saving ? "Submitting..." : "Enable developer access"}
          </button>
        ) : (
          <p>Your account can now use the developer workspace.</p>
        )}
      </Panel>
    </div>
  );
}

function DevelopPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [studios, setStudios] = useState<DeveloperStudioSummary[]>([]);
  const [activeStudioId, setActiveStudioId] = useState("");
  const [links, setLinks] = useState<StudioLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<StudioEditorState>({ slug: "", displayName: "", description: "" });
  const [editForm, setEditForm] = useState<StudioEditorState>({ slug: "", displayName: "", description: "" });
  const [linkForm, setLinkForm] = useState<LinkEditorState>({ label: "", url: "" });
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const activeStudio = studios.find((studio) => studio.id === activeStudioId) ?? null;

  async function refreshStudios(preferredStudioId?: string): Promise<void> {
    const response = await listManagedStudios(appConfig.apiBaseUrl, accessToken);
    setStudios(response.studios);

    const nextActiveStudio =
      response.studios.find((studio) => studio.id === preferredStudioId) ??
      response.studios.find((studio) => studio.id === activeStudioId) ??
      response.studios[0] ??
      null;

    if (nextActiveStudio) {
      setActiveStudioId(nextActiveStudio.id);
      setEditForm({
        slug: nextActiveStudio.slug,
        displayName: nextActiveStudio.displayName,
        description: nextActiveStudio.description ?? "",
      });
      const linkResponse = await listStudioLinks(appConfig.apiBaseUrl, accessToken, nextActiveStudio.id);
      setLinks(linkResponse.links);
    } else {
      setActiveStudioId("");
      setEditForm({ slug: "", displayName: "", description: "" });
      setLinks([]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        await refreshStudios();
        if (!cancelled) {
          setError(null);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // The access token is stable for the local session during this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function updateCreateForm(field: keyof StudioEditorState, value: string): void {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "displayName" && (!current.slug || current.slug === slugifyValue(current.displayName))
        ? { slug: slugifyValue(value) }
        : {}),
    }));
  }

  function updateEditForm(field: keyof StudioEditorState, value: string): void {
    setEditForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "displayName" && (!current.slug || current.slug === slugifyValue(current.displayName))
        ? { slug: slugifyValue(value) }
        : {}),
    }));
  }

  async function handleCreateStudio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      const request: StudioMutationRequest = {
        slug: createForm.slug,
        displayName: createForm.displayName,
        description: createForm.description || null,
      };
      const response = await createStudio(appConfig.apiBaseUrl, accessToken, request);
      await refreshStudios(response.studio.id);
      setCreateForm({ slug: "", displayName: "", description: "" });
      setMessage("Studio created.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStudio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeStudio) {
      return;
    }

    setSaving(true);
    try {
      const request: StudioMutationRequest = {
        slug: editForm.slug,
        displayName: editForm.displayName,
        description: editForm.description || null,
        logoUrl: activeStudio.logoUrl,
        bannerUrl: activeStudio.bannerUrl,
      };
      await updateStudio(appConfig.apiBaseUrl, accessToken, activeStudio.id, request);
      await refreshStudios(activeStudio.id);
      setMessage("Studio updated.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStudio(): Promise<void> {
    if (!activeStudio) {
      return;
    }

    setSaving(true);
    try {
      await deleteStudio(appConfig.apiBaseUrl, accessToken, activeStudio.id);
      await refreshStudios();
      setMessage("Studio deleted.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeStudio) {
      return;
    }

    setSaving(true);
    try {
      const request: StudioLinkMutationRequest = { label: linkForm.label, url: linkForm.url };

      if (editingLinkId) {
        await updateStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, editingLinkId, request);
      } else {
        await createStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, request);
      }

      const linkResponse = await listStudioLinks(appConfig.apiBaseUrl, accessToken, activeStudio.id);
      setLinks(linkResponse.links);
      setLinkForm({ label: "", url: "" });
      setEditingLinkId(null);
      setMessage(editingLinkId ? "Studio link updated." : "Studio link created.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLink(linkId: string): Promise<void> {
    if (!activeStudio) {
      return;
    }

    setSaving(true);
    try {
      await deleteStudioLink(appConfig.apiBaseUrl, accessToken, activeStudio.id, linkId);
      const linkResponse = await listStudioLinks(appConfig.apiBaseUrl, accessToken, activeStudio.id);
      setLinks(linkResponse.links);
      setMessage("Studio link deleted.");
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleMediaUpload(kind: "logo" | "banner", event: ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!activeStudio) {
      return;
    }

    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    setSaving(true);
    try {
      await uploadStudioMedia(appConfig.apiBaseUrl, accessToken, activeStudio.id, kind, file);
      await refreshStudios(activeStudio.id);
      setMessage(`${kind === "logo" ? "Logo" : "Banner"} uploaded.`);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
      setMessage(null);
    } finally {
      setSaving(false);
      event.currentTarget.value = "";
    }
  }

  if (loading) {
    return <LoadingPanel title="Loading developer workspace..." />;
  }

  if (error && studios.length === 0) {
    return <ErrorPanel detail={error} />;
  }

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div className="eyebrow">Developer</div>
        <h1>Developer Console</h1>
        <p>Manage studio metadata, outbound links, and media uploads against the maintained Workers API.</p>
      </section>

      <Panel title="Create studio" eyebrow="Studio bootstrap">
        <form className="stack-form" onSubmit={handleCreateStudio}>
          <div className="form-grid">
            <Field label="Studio display name">
              <input
                value={createForm.displayName}
                onChange={(event) => updateCreateForm("displayName", event.currentTarget.value)}
                placeholder="Blue Harbor Games"
              />
            </Field>
            <Field label="Studio slug" hint="Auto-generated, but still editable.">
              <input value={createForm.slug} onChange={(event) => updateCreateForm("slug", event.currentTarget.value)} />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={createForm.description} onChange={(event) => updateCreateForm("description", event.currentTarget.value)} rows={3} />
          </Field>

          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Create studio"}
          </button>
        </form>
      </Panel>

      <Panel title="Managed studios" eyebrow={`${studios.length} studios`}>
        {studios.length === 0 ? (
          <EmptyState title="No studios yet." detail="Create a studio first to unlock the edit, link, and upload workflows." />
        ) : (
          <>
            <div className="workspace-selector">
              {studios.map((studio) => (
                <button
                  key={studio.id}
                  type="button"
                  className={studio.id === activeStudioId ? "selector-chip active" : "selector-chip"}
                  onClick={() => {
                    setActiveStudioId(studio.id);
                    setEditForm({
                      slug: studio.slug,
                      displayName: studio.displayName,
                      description: studio.description ?? "",
                    });
                    void listStudioLinks(appConfig.apiBaseUrl, accessToken, studio.id).then((response) => setLinks(response.links));
                    setEditingLinkId(null);
                    setLinkForm({ label: "", url: "" });
                  }}
                >
                  {studio.displayName}
                </button>
              ))}
            </div>

            {activeStudio ? (
              <div className="workspace-grid">
                <StudioCard studio={activeStudio} />

                <form className="stack-form panel inset-panel" onSubmit={handleUpdateStudio}>
                  <h3>Edit studio</h3>
                  <div className="form-grid">
                    <Field label="Display name">
                      <input value={editForm.displayName} onChange={(event) => updateEditForm("displayName", event.currentTarget.value)} />
                    </Field>
                    <Field label="Slug">
                      <input value={editForm.slug} onChange={(event) => updateEditForm("slug", event.currentTarget.value)} />
                    </Field>
                  </div>
                  <Field label="Description">
                    <textarea value={editForm.description} onChange={(event) => updateEditForm("description", event.currentTarget.value)} rows={4} />
                  </Field>
                  <div className="button-row">
                    <button type="submit" className="primary-button" disabled={saving}>
                      Save studio
                    </button>
                    <button type="button" className="danger-button" onClick={() => void handleDeleteStudio()} disabled={saving}>
                      Delete studio
                    </button>
                  </div>
                </form>

                <section className="panel inset-panel">
                  <h3>Uploads</h3>
                  <div className="form-grid">
                    <Field label="Logo upload">
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void handleMediaUpload("logo", event)} />
                    </Field>
                    <Field label="Banner upload">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(event) => void handleMediaUpload("banner", event)}
                      />
                    </Field>
                  </div>
                </section>

                <section className="panel inset-panel">
                  <h3>Studio links</h3>
                  <form className="stack-form" onSubmit={handleLinkSubmit}>
                    <div className="form-grid">
                      <Field label="Label">
                        <input value={linkForm.label} onChange={(event) => setLinkForm((current) => ({ ...current, label: event.currentTarget.value }))} />
                      </Field>
                      <Field label="URL">
                        <input value={linkForm.url} onChange={(event) => setLinkForm((current) => ({ ...current, url: event.currentTarget.value }))} />
                      </Field>
                    </div>
                    <div className="button-row">
                      <button type="submit" className="primary-button" disabled={saving}>
                        {editingLinkId ? "Save link" : "Add link"}
                      </button>
                      {editingLinkId ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditingLinkId(null);
                            setLinkForm({ label: "", url: "" });
                          }}
                        >
                          Cancel edit
                        </button>
                      ) : null}
                    </div>
                  </form>

                  <div className="list-stack">
                    {links.map((link) => (
                      <article key={link.id} className="list-item">
                        <div>
                          <strong>{link.label}</strong>
                          <p>{link.url}</p>
                        </div>
                        <div className="button-row compact">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              setEditingLinkId(link.id);
                              setLinkForm({ label: link.label, url: link.url });
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" className="danger-button" onClick={() => void handleDeleteLink(link.id)} disabled={saving}>
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}

function ModeratePage() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [query, setQuery] = useState("");
  const [developers, setDevelopers] = useState<ModerationDeveloperSummary[]>([]);
  const [verifiedState, setVerifiedState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await searchModerationDevelopers(appConfig.apiBaseUrl, accessToken, deferredQuery);
        const nextStateEntries = await Promise.all(
          response.developers.map(async (developer) => {
            const state = await getVerifiedDeveloperState(appConfig.apiBaseUrl, accessToken, developer.developerSubject);
            return [developer.developerSubject, state.verifiedDeveloperRoleState.verifiedDeveloper] as const;
          }),
        );
        if (cancelled) {
          return;
        }

        setDevelopers(response.developers);
        setVerifiedState(Object.fromEntries(nextStateEntries));
        setError(null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, deferredQuery]);

  async function toggleVerified(developerSubject: string, nextValue: boolean): Promise<void> {
    try {
      await setVerifiedDeveloperState(appConfig.apiBaseUrl, accessToken, developerSubject, nextValue);
      setVerifiedState((current) => ({ ...current, [developerSubject]: nextValue }));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div className="eyebrow">Moderation</div>
        <h1>Verify Developers</h1>
        <p>Search developer identities and toggle verified-developer access against the maintained moderation surface.</p>
      </section>

      <Panel title="Developer search" eyebrow="Role review">
        <Field label="Search term">
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Name, username, or email..." />
        </Field>
      </Panel>

      {loading ? <LoadingPanel title="Loading moderation results..." /> : null}
      {error ? <ErrorPanel detail={error} /> : null}

      {!loading && !error ? (
        <Panel title="Developer results" eyebrow={`${developers.length} matches`}>
          {developers.length === 0 ? (
            <EmptyState title="No developers matched." detail="Try a different search term or remove the current filter." />
          ) : (
            <div className="list-stack">
              {developers.map((developer) => (
                <article key={developer.developerSubject} className="list-item">
                  <div>
                    <strong>{developer.displayName ?? developer.userName ?? developer.email ?? developer.developerSubject}</strong>
                    <p>{developer.email ?? developer.userName ?? developer.developerSubject}</p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={verifiedState[developer.developerSubject] ?? false}
                      onChange={(event) => void toggleVerified(developer.developerSubject, event.currentTarget.checked)}
                    />
                    <span>Verified developer</span>
                  </label>
                </article>
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="page-grid narrow">
      <Panel title="Route not found" eyebrow="404" description="The requested route is not part of the maintained Wave 3 surface.">
        <div className="hero-actions">
          <Link to="/" className="primary-button">
            Return home
          </Link>
          <Link to="/browse" className="secondary-button">
            Open browse
          </Link>
        </div>
      </Panel>
    </div>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/:studioSlug/:titleSlug" element={<TitleDetailPage />} />
        <Route path="/studios/:studioSlug" element={<StudioDetailPage />} />
        <Route path="/auth/signin" element={<SignInPage />} />
        <Route path="/auth/signout" element={<SignOutPage />} />
        <Route path="/signin" element={<Navigate to="/auth/signin" replace />} />
        <Route
          path="/player"
          element={
            <ProtectedRoute requiredRole="player">
              <PlayerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/develop"
          element={
            <ProtectedRoute requiredRole="developer">
              <DevelopPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/moderate"
          element={
            <ProtectedRoute requiredRole="moderator">
              <ModeratePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Shell>
  );
}
