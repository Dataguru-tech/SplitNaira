/* @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

function Harness({ collaborators }: { collaborators: CreateCollaboratorInput[] }) {
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
      isSubmitting={false}
      receipt={null}
      latestTxHash={null}
      createdProject={null}
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
});
