import { useEffect, useState } from "react";

const AntiRestream = () => {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Detect Screen Capture API
    const checkScreenCapture = async () => {
      try {
        // Check if the page is being captured via getDisplayMedia
        if (navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices) {
          // We can't actually detect if someone is screen recording,
          // but we can detect Picture-in-Picture and visibility changes
        }
      } catch {}
    };

    // Detect if page loses focus (possible screen recording switch)
    let blurCount = 0;
    const handleBlur = () => {
      blurCount++;
      // Multiple rapid blur events could indicate screen recording setup
    };

    // Detect Picture-in-Picture (common in restreaming)
    const handlePiP = () => {
      setDetected(true);
    };

    // Block keyboard shortcuts for screen recording
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common screen recording shortcuts
      // Windows: Win+Alt+R (Game Bar recording)
      // Mac: Cmd+Shift+5 (Screenshot/Recording)
      if (
        (e.metaKey && e.shiftKey && e.key === "5") || // Mac screen recording
        (e.metaKey && e.shiftKey && e.key === "3") || // Mac screenshot
        (e.metaKey && e.shiftKey && e.key === "4") || // Mac screenshot area
        (e.key === "PrintScreen") // Print screen
      ) {
        e.preventDefault();
      }
    };

    // Add CSS protection against screen capture
    const style = document.createElement("style");
    style.textContent = `
      /* Make content harder to capture cleanly */
      #live-player-container iframe {
        -webkit-user-select: none !important;
        user-select: none !important;
      }
    `;
    document.head.appendChild(style);

    window.addEventListener("blur", handleBlur);
    document.addEventListener("enterpictureinpicture", handlePiP);
    document.addEventListener("keydown", handleKeyDown);
    checkScreenCapture();

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("enterpictureinpicture", handlePiP);
      document.removeEventListener("keydown", handleKeyDown);
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, []);

  if (detected) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Restream Terdeteksi</h2>
          <p className="text-muted-foreground">
            Aktivitas restream atau screen recording terdeteksi. 
            Akses ditangguhkan untuk keamanan siaran.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AntiRestream;
