import {
  clarificationQuestionsFor,
  experienceRangeInText,
  languagesInText,
  professionalRolesInText,
  type SearchClarificationQuestion,
} from "./searchV2RequirementOntology";
import {
  conceptsInText,
  lifecycleTermsInText,
} from "./candidateSearchConcepts";
import { requiredLocationAlternatives } from "./searchV2RequiredLocation";
import type { CandidateSearchV2Filters } from "./candidateSearchV2Types";
import { canonicalSearchV2QueryKey } from "./searchV2QueryNormalization";

export const SEARCH_PREPARATION_VERSION = "search-v2-preparation-v1";
export type ClarificationAnswer = Readonly<{
  questionId: string;
  values: readonly string[];
  skipped: boolean;
  other: string;
}>;
export type PreparationStatus =
  | "idle"
  | "preparing"
  | "questions"
  | "review"
  | "cancelled"
  | "timed_out"
  | "manual";
export type SearchPreparationState = Readonly<{
  version: typeof SEARCH_PREPARATION_VERSION;
  identity: string;
  query: string;
  status: PreparationStatus;
  questions: readonly SearchClarificationQuestion[];
  currentIndex: number;
  answers: Readonly<Record<string, ClarificationAnswer>>;
  error: string | null;
}>;

const normalize = (value: unknown) => canonicalSearchV2QueryKey(value);
const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};
export const preparationIdentity = (query: string) =>
  `${SEARCH_PREPARATION_VERSION}:${hash(normalize(query))}`;

const normalizedSet = (values: readonly string[]) =>
  new Set(values.map((value) => normalize(value)));
const setsOverlap = (left: readonly string[], right: readonly string[]) => {
  const rightSet = normalizedSet(right);
  return left.some((value) => rightSet.has(normalize(value)));
};

export function questionsForSearch(
  query: string,
  filters: CandidateSearchV2Filters = {},
) {
  const queryLocations = requiredLocationAlternatives(query).map(
    (item) => item.label,
  );
  const filterLocations = [
    ...(filters.countries || []),
    ...(filters.locations || []),
  ];
  const queryLanguages = languagesInText(query).map((item) => item.label);
  const filterLanguages = filters.languages || [];
  const queryExperience = experienceRangeInText(query);
  const base = clarificationQuestionsFor({
    wording: query,
    hasLocation: queryLocations.length > 0 || filterLocations.length > 0,
    hasExperience:
      Boolean(queryExperience) ||
      filters.minimumTotalYearsExperience !== undefined ||
      filters.maximumTotalYearsExperience !== undefined,
    hasLanguage: queryLanguages.length > 0 || filterLanguages.length > 0,
    hasDelivery: lifecycleTermsInText(query).length > 0,
  });
  const questions = [...base];
  if (
    queryLocations.length &&
    filterLocations.length &&
    !setsOverlap(queryLocations, filterLocations)
  )
    questions.unshift({
      id: "conflict_location",
      label:
        "The description and Filters specify different locations. Which location rule should be committed?",
      type: "single",
      options: [
        "Use description/JD locations",
        "Use Filter locations",
        "Combine as OR alternatives",
        "No preference",
      ],
      affects: "location",
    });
  if (
    queryLanguages.length &&
    filterLanguages.length &&
    !setsOverlap(queryLanguages, filterLanguages)
  )
    questions.unshift({
      id: "conflict_language",
      label:
        "The description and Filters specify different required languages. Which rule should be committed?",
      type: "single",
      options: [
        "Require description/JD languages",
        "Require Filter languages",
        "Require all listed languages",
        "No preference",
      ],
      affects: "language",
    });
  const hasRole = professionalRolesInText(query).length > 0;
  if (hasRole)
    questions.push({
      id: "title_scope",
      label:
        "Must the role match the current title, or may relevant historical experience qualify?",
      type: "single",
      options: [
        "Current job title",
        "Current or historical title",
        "No preference",
      ],
      affects: "title_scope",
    });
  const sapTokens = normalize(query).match(/\bsap\s+([a-z0-9/+-]+)\b/g) || [];
  const known = new Set(conceptsInText(query));
  const unknown = sapTokens
    .map((item) => item.replace(/^sap\s+/, ""))
    .filter(
      (item) => !conceptsInText(`SAP ${item}`).some((id) => known.has(id)),
    );
  for (const token of unknown)
    questions.unshift({
      id: `ambiguous:${token}`,
      label: `What does “SAP ${token}” mean for this search?`,
      type: "free_text",
      options: [],
      affects: "delivery",
    });
  return questions;
}

export function initialPreparation(query = ""): SearchPreparationState {
  return {
    version: SEARCH_PREPARATION_VERSION,
    identity: preparationIdentity(query),
    query,
    status: "idle",
    questions: [],
    currentIndex: 0,
    answers: {},
    error: null,
  };
}

export type SearchPreparationAction =
  | { type: "reset"; query: string }
  | { type: "restore"; state: SearchPreparationState }
  | { type: "prepare"; query: string }
  | {
      type: "prepared";
      identity: string;
      questions: readonly SearchClarificationQuestion[];
    }
  | {
      type: "answer";
      identity: string;
      questionId: string;
      values: string[];
      other?: string;
    }
  | { type: "skip"; identity: string; questionId: string }
  | { type: "back"; identity: string }
  | { type: "continue"; identity: string }
  | { type: "revise"; identity: string; questionId: string }
  | { type: "timeout"; identity: string }
  | { type: "retry"; identity: string }
  | { type: "cancel"; identity: string }
  | { type: "manual"; identity: string };

export function searchPreparationReducer(
  state: SearchPreparationState,
  action: SearchPreparationAction,
): SearchPreparationState {
  if (action.type === "restore")
    return action.state.version === SEARCH_PREPARATION_VERSION &&
      action.state.identity === preparationIdentity(action.state.query)
      ? action.state
      : state;
  if (action.type === "reset") return initialPreparation(action.query);
  if (action.type === "prepare") {
    const identity = preparationIdentity(action.query);
    return {
      ...initialPreparation(action.query),
      identity,
      status: "preparing",
    };
  }
  if (action.identity !== state.identity) return state;
  if (action.type === "prepared")
    return {
      ...state,
      status: action.questions.length ? "questions" : "review",
      questions: action.questions,
      currentIndex: 0,
      error: null,
    };
  if (action.type === "answer" || action.type === "skip") {
    const questionId = action.questionId;
    const answer: ClarificationAnswer =
      action.type === "skip"
        ? { questionId, values: [], skipped: true, other: "" }
        : {
            questionId,
            values: [
              ...new Set(
                action.values.map((item) => item.trim()).filter(Boolean),
              ),
            ],
            skipped: false,
            other: action.other?.trim() || "",
          };
    const answers = { ...state.answers, [questionId]: answer };
    const next = Math.min(state.currentIndex + 1, state.questions.length);
    return {
      ...state,
      answers,
      currentIndex: next,
      status: next >= state.questions.length ? "review" : "questions",
    };
  }
  if (action.type === "back")
    return {
      ...state,
      status: "questions",
      currentIndex: Math.max(0, state.currentIndex - 1),
    };
  if (action.type === "continue")
    return { ...state, status: "review", currentIndex: state.questions.length };
  if (action.type === "revise") {
    const index = state.questions.findIndex(
      (item) => item.id === action.questionId,
    );
    return index < 0
      ? state
      : { ...state, status: "questions", currentIndex: index };
  }
  if (action.type === "timeout")
    return {
      ...state,
      status: "timed_out",
      error: "Preparation timed out. Continue manually or retry.",
    };
  if (action.type === "retry")
    return { ...state, status: "preparing", error: null };
  if (action.type === "cancel")
    return { ...state, status: "cancelled", error: null };
  return { ...state, status: "manual", error: null };
}

export function confirmedClarificationValues(state: SearchPreparationState) {
  return Object.fromEntries(
    Object.values(state.answers)
      .filter((answer) => !answer.skipped)
      .map((answer) => [
        answer.questionId,
        [...answer.values, ...(answer.other ? [answer.other] : [])],
      ]),
  );
}
