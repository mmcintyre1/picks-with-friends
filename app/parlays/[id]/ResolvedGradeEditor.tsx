"use client";

import { useState } from "react";

import type { LegResult } from "@/app/generated/prisma/enums";
import { Button } from "@/components/ui/Button";

import { GradeForm } from "./GradeForm";

type Leg = { id: string; userName: string; summary: string };

export function ResolvedGradeEditor({
  parlayId,
  legs,
  initialResults,
}: {
  parlayId: string;
  legs: Leg[];
  initialResults: Record<string, LegResult>;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Something wrong? Fix the grades
      </Button>
    );
  }

  return (
    <GradeForm
      parlayId={parlayId}
      legs={legs}
      initialResults={initialResults}
      onCancel={() => setEditing(false)}
    />
  );
}
