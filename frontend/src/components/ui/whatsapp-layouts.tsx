import * as React from "react"
import { cn } from "@/lib/utils"

// WhatsApp Sidebar Component
export const WhatsAppSidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col h-full bg-whatsapp-sidebar-bg border-r border-whatsapp-border-light",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppSidebar.displayName = "WhatsAppSidebar"

// WhatsApp Sidebar Header
export const WhatsAppSidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between h-16 px-4 py-2 bg-whatsapp-sidebar-header border-b border-whatsapp-border-light",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppSidebarHeader.displayName = "WhatsAppSidebarHeader"

// WhatsApp Chat Container
export const WhatsAppChatContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col h-full bg-whatsapp-chat-bg",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppChatContainer.displayName = "WhatsAppChatContainer"

// WhatsApp Chat Header
export const WhatsAppChatHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center h-16 px-4 py-2 bg-whatsapp-sidebar-header border-b border-whatsapp-border-light shadow-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppChatHeader.displayName = "WhatsAppChatHeader"

// WhatsApp Messages Area
export const WhatsAppMessagesArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-1 overflow-y-auto p-4 space-y-2 bg-whatsapp-chat-bg",
      "bg-[url('data:image/svg+xml,%3csvg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"%3e%3cdefs%3e%3cpattern id=\"whatsapp-bg\" patternUnits=\"userSpaceOnUse\" width=\"60\" height=\"60\"%3e%3cpath d=\"M0 0h60v60H0z\" fill=\"%23efeae2\"/%3e%3cpath d=\"M30 0v60M0 30h60\" stroke=\"%23f0f2f5\" stroke-width=\"0.5\" opacity=\"0.3\"/%3e%3c/pattern%3e%3c/defs%3e%3crect width=\"100%25\" height=\"100%25\" fill=\"url(%23whatsapp-bg)\"/%3e%3c/svg%3e')]",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppMessagesArea.displayName = "WhatsAppMessagesArea"

// WhatsApp Input Area
export const WhatsAppInputArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-2 p-4 bg-whatsapp-sidebar-header border-t border-whatsapp-border-light",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
WhatsAppInputArea.displayName = "WhatsAppInputArea"

// WhatsApp User Info (for header and sidebar items)
export const WhatsAppUserInfo = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    avatar?: React.ReactNode
    name?: string
    status?: string
    time?: string
    showTime?: boolean
  }
>(({ className, avatar, name, status, time, showTime = false, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-3 w-full",
      className
    )}
    {...props}
  >
    {avatar}
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-whatsapp-text-primary font-medium text-sm truncate">
          {name}
        </h3>
        {showTime && time && (
          <span className="text-whatsapp-text-tertiary text-xs">
            {time}
          </span>
        )}
      </div>
      {status && (
        <p className="text-whatsapp-text-secondary text-xs truncate">
          {status}
        </p>
      )}
    </div>
    {children}
  </div>
))
WhatsAppUserInfo.displayName = "WhatsAppUserInfo"

// WhatsApp Conversation Item
export const WhatsAppConversationItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean
  }
>(({ className, active, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex items-center w-full p-3 text-left transition-colors hover:bg-whatsapp-sidebar-hover",
      active && "bg-whatsapp-sidebar-active",
      className
    )}
    {...props}
  >
    {children}
  </button>
))
WhatsAppConversationItem.displayName = "WhatsAppConversationItem"