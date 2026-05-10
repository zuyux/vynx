"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import { Sidebar } from "@/components/Sidebar";

const TABS = ["Profile", "Appearance", "Links", "Socials", "Settings"];

const MONETIZATION = [
  { icon: "🔔", label: "Subscribe", sub: "Weekly exclusive content", color: "bg-[#3d1f6e]" },
  { icon: "📅", label: "Book a Call", sub: "1:1 video call", color: "bg-[#1a2a50]" },
  { icon: "🛍️", label: "Digital Store", sub: "Photos, videos & more", color: "bg-[#3d1229]" },
  { icon: "💖", label: "Tip Me", sub: "Support my work", color: "bg-[#3d1229]" },
];

export default function MyPagePage() {
  const [activeTab, setActiveTab] = useState("Profile");
  const [username, setUsername] = useState("anthozg");
  const [displayName, setDisplayName] = useState("Anthozg");
  const [bio, setBio] = useState(
    "Digital creator on Solana.\nContent, calls, subscriptions & more.\nAll powered by Solana ⚡"
  );
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [bannerImg, setBannerImg] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleProfileImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setProfileImg(URL.createObjectURL(file));
  };

  const handleBannerImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBannerImg(URL.createObjectURL(file));
  };

  return (
    <div className="min-h-screen flex text-white font-sans" style={{ background: "#050507" }}>
      <Sidebar />

      {/* Main + Preview */}
      <div className="flex flex-1 ml-64 min-h-screen">
        {/* ── Main Content ── */}
        <main className="flex-1 flex flex-col overflow-y-auto" style={{ background: "#07070A" }}>
          {/* Top Header */}
          <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Page</h1>
              <p className="text-zinc-500 text-sm mt-1">
                Customize your creator page and manage your profile.
              </p>
            </div>
            <button
              className="flex items-center gap-2 text-white text-sm font-semibold rounded-xl px-5 py-3 transition"
              style={{
                background: "linear-gradient(135deg,#6B4EFF,#9F5CFF)",
              }}
            >
              <span className="text-green-300">✓</span> Save Changes
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 px-8 pt-5 border-b border-white/5">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm font-medium transition-all relative ${
                  activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6B4EFF] rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="px-8 py-8 flex flex-col gap-7 max-w-2xl">
            {activeTab === "Profile" && (
              <>
                {/* Section title */}
                <h2 className="text-base font-semibold text-white">Profile Information</h2>

                {/* Username */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Username</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 rounded-xl px-4 text-sm font-medium text-white outline-none transition placeholder-zinc-600"
                      style={{
                        background: "#0F1016",
                        border: "1px solid rgba(255,255,255,.06)",
                        height: 52,
                      }}
                      placeholder="yourhandle"
                    />
                    <span
                      className="flex items-center gap-2 text-xs text-zinc-400 rounded-xl px-4 h-13 shrink-0"
                      style={{
                        background: "#0F1016",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      vynx.me/{username || "yourhandle"}
                      <span className="text-green-400 text-base">✓</span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600">This is your unique link on VYNX.</p>
                </div>

                {/* Display Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="rounded-xl px-4 text-sm font-medium text-white outline-none transition placeholder-zinc-600"
                    style={{
                      background: "#0F1016",
                      border: "1px solid rgba(255,255,255,.06)",
                      height: 52,
                    }}
                    placeholder="Your Name"
                  />
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400 font-medium">Bio</label>
                  <div className="relative">
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={160}
                      rows={4}
                      className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder-zinc-600 resize-none"
                      style={{
                        background: "#0F1016",
                        border: "1px solid rgba(255,255,255,.06)",
                      }}
                      placeholder="Tell your audience about yourself..."
                    />
                    <span className="absolute bottom-3 right-4 text-xs text-zinc-600">
                      {bio.length}/160
                    </span>
                  </div>
                </div>

                {/* Profile Image */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-zinc-400 font-medium">Profile Image</label>
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                      {profileImg ? (
                        <Image src={profileImg} alt="profile" width={80} height={80} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">👤</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => profileInputRef.current?.click()}
                        className="flex items-center gap-2 text-sm font-medium text-white rounded-xl px-4 py-2.5 transition border border-white/10 hover:border-white/20"
                        style={{ background: "#0F1016" }}
                      >
                        ↑ Change Image
                      </button>
                      <p className="text-xs text-zinc-600">JPG, PNG or GIF. Max 5MB.</p>
                      <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImg} />
                    </div>
                  </div>
                </div>

                {/* Banner Image */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-zinc-400 font-medium">Banner Image</label>
                  <div
                    className="w-full h-36 rounded-xl overflow-hidden flex items-end relative cursor-pointer border border-white/5"
                    style={{
                      background: bannerImg
                        ? undefined
                        : "linear-gradient(135deg,#6B4EFF 0%,#FF4EC6 100%)",
                    }}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    {bannerImg && (
                      <Image src={bannerImg} alt="banner" fill className="object-cover" />
                    )}
                    <button
                      className="relative z-10 m-4 flex items-center gap-2 text-white text-sm font-semibold rounded-xl px-4 py-2 transition"
                      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
                    >
                      ↑ Change Banner
                    </button>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerImg} />
                  </div>
                  <p className="text-xs text-zinc-600">Recommended: 1800x400px</p>
                </div>
              </>
            )}

            {activeTab !== "Profile" && (
              <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
                {activeTab} settings coming soon.
              </div>
            )}
          </div>
        </main>

        {/* ── Preview Panel ── */}
        <aside
          className="w-105 shrink-0 flex flex-col border-l border-white/5 sticky top-0 h-screen overflow-y-auto"
          style={{ background: "#07070A" }}
        >
          <div className="px-7 pt-8 pb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Preview</p>
              <p className="text-xs text-zinc-500 mt-0.5">This is how your page will look.</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg border border-white/10 hover:border-white/20 transition text-white text-sm">📱</button>
              <button className="p-2 rounded-lg border border-white/10 hover:border-white/20 transition text-zinc-500 text-sm">🖥️</button>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex-1 flex items-start justify-center px-7 pb-8">
            <div
              className="w-full max-w-75 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              style={{ background: "#0d0d1a" }}
            >
              {/* Banner */}
              <div
                className="w-full h-24 relative"
                style={{
                  background: bannerImg
                    ? undefined
                    : "linear-gradient(135deg,#6B4EFF 0%,#FF4EC6 100%)",
                }}
              >
                {bannerImg && <Image src={bannerImg} alt="banner" fill className="object-cover" />}
              </div>

              {/* Avatar + info */}
              <div className="flex flex-col items-center px-5 pb-4 -mt-10">
                <div className="w-20 h-20 rounded-full border-4 border-[#0d0d1a] overflow-hidden bg-zinc-800 mb-3">
                  {profileImg ? (
                    <Image src={profileImg} alt="avatar" width={80} height={80} className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-2xl">👤</div>
                  )}
                </div>
                <p className="font-bold text-base text-white flex items-center gap-1">
                  {displayName || "Your Name"}
                  <span className="text-[#6B4EFF] text-sm">✓</span>
                </p>
                <p className="text-zinc-500 text-xs mb-2">@{username || "yourhandle"}</p>
                <p className="text-zinc-400 text-xs text-center leading-relaxed whitespace-pre-line mb-3">
                  {bio}
                </p>
                {/* Socials */}
                <div className="flex gap-3 mb-4">
                  {["𝕏", "📸", "✈️", "🔗"].map((icon, i) => (
                    <button key={i} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm hover:bg-white/10 transition border border-white/5">
                      {icon}
                    </button>
                  ))}
                </div>

                {/* Monetization blocks */}
                <div className="w-full flex flex-col gap-2">
                  {MONETIZATION.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/5 cursor-pointer hover:border-white/10 transition"
                      style={{ background: "#121218" }}
                    >
                      <div className={`w-8 h-8 rounded-full ${m.color} flex items-center justify-center text-sm shrink-0`}>
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">{m.label}</p>
                        <p className="text-zinc-500 text-[10px]">{m.sub}</p>
                      </div>
                      <span className="text-zinc-600 text-xs">›</span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-[10px] text-zinc-700">
                  Powered by <span className="font-bold text-zinc-500">VYNX</span>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
