"use client";

import { useState } from "react";

import type { LegResult } from "@/app/generated/prisma/enums";

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
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 underline">
        Something wrong? Fix the grades
      </button>
    );
  }

  return <GradeForm parlayId={parlayId} legs={legs} initialResults={initialResults} />;
}
