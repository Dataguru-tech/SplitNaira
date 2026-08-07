import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { logger } from "./logger.js";

const EMAIL_TOKEN_SECRET = process.env.EMAIL_TOKEN_SECRET || process.env.JWT_SECRET || "dev-email-secret";
const PASSWORD_RESET_TOKEN_TTL = (process.env.PASSWORD_RESET_TOKEN_TTL || "30m") as SignOptions["expiresIn"];
const INVITATION_TOKEN_TTL = (process.env.INVITATION_TOKEN_TTL || "7d") as SignOptions["expiresIn"];

export interface EmailProvider {
  sendPasswordResetEmail(input: {
    to: string;
    token: string;
    resetUrl: string;
  }): Promise<void>;
  sendInvitationEmail(input: {
    to: string;
    token: string;
    inviteUrl: string;
    inviterWalletAddress?: string;
  }): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async sendPasswordResetEmail(input: { to: string; token: string; resetUrl: string }): Promise<void> {
    logger.info("Password reset email queued", {
      to: input.to,
      resetUrl: input.resetUrl,
      tokenHash: crypto.createHash("sha256").update(input.token).digest("hex"),
    });
  }

  async sendInvitationEmail(input: {
    to: string;
    token: string;
    inviteUrl: string;
    inviterWalletAddress?: string;
  }): Promise<void> {
    logger.info("Invitation email queued", {
      to: input.to,
      inviteUrl: input.inviteUrl,
      inviterWalletAddress: input.inviterWalletAddress,
      tokenHash: crypto.createHash("sha256").update(input.token).digest("hex"),
    });
  }
}

const provider: EmailProvider = new ConsoleEmailProvider();

type EmailTokenPurpose = "password_reset" | "invitation";

export function signEmailFlowToken(email: string, purpose: EmailTokenPurpose): string {
  const expiresIn = purpose === "password_reset" ? PASSWORD_RESET_TOKEN_TTL : INVITATION_TOKEN_TTL;
  return jwt.sign({ email, purpose }, EMAIL_TOKEN_SECRET, { expiresIn });
}

export function verifyEmailFlowToken(token: string, expectedPurpose: EmailTokenPurpose): { email: string } | null {
  try {
    const payload = jwt.verify(token, EMAIL_TOKEN_SECRET) as { email?: string; purpose?: string };
    if (payload.purpose !== expectedPurpose || !payload.email) {
      return null;
    }
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function getEmailProvider(): EmailProvider {
  return provider;
}
