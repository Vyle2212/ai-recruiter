import {
  mutateState,
  readState,
  stateKey,
  type StateRepository,
  type StateScope,
} from "./recruiterDurableState";
import {
  applyRecruiterCopilotExchange,
  emptyRecruiterCopilotConversationFile,
  type AppendRecruiterCopilotExchangeInput,
} from "./recruiterCopilotConversationStore";
import {
  applyWorkflowAutomationDecision,
  buildWorkflowAutomationDecisionFile,
  emptyWorkflowAutomationDecisionFile,
  type SaveWorkflowAutomationDecisionInput,
} from "./recruiterWorkflowAutomationDecisions";
import {
  applyWorkflowAutomationRuleConfig,
  buildWorkflowAutomationRuleConfigFile,
  defaultWorkflowAutomationRuleConfigs,
  type SaveWorkflowAutomationRuleConfigInput,
} from "./recruiterWorkflowAutomationRuleConfig";

export function recruiterRuntimeStore(
  repository: StateRepository,
  scope: StateScope,
) {
  const historyKey = stateKey(scope, "copilot_history");
  const decisionsKey = stateKey(scope, "automation_decisions");
  const rulesKey = stateKey(scope, "automation_rules");
  const emptyRules = () =>
    buildWorkflowAutomationRuleConfigFile(
      defaultWorkflowAutomationRuleConfigs(),
    );
  return {
    readRecruiterCopilotConversations: () =>
      readState(repository, historyKey, emptyRecruiterCopilotConversationFile),
    appendRecruiterCopilotExchange: (
      input: AppendRecruiterCopilotExchangeInput,
    ) =>
      mutateState(
        repository,
        historyKey,
        emptyRecruiterCopilotConversationFile,
        (current) => {
          const result = applyRecruiterCopilotExchange(input, current);
          result.file.mode =
            "Private recruiter Copilot history; no candidate changes or workflow execution";
          return result;
        },
      ),
    deleteRecruiterCopilotConversation: (conversationId: string) =>
      mutateState(
        repository,
        historyKey,
        emptyRecruiterCopilotConversationFile,
        (current) => {
          const conversations = current.conversations.filter(
            (item) => item.conversationId !== conversationId,
          );
          return {
            deleted: conversations.length < current.conversations.length,
            conversationId,
            file: {
              ...current,
              conversations,
              generatedAt: new Date().toISOString(),
            },
          };
        },
      ),
    clearRecruiterCopilotConversations: async () =>
      (
        await mutateState(
          repository,
          historyKey,
          emptyRecruiterCopilotConversationFile,
          () => ({ file: emptyRecruiterCopilotConversationFile() }),
        )
      ).file,
    readWorkflowAutomationDecisions: () =>
      readState(repository, decisionsKey, emptyWorkflowAutomationDecisionFile),
    saveWorkflowAutomationDecision: (
      input: SaveWorkflowAutomationDecisionInput,
    ) =>
      mutateState(
        repository,
        decisionsKey,
        emptyWorkflowAutomationDecisionFile,
        (current) =>
          applyWorkflowAutomationDecision(
            { ...input, reviewerId: scope.profileId },
            current,
          ),
      ),
    deleteWorkflowAutomationDecision: (proposalId: string) =>
      mutateState(
        repository,
        decisionsKey,
        emptyWorkflowAutomationDecisionFile,
        (current) => {
          const decisions = current.decisions.filter(
            (item) => item.proposalId !== proposalId,
          );
          return {
            deleted: decisions.length < current.decisions.length,
            proposalId,
            file: buildWorkflowAutomationDecisionFile(decisions),
          };
        },
      ),
    readWorkflowAutomationRuleConfigs: () =>
      readState(repository, rulesKey, emptyRules),
    saveWorkflowAutomationRuleConfig: (
      input: SaveWorkflowAutomationRuleConfigInput,
    ) =>
      mutateState(repository, rulesKey, emptyRules, (current) =>
        applyWorkflowAutomationRuleConfig(
          { ...input, updatedBy: scope.profileId },
          current,
        ),
      ),
    resetWorkflowAutomationRuleConfigs: async (_options?: {
      updatedBy?: string | null;
    }) =>
      (
        await mutateState(repository, rulesKey, emptyRules, () => ({
          file: buildWorkflowAutomationRuleConfigFile(
            defaultWorkflowAutomationRuleConfigs().map((rule) => ({
              ...rule,
              updatedBy: scope.profileId,
            })),
          ),
        }))
      ).file,
  };
}
