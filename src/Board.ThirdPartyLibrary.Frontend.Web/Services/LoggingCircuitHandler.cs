using Microsoft.AspNetCore.Components.Server.Circuits;

namespace Board.ThirdPartyLibrary.Frontend.Web.Services;

/// <summary>
/// Logs circuit lifecycle events to aid local diagnostics when UI interactivity degrades.
/// </summary>
public sealed class LoggingCircuitHandler(ILogger<LoggingCircuitHandler> logger) : CircuitHandler
{
    /// <inheritdoc />
    public override Task OnCircuitOpenedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        logger.LogInformation("Circuit opened: {CircuitId}", circuit.Id);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override Task OnCircuitClosedAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        logger.LogWarning("Circuit closed: {CircuitId}", circuit.Id);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override Task OnConnectionUpAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        logger.LogInformation("Circuit connection up: {CircuitId}", circuit.Id);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override Task OnConnectionDownAsync(Circuit circuit, CancellationToken cancellationToken)
    {
        logger.LogWarning("Circuit connection down: {CircuitId}", circuit.Id);
        return Task.CompletedTask;
    }
}
