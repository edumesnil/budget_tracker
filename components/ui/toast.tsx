import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col sm:items-center sm:justify-center md:max-w-[420px] mx-auto left-1/2 -translate-x-1/2",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border shadow-sm transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full data-[state=open]:sm:slide-in-from-bottom-full p-4 pr-6 max-w-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground bg-white dark:bg-gray-800",
        destructive:
          "destructive group border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200",
        success:
          "success group border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900 dark:text-green-200",
        info: "info group border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900 dark:text-blue-200",
        warning:
          "warning group border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center rounded-md border bg-transparent px-2 text-xs font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-red-300 group-[.destructive]:hover:border-red-400 group-[.destructive]:hover:bg-red-100 group-[.destructive]:focus:ring-red-400 dark:group-[.destructive]:hover:bg-red-800",
      "group-[.success]:border-green-300 group-[.success]:hover:border-green-400 group-[.success]:hover:bg-green-100 group-[.success]:focus:ring-green-400 dark:group-[.success]:hover:bg-green-800",
      "group-[.info]:border-blue-300 group-[.info]:hover:border-blue-400 group-[.info]:hover:bg-blue-100 group-[.info]:focus:ring-blue-400 dark:group-[.info]:hover:bg-blue-800",
      "group-[.warning]:border-yellow-300 group-[.warning]:hover:border-yellow-400 group-[.warning]:hover:bg-yellow-100 group-[.warning]:focus:ring-yellow-400 dark:group-[.warning]:hover:bg-yellow-800",
      className,
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-70 transition-opacity hover:text-foreground hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100",
      "group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 dark:group-[.destructive]:text-red-200 dark:group-[.destructive]:hover:text-red-50",
      "group-[.success]:text-green-300 group-[.success]:hover:text-green-50 dark:group-[.success]:text-green-200 dark:group-[.success]:hover:text-green-50",
      "group-[.info]:text-blue-300 group-[.info]:hover:text-blue-50 dark:group-[.info]:text-blue-200 dark:group-[.info]:hover:text-blue-50",
      "group-[.warning]:text-yellow-300 group-[.warning]:hover:text-yellow-50 dark:group-[.warning]:text-yellow-200 dark:group-[.warning]:hover:text-yellow-50",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-xs opacity-90 leading-relaxed mt-1", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

