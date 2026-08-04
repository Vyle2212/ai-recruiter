export const CANDIDATE_PIPELINE_STAGES = [
  "sourced",
  "screening",
  "submitted",
  "interview",
  "offer",
  "hired",
  "rejected",
  "on_hold",
] as const;

export type CandidatePipelineStage =
  (typeof CANDIDATE_PIPELINE_STAGES)[number];

export type CandidateLifecyclePriority =
  | "high"
  | "medium"
  | "low";

export type CandidateLifecycleSource =
  | "inferred"
  | "recruiter_updated"
  | "system_event"
  | "migration";

export type CandidateLifecycleAction =
  | "review_profile"
  | "contact_candidate"
  | "complete_screening"
  | "prepare_submission"
  | "submit_to_client"
  | "follow_up_client"
  | "schedule_interview"
  | "collect_interview_feedback"
  | "prepare_offer"
  | "follow_up_offer"
  | "complete_placement"
  | "review_rejection"
  | "review_on_hold"
  | "no_action";

export type CandidateLifecycleEvent = {
  eventId: string;
  candidateId: string;
  fromStage: CandidatePipelineStage | null;
  toStage: CandidatePipelineStage;
  action: CandidateLifecycleAction;
  note: string;
  source: CandidateLifecycleSource;
  actorId: string | null;
  actorName: string | null;
  occurredAt: string;
};

export type CandidateLifecycleRecord = {
  lifecycleId: string;
  candidateId: string;
  candidateName: string;

  ownerId: string | null;
  ownerName: string | null;

  stage: CandidatePipelineStage;
  previousStage: CandidatePipelineStage | null;

  nextAction: CandidateLifecycleAction;
  nextActionNote: string;
  nextActionDueAt: string | null;

  priority: CandidateLifecyclePriority;
  source: CandidateLifecycleSource;

  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;

  history: CandidateLifecycleEvent[];
};

export const PIPELINE_STAGE_LABELS: Record<
  CandidatePipelineStage,
  string
> = {
  sourced: "Sourced",
  screening: "Screening",
  submitted: "Submitted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  on_hold: "On Hold",
};

export const PIPELINE_STAGE_ORDER: Record<
  CandidatePipelineStage,
  number
> = {
  sourced: 10,
  screening: 20,
  submitted: 30,
  interview: 40,
  offer: 50,
  hired: 60,
  rejected: 70,
  on_hold: 80,
};