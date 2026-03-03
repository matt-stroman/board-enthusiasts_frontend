using System.Security.Claims;
using Board.ThirdPartyLibrary.Frontend.Web.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;

namespace Board.ThirdPartyLibrary.Frontend.Web.Tests;

public sealed class DistributedCacheTicketStoreTests
{
    [Fact]
    public async Task StoreAndRetrieveAsync_RoundTripsAuthenticationTicket()
    {
        var store = CreateStore();
        var ticket = CreateTicket();

        var key = await store.StoreAsync(ticket);
        var restored = await store.RetrieveAsync(key);

        Assert.NotNull(restored);
        Assert.Equal("user-123", restored!.Principal.FindFirstValue("sub"));
        Assert.Equal("access-token-value", restored.Properties.GetTokenValue("access_token"));
        Assert.Equal("id-token-value", restored.Properties.GetTokenValue("id_token"));
    }

    [Fact]
    public async Task RemoveAsync_DeletesStoredTicket()
    {
        var store = CreateStore();
        var key = await store.StoreAsync(CreateTicket());

        await store.RemoveAsync(key);

        var restored = await store.RetrieveAsync(key);
        Assert.Null(restored);
    }

    private static DistributedCacheTicketStore CreateStore()
    {
        var services = new ServiceCollection();
        services.AddDistributedMemoryCache();
        var provider = services.BuildServiceProvider();
        return new DistributedCacheTicketStore(provider.GetRequiredService<IDistributedCache>());
    }

    private static AuthenticationTicket CreateTicket()
    {
        var identity = new ClaimsIdentity(
        [
            new Claim("sub", "user-123"),
            new Claim(ClaimTypes.Name, "Local Admin")
        ],
        authenticationType: "Cookies");

        var properties = new AuthenticationProperties
        {
            ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(30)
        };

        properties.StoreTokens(
        [
            new AuthenticationToken { Name = "access_token", Value = "access-token-value" },
            new AuthenticationToken { Name = "id_token", Value = "id-token-value" }
        ]);

        return new AuthenticationTicket(new ClaimsPrincipal(identity), properties, "Cookies");
    }
}
