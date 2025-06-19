import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive"
}

export function useToast() {
  return {
    toast: ({ title, description, variant = "default", ...props }: ToastProps) => {
      if (variant === "destructive") {
        sonnerToast.error(title, {
          description,
          ...props,
        })
      } else {
        sonnerToast(title, {
          description,
          ...props,
        })
      }
    },
    dismiss: sonnerToast.dismiss,
  }
}

export { sonnerToast as toast }