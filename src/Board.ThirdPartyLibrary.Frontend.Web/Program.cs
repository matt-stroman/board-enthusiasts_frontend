using Board.ThirdPartyLibrary.Frontend.Web.Authentication;
using Board.ThirdPartyLibrary.Frontend.Web.Components;
using Board.ThirdPartyLibrary.Frontend.Web.Configuration;
using Board.ThirdPartyLibrary.Frontend.Web.Services;
using System.Net;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.ConfigureEndpointDefaults(endpointOptions =>
    {
        endpointOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});

builder.Services
    .AddOptions<BackendApiOptions>()
    .Bind(builder.Configuration.GetSection(BackendApiOptions.SectionName));
builder.Services
    .AddOptions<KeycloakOptions>()
    .Bind(builder.Configuration.GetSection(KeycloakOptions.SectionName));

var backendApiOptions = builder.Configuration.GetSection(BackendApiOptions.SectionName).Get<BackendApiOptions>() ?? new BackendApiOptions();
var keycloakOptions = builder.Configuration.GetSection(KeycloakOptions.SectionName).Get<KeycloakOptions>() ?? new KeycloakOptions();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSingleton<ITicketStore, DistributedCacheTicketStore>();
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();
builder.Services.AddCascadingAuthenticationState();
builder.Services.AddHttpContextAccessor();
builder.Services.AddAuthorization();
builder.Services.AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.Cookie.Name = "__Host-boardtpl-web";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.LoginPath = "/signin";
        options.LogoutPath = "/signout";
        options.SlidingExpiration = true;
    })
    .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
    {
        options.Authority = $"{keycloakOptions.BaseUrl.TrimEnd('/')}/realms/{keycloakOptions.Realm}";
        options.ClientId = keycloakOptions.ClientId;
        options.ClientSecret = keycloakOptions.ClientSecret;
        options.RequireHttpsMetadata = keycloakOptions.RequireHttpsMetadata;
        options.ResponseType = "code";
        options.UsePkce = true;
        options.CallbackPath = "/signin-oidc";
        options.SignedOutCallbackPath = "/signout-callback-oidc";
        options.SaveTokens = true;
        options.GetClaimsFromUserInfoEndpoint = true;
        options.Scope.Clear();
        foreach (var scope in keycloakOptions.Scopes.Where(static scope => !string.IsNullOrWhiteSpace(scope)))
        {
            options.Scope.Add(scope);
        }

        options.Events = new OpenIdConnectEvents
        {
            OnRedirectToIdentityProviderForSignOut = async context =>
            {
                context.ProtocolMessage.ClientId = context.Options.ClientId;

                var idTokenHint = context.Properties?.GetTokenValue("id_token");
                if (string.IsNullOrWhiteSpace(idTokenHint))
                {
                    idTokenHint = await context.HttpContext.GetTokenAsync("id_token");
                }

                if (!string.IsNullOrWhiteSpace(idTokenHint))
                {
                    context.ProtocolMessage.IdTokenHint = idTokenHint;
                }
            },
            OnSignedOutCallbackRedirect = async context =>
            {
                await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });
builder.Services
    .AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<ITicketStore>((options, ticketStore) =>
    {
        options.SessionStore = ticketStore;
    });
builder.Services.AddHttpClient<IBoardLibraryApiClient, BoardLibraryApiClient>(client =>
{
    client.BaseAddress = new Uri(backendApiOptions.BaseUrl);
    client.DefaultRequestVersion = HttpVersion.Version20;
    client.DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrHigher;
});

static string SanitizeReturnUrl(string? returnUrl)
{
    if (string.IsNullOrWhiteSpace(returnUrl))
    {
        return "/library";
    }

    return returnUrl.StartsWith("/", StringComparison.Ordinal) ? returnUrl : "/library";
}

static string BuildSignInUnavailableUrl(string returnUrl) =>
    $"/signin?error=identity-provider-unavailable&returnUrl={Uri.EscapeDataString(returnUrl)}";

static string BuildSignInFailedUrl(string returnUrl) =>
    $"/signin?error=identity-provider-auth-failed&returnUrl={Uri.EscapeDataString(returnUrl)}";

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseExceptionHandler("/Error", createScopeForErrors: true);
app.UseHsts();
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.MapStaticAssets();
app.MapGet("/auth/signin", async (
    HttpContext httpContext,
    string? returnUrl,
    IOptions<KeycloakOptions> options,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    var sanitizedReturnUrl = SanitizeReturnUrl(returnUrl);
    var keycloak = options.Value;
    var discoveryUrl = $"{keycloak.BaseUrl.TrimEnd('/')}/realms/{keycloak.Realm}/.well-known/openid-configuration";

    try
    {
        using var httpClient = new HttpClient
        {
            DefaultRequestVersion = HttpVersion.Version20,
            DefaultVersionPolicy = HttpVersionPolicy.RequestVersionOrHigher
        };
        using var response = await httpClient.GetAsync(discoveryUrl, cancellationToken);
        response.EnsureSuccessStatusCode();

        await httpContext.ChallengeAsync(
            OpenIdConnectDefaults.AuthenticationScheme,
            new AuthenticationProperties
            {
                RedirectUri = sanitizedReturnUrl
            });

        return Results.Empty;
    }
    catch (HttpRequestException ex)
    {
        logger.LogWarning(ex, "Frontend sign-in could not reach Keycloak discovery at {DiscoveryUrl}.", discoveryUrl);
        return Results.Redirect(BuildSignInUnavailableUrl(sanitizedReturnUrl));
    }
    catch (TaskCanceledException ex)
    {
        logger.LogWarning(ex, "Frontend sign-in timed out while checking Keycloak discovery at {DiscoveryUrl}.", discoveryUrl);
        return Results.Redirect(BuildSignInUnavailableUrl(sanitizedReturnUrl));
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Frontend sign-in challenge failed for Keycloak realm {Realm} and client {ClientId}.", keycloak.Realm, keycloak.ClientId);
        return Results.Redirect(BuildSignInFailedUrl(sanitizedReturnUrl));
    }
});
app.MapGet("/auth/signout", async (
    HttpContext httpContext,
    string? returnUrl,
    ILogger<Program> logger) =>
{
    var sanitizedReturnUrl = SanitizeReturnUrl(returnUrl);
    var signOutProperties = new AuthenticationProperties
    {
        RedirectUri = sanitizedReturnUrl
    };

    try
    {
        await httpContext.SignOutAsync(
            OpenIdConnectDefaults.AuthenticationScheme,
            signOutProperties);

        return Results.Empty;
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Frontend sign-out could not complete remote Keycloak logout. Falling back to local sign-out only.");
        await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.Redirect(sanitizedReturnUrl);
    }
});
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();

public partial class Program;
