import { Dialog, DialogContent } from "../client/components/ui/dialog";
import { defaultPricingSubtitle, PricingContent } from "./PricingContent";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: PricingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[92vh] w-[min(95vw,1400px)] max-w-none gap-0 overflow-y-auto p-4 sm:p-6">
        <PricingContent subtitle={defaultPricingSubtitle} variant="modal" />
      </DialogContent>
    </Dialog>
  );
}
