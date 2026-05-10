"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConnectBox, usePhantom } from "@phantom/react-sdk";

export default function AuthCallback() {
  const { isConnected } = usePhantom();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isConnected) {
      const alias = searchParams.get("alias");
      if (alias) {
        router.replace(`/profile/buy-alias?alias=${encodeURIComponent(alias)}`);
      } else {
        router.replace("/dashboard");
      }
    }
  }, [isConnected, router, searchParams]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <ConnectBox />
    </div>
  );
}
