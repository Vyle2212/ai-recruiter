import type {
  CandidateLifecycleAction,
  CandidatePipelineStage,
} from "./candidateLifecycleTypes";

export type CandidateLifecycleTransitionRule = {
  from: CandidatePipelineStage;
  to: CandidatePipelineStage;
  action: CandidateLifecycleAction;
  requiresNote: boolean;
  requiresDueDate: boolean;
};

export const CANDIDATE_LIFECYCLE_TRANSITIONS:
  CandidateLifecycleTransitionRule[] = [
    {
      from: "sourced",
      to: "screening",
      action: "complete_screening",
      requiresNote: false,
      requiresDueDate: false,
    },
    {
      from: "screening",
      to: "submitted",
      action: "submit_to_client",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "submitted",
      to: "interview",
      action: "schedule_interview",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "interview",
      to: "offer",
      action: "prepare_offer",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "offer",
      to: "hired",
      action: "complete_placement",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "sourced",
      to: "rejected",
      action: "review_rejection",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "screening",
      to: "rejected",
      action: "review_rejection",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "submitted",
      to: "rejected",
      action: "review_rejection",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "interview",
      to: "rejected",
      action: "review_rejection",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "offer",
      to: "rejected",
      action: "review_rejection",
      requiresNote: true,
      requiresDueDate: false,
    },
    {
      from: "sourced",
      to: "on_hold",
      action: "review_on_hold",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "screening",
      to: "on_hold",
      action: "review_on_hold",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "submitted",
      to: "on_hold",
      action: "review_on_hold",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "interview",
      to: "on_hold",
      action: "review_on_hold",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "offer",
      to: "on_hold",
      action: "review_on_hold",
      requiresNote: true,
      requiresDueDate: true,
    },
    {
      from: "on_hold",
      to: "screening",
      action: "review_profile",
      requiresNote: true,
      requiresDueDate: false,
    },
  ];

export function findCandidateLifecycleTransition(
  from: CandidatePipelineStage,
  to: CandidatePipelineStage,
) {
  return CANDIDATE_LIFECYCLE_TRANSITIONS.find(
    (rule) =>
      rule.from === from &&
      rule.to === to,
  );
}

export function getAllowedLifecycleTransitions(
  from: CandidatePipelineStage,
) {
  return CANDIDATE_LIFECYCLE_TRANSITIONS.filter(
    (rule) => rule.from === from,
  );
}