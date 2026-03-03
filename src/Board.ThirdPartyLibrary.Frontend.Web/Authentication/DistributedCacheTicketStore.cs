using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Caching.Distributed;

namespace Board.ThirdPartyLibrary.Frontend.Web.Authentication;

/// <summary>
/// Stores authentication tickets in a distributed cache so browser cookies only carry a session key.
/// </summary>
internal sealed class DistributedCacheTicketStore(IDistributedCache cache) : ITicketStore
{
    private const string KeyPrefix = "auth-ticket:";

    /// <inheritdoc />
    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = BuildCacheKey();
        await RenewAsync(key, ticket);
        return key;
    }

    /// <inheritdoc />
    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        ArgumentNullException.ThrowIfNull(ticket);

        var options = BuildCacheEntryOptions(ticket);
        var payload = TicketSerializer.Default.Serialize(ticket);
        await cache.SetAsync(key, payload, options);
    }

    /// <inheritdoc />
    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        var payload = await cache.GetAsync(key);
        return payload is null ? null : TicketSerializer.Default.Deserialize(payload);
    }

    /// <inheritdoc />
    public Task RemoveAsync(string key)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        return cache.RemoveAsync(key);
    }

    private static string BuildCacheKey() => $"{KeyPrefix}{Guid.NewGuid():N}";

    private static DistributedCacheEntryOptions BuildCacheEntryOptions(AuthenticationTicket ticket)
    {
        var options = new DistributedCacheEntryOptions();

        if (ticket.Properties.ExpiresUtc is { } expiresUtc)
        {
            options.AbsoluteExpiration = expiresUtc;
        }
        else
        {
            options.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(8);
        }

        return options;
    }
}
