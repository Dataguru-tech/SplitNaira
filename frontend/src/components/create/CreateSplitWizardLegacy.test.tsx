/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useFieldArray, useForm } from "react-hook-form";

import { CreateSplitWizard } from "./CreateSplitWizardLegacy";
import { findDuplicateCollaboratorAddressIds } from "@/lib/address";
import type { WalletState } from "@/lib/wallet";

const wallet: WalletState = { connected: false, address: null, network: "testnet" };

interface CreateCollaboratorInput {
  address: string;
  alias: string;
  basisPoints: string;
}

interface CreateSplitFormValues {
  projectId: string;
  title: string;
  projectType: string;
  token: string;
  collaborators: CreateCollaboratorInput[];
}

function Harness({
  collaborators,
  createRetryError = null,
  isSubmitting = false,
  onRetryCreateSubmission = () => {},
}: {
  collaborators: CreateCollaboratorInput[];
  createRetryError?: string | null;
  isSubmitting?: boolean;
  onRetryCreateSubmission?: () => void;
}) {
  const { control, register, handleSubmit } = useForm<CreateSplitFormValues>({
    defaultValues: {
      projectId: "",
      title: "",
      projectType: "music",
      token: "",
      collaborators,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "collaborators" });

  const collaboratorValidationErrors: Record<string, string> = {};
  const duplicateIds = findDuplicateCollaboratorAddressIds(
    fields.map((field, index) => ({ id: field.id, address: collaborators[index]?.address ?? "" })),
  );
  duplicateIds.forEach((id) => {
    collaboratorValidationErrors[id] = "Duplicate address";
  });

  return (
    <CreateSplitWizard
      wallet={wallet}
      control={control}
      register={register}
      handleSubmit={handleSubmit}
      onSubmit={() => {}}
      createFormErrors={{}}
      collaboratorFields={fields}
      appendCollaborator={append}
      removeCollaborator={remove}
      collaboratorValidationErrors={collaboratorValidationErrors}
      totalBasisPoints={10_000}
      isValid={false}
      sorobanSplitFlowBusy={false}
      isSubmitting={isSubmitting}
      receipt={null}
      latestTxHash={null}
      createdProject={null}
      createRetryError={createRetryError}
      onRetryCreateSubmission={onRetryCreateSubmission}
      setActiveTab={() => {}}
      setSearchProjectId={() => {}}
      setFetchedProject={() => {}}
    />
  );
}

describe("CreateSplitWizard duplicate collaborator validation", () => {
  it("shows no duplicate errors when addresses are distinct", () => {
    render(
      <Harness
        collaborators={[
          { address: "GABC111", alias: "A", basisPoints: "5000" },
          { address: "GDEF222", alias: "B", basisPoints: "5000" },
        ]}
      />,
    );

    expect(screen.queryByText(/duplicate address/i)).not.toBeInTheDocument();
  });

  it("shows a field-level error on every entry sharing an exact duplicate address", () => {
    render(
      <Harness
        collaborators={[
          { address: "GABC111", alias: "A", basisPoints: "5000" },
          { address: "GABC111", alias: "B", basisPoints: "5000" },
        ]}
      />,
    );

    expect(screen.getAllByText(/duplicate address/i)).toHaveLength(2);
  });

  it("flags duplicates that differ only by casing", () => {
    render(
      <Harness
        collaborators={[
          { address: "gabc111", alias: "A", basisPoints: "5000" },
          { address: "GABC111", alias: "B", basisPoints: "5000" },
        ]}
      />,
    );

    expect(screen.getAllByText(/duplicate address/i)).toHaveLength(2);
  });

  it("flags duplicates that differ only by surrounding whitespace", () => {
    render(
      <Harness
        collaborators={[
          { address: "  GABC111", alias: "A", basisPoints: "5000" },
          { address: "GABC111  ", alias: "B", basisPoints: "5000" },
        ]}
      />,
    );

    expect(screen.getAllByText(/duplicate address/i)).toHaveLength(2);
  });

  it("shows user-visible retry state with a retry action and keeps entered form values", async () => {
    const user = userEvent.setup();
    const retrySpy = vi.fn();

    render(
      <Harness
        collaborators={[
          { address: "GABC111", alias: "Lead", basisPoints: "5000" },
          { address: "GDEF222", alias: "Producer", basisPoints: "5000" },
        ]}
        createRetryError="offline network unavailable"
        onRetryCreateSubmission={retrySpy}
      />,
    );

    expect(screen.getByText(/Submission interrupted/i)).toBeTruthy();
    expect(screen.getByText(/offline network unavailable/i)).toBeTruthy();
    expect(screen.getByDisplayValue("GABC111")).toBeTruthy();
    expect(screen.getByDisplayValue("Lead")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Retry Submission" }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it("disables only retry action while submission is in-flight", () => {
    render(
      <Harness
        collaborators={[
          { address: "GABC111", alias: "Lead", basisPoints: "5000" },
          { address: "GDEF222", alias: "Producer", basisPoints: "5000" },
        ]}
        createRetryError="temporary network issue"
        isSubmitting
      />,
    );

    expect(screen.getByRole("button", { name: "Retry Submission" })).toHaveProperty("disabled", true);
  });
});
