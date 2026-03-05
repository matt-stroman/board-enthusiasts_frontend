using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;

namespace Board.ThirdPartyLibrary.Frontend.Web.Components;

/// <summary>
/// Error boundary that logs unhandled component exceptions and preserves UI interactivity.
/// </summary>
public sealed class LoggingErrorBoundary : ErrorBoundary
{
    [Inject]
    private ILogger<LoggingErrorBoundary> Logger { get; set; } = default!;

    /// <inheritdoc />
    protected override Task OnErrorAsync(Exception exception)
    {
        Logger.LogError(exception, "Unhandled UI exception captured by global error boundary.");
        return Task.CompletedTask;
    }
}
