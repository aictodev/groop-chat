import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

type AvatarPalette = {
  background: string
  foreground: string
}

const fallbackPalette: AvatarPalette[] = [
  { background: "#dff8f4", foreground: "#006d5c" },
  { background: "#e8f2ff", foreground: "#0b5fff" },
  { background: "#f5ecff", foreground: "#5a2ca0" },
  { background: "#fff4e5", foreground: "#b35c00" },
  { background: "#ffeaf1", foreground: "#b11c5d" },
  { background: "#e7f7ff", foreground: "#005d8f" },
]

const getPaletteForSeed = (seed: string | number | undefined): AvatarPalette => {
  if (!seed && seed !== 0) {
    return fallbackPalette[0]
  }
  const normalized = typeof seed === "number" ? seed : Array.from(String(seed)).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return fallbackPalette[normalized % fallbackPalette.length]
}

const initialsFromName = (name?: string) => {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-whatsapp-accent-soft",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover object-center", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-whatsapp-accent-soft text-sm font-medium uppercase text-whatsapp-ink",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

interface ConversationAvatarProps extends React.ComponentPropsWithoutRef<typeof Avatar> {
  name?: string
  imageSrc?: string | null
  fallbackSeed?: string | number
  fallbackClassName?: string
}

const ConversationAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  ConversationAvatarProps
>(({ name, imageSrc, fallbackSeed, className, fallbackClassName, ...props }, ref) => {
  const palette = getPaletteForSeed(fallbackSeed ?? name ?? "default")
  return (
    <Avatar ref={ref} className={cn("h-11 w-11 bg-transparent", className)} {...props}>
      {imageSrc ? (
        <AvatarImage src={imageSrc} alt={name ?? "Conversation avatar"} />
      ) : null}
      <AvatarFallback
        className={cn("text-sm font-semibold", fallbackClassName)}
        style={{
          backgroundColor: palette.background,
          color: palette.foreground,
        }}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  )
})
ConversationAvatar.displayName = "ConversationAvatar"

export { Avatar, AvatarImage, AvatarFallback, ConversationAvatar }
