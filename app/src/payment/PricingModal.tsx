import { Dialog, DialogContent } from "../client/components/ui/dialog";
import { PricingContent } from "./PricingContent";

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

const modalSubtitle = (
  <span>
    Upgrade your plan to unlock more features and get the most out of TeslaForms.
  </span>
);

export function PricingModal({ open, onClose }: PricingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <PricingContent subtitle={modalSubtitle} />
      </DialogContent>
    </Dialog>
  );
}
