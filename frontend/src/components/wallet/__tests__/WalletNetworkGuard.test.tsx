import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletNetworkGuard } from '../WalletNetworkGuard';
import { useWallet } from '@/hooks/useWallet';

// Mock the wallet hook
vi.mock('@/hooks/useWallet');

describe('WalletNetworkGuard — Unsupported Network States (#827)', () => {
  const mockDisconnect = vi.fn();
  const mockSwitchNetwork = vi.fn();
  const mockGuardedAction = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const baseConnectedWallet = {
    wallet: {
      connected: true,
      address: 'GABC1234567890123456789012345678901234567890123456789012',
      network: 'PUBLIC',
      expectedNetwork: 'TESTNET',
      isSupportedNetwork: false,
      disconnect: mockDisconnect,
      switchNetwork: mockSwitchNetwork,
    },
    loading: false,
    error: null,
    connect: vi.fn(),
    refresh: vi.fn(),
  };

  it('renders warning banner displaying active and expected networks when connected to an unsupported network', () => {
    vi.mocked(useWallet).mockReturnValue(baseConnectedWallet as any);

    render(
      <WalletNetworkGuard>
        <button onClick={mockGuardedAction}>Submit Split Payment</button>
      </WalletNetworkGuard>,
    );

    // Assert warning banner presence
    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();

    // Assert banner contains active and expected network strings
    expect(banner).toHaveTextContent(/wrong network/i);
    expect(banner).toHaveTextContent(/actual: public/i);
    expect(banner).toHaveTextContent(/expected: testnet/i);
  });

  it('disables or guards action buttons while connected to an unsupported network', () => {
    vi.mocked(useWallet).mockReturnValue(baseConnectedWallet as any);

    render(
      <WalletNetworkGuard>
        <button onClick={mockGuardedAction}>Submit Split Payment</button>
      </WalletNetworkGuard>,
    );

    const actionButton = screen.getByRole('button', { name: /submit split payment/i });

    // Assert button is visually and functionally disabled or intercepted
    expect(actionButton).toBeDisabled();

    fireEvent.click(actionButton);
    expect(mockGuardedAction).not.toHaveBeenCalled();
  });

  it('enables guarded actions and clears warning banner upon reconnect after network correction', async () => {
    vi.mocked(useWallet).mockReturnValue(baseConnectedWallet as any);

    // 1. Initial render on unsupported network (PUBLIC instead of TESTNET)
    const { rerender } = render(
      <WalletNetworkGuard>
        <button onClick={mockGuardedAction}>Submit Split Payment</button>
      </WalletNetworkGuard>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit split payment/i })).toBeDisabled();

    // 2. Mock network switch / reconnection event correcting network state to TESTNET
    const correctedWallet = {
      ...baseConnectedWallet,
      wallet: {
        ...baseConnectedWallet.wallet,
          network: 'TESTNET',
      },
    };
    vi.mocked(useWallet).mockReturnValue(correctedWallet as any);

    // Re-render component with updated hook state
    rerender(
      <WalletNetworkGuard>
        <button onClick={mockGuardedAction}>Submit Split Payment</button>
      </WalletNetworkGuard>,
    );

    // Assert warning banner is removed
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Assert action button is now enabled and functional
    const enabledButton = screen.getByRole('button', { name: /submit split payment/i });
    expect(enabledButton).not.toBeDisabled();

    fireEvent.click(enabledButton);
    expect(mockGuardedAction).toHaveBeenCalledTimes(1);
  });
});
