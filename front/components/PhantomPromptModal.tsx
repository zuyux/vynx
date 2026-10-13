
import { useCopy } from "@/i18n/copy";
import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PhantomPromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PhantomPromptModal({ open, onOpenChange }: PhantomPromptModalProps) {
  const t = useCopy();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Wallet Not Detected")}</DialogTitle>
          <DialogDescription>{t(" To connect your wallet, please install the ")}<a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">{t("Phantom Wallet")}</a>{t(" extension, or use other supported wallets like ")}<a href="https://brave.com/wallet/" target="_blank" rel="noopener noreferrer" className="underline text-blue-500">{t("Brave Wallet")}</a>.
            <br />{t(" After installing, refresh this page and click Connect again. ")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("Close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
