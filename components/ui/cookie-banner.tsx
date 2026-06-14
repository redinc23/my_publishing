"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 border-t bg-background shadow-lg">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground flex-1">
          We use cookies to improve your experience on our site and to analyze site traffic.
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsVisible(false)}>
            Dismiss
          </Button>
          <Button onClick={handleAccept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
