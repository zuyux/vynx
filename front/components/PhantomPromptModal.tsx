import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PhantomPromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PhantomPromptModal({ open, onOpenChange }: PhantomPromptModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wallet Not Detected</DialogTitle>
          <DialogDescription>
            To connect your wallet, please install the <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Phantom Wallet</a> extension, or use other supported wallets like <a href="https://brave.com/wallet/" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Brave Wallet</a>.
            <br />
            After installing, refresh this page and click Connect again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
