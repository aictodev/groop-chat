import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // WhatsApp-specific variants aligned with the new design system tokens
        whatsapp:
          "rounded-bubble border-none bg-whatsapp-accent text-white shadow-sm transition hover:bg-whatsapp-accent-dark focus-visible:ring-whatsapp-accent/50",
        "whatsapp-secondary":
          "rounded-bubble border border-whatsapp-divider bg-whatsapp-surface text-whatsapp-ink shadow-sm hover:bg-whatsapp-panel-muted",
        "whatsapp-ghost":
          "rounded-bubble border-none bg-transparent text-whatsapp-ink-soft hover:bg-whatsapp-panel-muted hover:text-whatsapp-ink",
        "whatsapp-icon":
          "rounded-full border-none bg-whatsapp-accent text-white shadow-sm hover:bg-whatsapp-accent-dark",
        "whatsapp-minimal":
          "rounded-bubble border-none bg-transparent p-2 text-whatsapp-ink-soft hover:bg-whatsapp-panel-muted",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",

        // WhatsApp-specific sizes
        "whatsapp-avatar": "h-9 w-9 rounded-full p-0",
        "whatsapp-icon": "h-8 w-8 rounded-full p-0",
        "whatsapp-action": "h-10 px-4 py-2",
        "whatsapp-minimal": "h-auto p-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
