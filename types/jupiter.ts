declare global {
  interface Window {
    Jupiter: JupiterPlugin;
  }
}

export type WidgetPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type WidgetSize = 'sm' | 'default';
export type SwapMode = "ExactInOrOut" | "ExactIn" | "ExactOut";

export interface FormProps {
  swapMode?: SwapMode;
  initialAmount?: string;
  initialInputMint?: string;
  initialOutputMint?: string;
  fixedAmount?: boolean;
  fixedMint?: string;
  referralAccount?: string;
  referralFee?: number;
}

export interface IInit {
  localStoragePrefix?: string;
  formProps?: FormProps;
  defaultExplorer?: 'Solana Explorer' | 'Solscan' | 'Solana Beach' | 'SolanaFM';
  autoConnect?: boolean;
  displayMode?: 'modal' | 'integrated' | 'widget';
  integratedTargetId?: string;
  widgetStyle?: {
    position?: WidgetPosition;
    size?: WidgetSize;
  };
  containerClassName?: string;
  enableWalletPassthrough?: boolean;
  onSuccess?: (data: any) => void;
  onSwapError?: (data: any) => void;
}

export interface JupiterPlugin {
  init: (props: IInit) => void;
  resume: () => void;
  close: () => void;
}

export {};