import { createLazyOpenAiClient } from "./runtimeClients";

export const openai = createLazyOpenAiClient();
