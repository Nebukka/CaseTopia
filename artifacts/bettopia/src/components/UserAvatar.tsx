import React from "react";
import defaultAvatarSrc from "@assets/set_(4)_1775533986430.png";

interface UserAvatarProps {
  avatar?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({ avatar, size = 32, className = "" }: UserAvatarProps) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt="Profile"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        className={className}
      />
    );
  }
  return (
    <img
      src={defaultAvatarSrc}
      alt="Profile"
      style={{ width: size, height: size, imageRendering: "pixelated", objectFit: "contain", flexShrink: 0 }}
      className={className}
    />
  );
}
