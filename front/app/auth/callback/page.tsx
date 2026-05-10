"use client";

import { ConnectBox } from "@phantom/react-sdk";

export default function AuthCallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <ConnectBox />
    </div>
  );
}
