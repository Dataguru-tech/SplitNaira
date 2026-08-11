"use client";

import React, { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useNetworkGuard } from "@/hooks/useNetworkGuard";
import { NetworkWarningBanner } from "@/components/NetworkWarningBanner";
import type { WalletState } from "@/lib/wallet";

interface WalletNetworkGuardProps {
  children: ReactNode;
}

function isButtonElement(element: ReactElement): element is ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement>> {
  return element.type === "button";
}

function disableInteractiveChildren(children: ReactNode): ReactNode {
  return React.Children.map(children, (child) => {
    if (!isValidElement(child)) return child;

    const typedChild = child as ReactElement<{ children?: ReactNode }>;
    const guardedChildren = typedChild.props.children
      ? disableInteractiveChildren(typedChild.props.children)
      : typedChild.props.children;

    if (isButtonElement(typedChild)) {
      return cloneElement(typedChild, {
        disabled: true,
        "aria-disabled": true,
        children: guardedChildren,
      });
    }

    return cloneElement(typedChild, {
      children: guardedChildren,
    });
  });
}

export function WalletNetworkGuard({ children }: WalletNetworkGuardProps) {
  const { wallet } = useWallet();
  const guard = useNetworkGuard(wallet as WalletState);

  if (!guard.mismatch) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <NetworkWarningBanner guard={guard} />
      {disableInteractiveChildren(children)}
    </div>
  );
}
