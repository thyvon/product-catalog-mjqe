import { useState } from "react";

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel?: string,
  ) => setState({ isOpen: true, title, message, onConfirm, confirmLabel });

  const close = () => setState((s) => ({ ...s, isOpen: false }));

  return { confirmState: state, confirm, closeConfirm: close };
}
