import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../lib/cn";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
};

export default function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md",
            "rounded-t-3xl border border-slate-800 bg-slate-950 p-4 shadow-xl",
            "pb-[calc(env(safe-area-inset-bottom)+16px)]"
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-700" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-50">
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                type="button"
              >
                Close
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
