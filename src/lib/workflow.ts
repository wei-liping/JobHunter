import { ApplicationStatus } from "@/generated/prisma/enums";

/** 高于此分视为 scored_high，否则 scored_low */
export const SCORE_HIGH_THRESHOLD = 70;

export function applicationStatusFromScore(score: number): ApplicationStatus {
  return score >= SCORE_HIGH_THRESHOLD
    ? ApplicationStatus.SCORED_HIGH
    : ApplicationStatus.SCORED_LOW;
}
