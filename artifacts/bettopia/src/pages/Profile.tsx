import React, { useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Trophy, Coins, Calendar, ArrowUpRight, Camera, TrendingUp, TrendingDown } from "lucide-react";
import { GemIcon } from "../components/GemIcon";
import { UserAvatar } from "../components/UserAvatar";
import { format } from "date-fns";
import { getTierColor } from "../lib/tierColor";

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const { data: meData } = useGetMe({ query: { enabled: !!user } });
  const profileData = meData || user;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG or PNG photo.");
      return;
    }
    if (file.size > 3_000_000) {
      setError("Image must be under 3MB.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploading(true);
      try {
        const res = await fetch(`/api/auth/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar: dataUrl }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Upload failed.");
        } else {
          const updated = await res.json();
          updateUser({ avatar: updated.avatar });
        }
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  if (!profileData) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-muted-foreground">Please log in to view your profile.</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex flex-col md:flex-row gap-8 items-start">
          <Card className="flex-1 bg-card border-border">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div
                  className={`w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden cursor-pointer group${(profileData.level || 1) >= 150 ? " rainbow-avatar-border" : ""}`}
                  style={(profileData.level || 1) >= 150
                    ? {}
                    : { border: `4px solid ${getTierColor(profileData.level || 1)}` }}
                  onClick={handleAvatarClick}
                  title="Click to change your profile picture"
                >
                  <UserAvatar avatar={profileData.avatar} size={128} />
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full border-2 border-background whitespace-nowrap${(profileData.level || 1) >= 150 ? " rainbow-level-badge" : ""}`}
                  style={(profileData.level || 1) >= 150 ? {} : { background: getTierColor(profileData.level || 1), color: "#fff" }}
                >
                  LVL {profileData.level || 1}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight">{profileData.username}</h1>
                <p className="text-muted-foreground mt-1 flex items-center gap-2 justify-center">
                  <Calendar className="w-4 h-4" />
                  Joined {profileData.createdAt ? format(new Date(profileData.createdAt), "MMM d, yyyy") : "Recently"}
                </p>
              </div>

              {uploading && <p className="text-xs text-muted-foreground">Saving photo…</p>}
              {error && <p className="text-xs text-red-400">{error}</p>}
              {!uploading && !error && (
                <p className="text-xs text-muted-foreground">Click your picture to change it</p>
              )}
            </CardContent>
          </Card>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-blue-500/10 text-blue-500 rounded-xl">
                  <Coins className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {profileData.balance.toLocaleString()} <GemIcon size={20} />
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-primary/10 text-primary rounded-xl">
                  <ArrowUpRight className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Total Wagered</p>
                  <p className="text-2xl font-bold flex items-center gap-2">
                    {(profileData.totalWagered || 0).toLocaleString()} <GemIcon size={20} />
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-green-500/10 text-green-400 rounded-xl">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">All Time High</p>
                  <p className="text-2xl font-bold text-green-400 flex items-center gap-2">
                    {(profileData as any).allTimeHigh != null
                      ? <>{((profileData as any).allTimeHigh as number).toLocaleString(undefined, { maximumFractionDigits: 2 })} <GemIcon size={20} /></>
                      : <span className="text-muted-foreground text-lg">—</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Most profit at any point</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-red-500/10 text-red-400 rounded-xl">
                  <TrendingDown className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">All Time Low</p>
                  <p className="text-2xl font-bold text-red-400 flex items-center gap-2">
                    {(profileData as any).allTimeLow != null
                      ? <>{((profileData as any).allTimeLow as number).toLocaleString(undefined, { maximumFractionDigits: 2 })} <GemIcon size={20} /></>
                      : <span className="text-muted-foreground text-lg">—</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Biggest loss at any point</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center p-8 text-muted-foreground">
              No recent activity found.
            </div>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
