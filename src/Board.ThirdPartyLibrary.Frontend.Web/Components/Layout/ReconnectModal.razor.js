const reconnectModal = document.getElementById("components-reconnect-modal");
if (!reconnectModal) {
    throw new Error("Reconnect modal element was not found.");
}

reconnectModal.addEventListener("components-reconnect-state-changed", handleReconnectStateChanged);

const retryButton = document.getElementById("components-reconnect-button");
retryButton?.addEventListener("click", retry);

const resumeButton = document.getElementById("components-resume-button");
resumeButton?.addEventListener("click", resume);

function handleReconnectStateChanged(event) {
    if (event.detail.state === "show") {
        reconnectModal.showModal();
    } else if (event.detail.state === "hide") {
        reconnectModal.close();
    } else if (event.detail.state === "failed") {
        document.addEventListener("visibilitychange", retryWhenDocumentBecomesVisible);
    } else if (event.detail.state === "rejected") {
        location.reload();
    }
}

async function retry() {
    document.removeEventListener("visibilitychange", retryWhenDocumentBecomesVisible);

    if (!window.Blazor || typeof window.Blazor.reconnect !== "function") {
        location.reload();
        return;
    }

    try {
        // Reconnect will asynchronously return:
        // - true to mean success
        // - false to mean we reached the server, but the circuit is no longer available
        // - exception to mean we didn't reach the server (this can be sync or async)
        const successful = await Blazor.reconnect();
        if (!successful) {
            // Reached the server but this circuit cannot be resumed. Reload immediately.
            location.reload();
            return;
        }

        reconnectModal.close();
    } catch (err) {
        // We got an exception, server is currently unavailable
        document.addEventListener("visibilitychange", retryWhenDocumentBecomesVisible);
    }
}

async function resume() {
    await retry();
}

async function retryWhenDocumentBecomesVisible() {
    if (document.visibilityState === "visible") {
        await retry();
    }
}
