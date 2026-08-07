import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, vi } from "vitest";

expect.extend(matchers);

Object.assign(globalThis, { jest: vi });

const messages: Record<string, string> = {
  "header.subtitle": "Premium royalty management on Stellar.",
  "actions.connectWallet": "Connect Wallet",
  "actions.switchWallet": "Switch Wallet",
  "actions.sync": "Sync",
  "actions.disconnect": "Disconnect",
  "actions.executePayout": "Execute Payout",
  "actions.cancel": "Cancel",
  "actions.saveChanges": "Save Changes",
  "actions.lockProject": "Lock Project",
  "actions.confirmDeposit": "Confirm Deposit",
  "actions.confirmPause": "Confirm Pause",
  "actions.confirmResume": "Confirm Resume",
  "wallet.statusConnected": "Status: Connected",
  "wallet.wallet": "Wallet",
  "wallet.network": "Network",
  "tabs.dashboard": "Dashboard",
  "tabs.create": "Create",
  "tabs.manage": "Manage & Distribute",
  "tabs.projects": "Projects",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => messages[key] ?? key,
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
});
