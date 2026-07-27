import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getDataSource } from "../services/database.js";
import { User } from "../entities/User.js";
import {
  getEmailProvider,
  signEmailFlowToken,
  verifyEmailFlowToken,
} from "../services/email-provider.js";

export const authEmailRouter = Router();

const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  resetUrlBase: z.string().url().optional(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const invitationRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  inviterWalletAddress: z.string().optional(),
  inviteUrlBase: z.string().url().optional(),
});

const invitationAcceptSchema = z.object({
  token: z.string().min(1),
});

authEmailRouter.post("/password-reset/request", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, resetUrlBase } = passwordResetRequestSchema.parse(req.body);

    const user = await getDataSource().getRepository(User).findOne({
      where: { email },
    });

    if (!user) {
      return res.status(202).json({ success: true });
    }

    const token = signEmailFlowToken(email, "password_reset");
    const base = resetUrlBase ?? process.env.PASSWORD_RESET_URL_BASE ?? "https://app.splitnaira.com/reset-password";
    const resetUrl = `${base}?token=${encodeURIComponent(token)}`;

    await getEmailProvider().sendPasswordResetEmail({
      to: email,
      token,
      resetUrl,
    });

    return res.status(202).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

authEmailRouter.post("/password-reset/confirm", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = passwordResetConfirmSchema.parse(req.body);
    const payload = verifyEmailFlowToken(token, "password_reset");
    if (!payload) {
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }
    return res.status(200).json({ success: true, email: payload.email });
  } catch (error) {
    return next(error);
  }
});

authEmailRouter.post("/invitations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, inviterWalletAddress, inviteUrlBase } = invitationRequestSchema.parse(req.body);
    const token = signEmailFlowToken(email, "invitation");
    const base = inviteUrlBase ?? process.env.INVITATION_URL_BASE ?? "https://app.splitnaira.com/invite";
    const inviteUrl = `${base}?token=${encodeURIComponent(token)}`;

    await getEmailProvider().sendInvitationEmail({
      to: email,
      token,
      inviteUrl,
      inviterWalletAddress,
    });

    return res.status(202).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

authEmailRouter.post("/invitations/accept", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = invitationAcceptSchema.parse(req.body);
    const payload = verifyEmailFlowToken(token, "invitation");
    if (!payload) {
      return res.status(400).json({ error: "invalid_or_expired_token" });
    }

    return res.status(200).json({ success: true, email: payload.email });
  } catch (error) {
    return next(error);
  }
});
