import React from 'react'
import { Toaster as SonnerToaster } from 'sonner'

/**
 * Centralized Sonner Toaster.
 * Defaults to bottom-right position with rich colors and close button.
 * Rendered once in `App.jsx`.
 */
export function Toaster(props) {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      expand={false}
      toastOptions={{
        duration: 3500,
        classNames: {
          toast: 'rounded-md',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export default Toaster

 
