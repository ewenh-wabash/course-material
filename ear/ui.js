
// Helper to load a script dynamically if not already loaded
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            // Already loaded
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

const colors = ["#0f0", "#596", "#3f9", "#1e6"];
const zIndex = -1000;

async function fireConfetti() {
    // Make sure confetti library is loaded
    if (typeof confetti === 'undefined') {
        await loadScript('../../../confetti.browser.min.js'); // adjust path if needed
    }

    // Now call confetti bursts
    confetti({
        particleCount: 350,
        spread: 360,
        scalar: 1.75,
        ticks: 110,
        origin: { y: 0.4 },
        zIndex: zIndex,
        startVelocity: 50,
        colors: colors
    });

    confetti({
        particleCount: 120,
        spread: 360,
        scalar: 1.75,
        ticks: 125,
        origin: { y: 0.4 },
        zIndex: zIndex,
        startVelocity: 20,
        colors: colors
    });

    confetti({
        particleCount: 40,
        spread: 360,
        scalar: 1.75,
        ticks: 140,
        origin: { y: 0.4 },
        zIndex: zIndex,
        startVelocity: 8,
        colors: colors
    });
}

// Expose globally
window.fireConfetti = fireConfetti;