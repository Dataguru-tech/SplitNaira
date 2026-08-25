import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

// Helper to validate Stellar Addresses or Contract IDs
const StellarAddressSchema = z
  .string()
  .refine(
    (val) => StrKey.isValidEd25519PublicKey(val) || StrKey.isValidContract(val),
    { message: "Invalid Stellar address (G...) or contract ID (C...)" },
  );

export const CollaboratorSchema = z.object({
  id: z.string(),
  address: StellarAddressSchema,
  alias: z.string().min(1, "Alias is required"),
  basisPoints: z.string().refine((val) => {
    if (typeof val === "string" && (val.includes(".") || !/^\d+$/.test(val.trim()))) {
      return false;
    }
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 && num <= 10000;
  }, "Basis points must be between 1 and 10,000"),
});

export const CreateSplitSchema = z.object({
  projectId: z
    .string()
    .min(3, "ID must be at least 3 characters")
    .regex(/^[a-z0-9_]+$/, "Only lowercase, numbers, and underscores allowed"),
  title: z.string().min(1, "Title is required"),
  projectType: z.string().min(1, "Category is required"),
  token: StellarAddressSchema,
  collaborators: z
    .array(CollaboratorSchema)
    .min(2, "At least 2 recipients are required")
    .superRefine((collabs, ctx) => {
      // 1. Check total BP
      const total = collabs.reduce(
        (sum, c) => sum + (parseInt(c.basisPoints) || 0),
        0,
      );
      if (total !== 10000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Total basis points must equal 10,000 (current: ${total})`,
          path: ["total"],
        });
      }
      // 2. Check for duplicate addresses
      const addresses = collabs.map((c) => c.address.trim());
      const duplicates = addresses.filter(
        (item, index) => addresses.indexOf(item) !== index && item !== "",
      );
      if (duplicates.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate wallet addresses found",
          path: ["duplicates"],
        });
      }
    }),
});

export type CreateSplitInput = z.infer<typeof CreateSplitSchema>;
