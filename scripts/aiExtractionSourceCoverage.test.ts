import assert from 'node:assert/strict';
import { buildAiExtractionPrompt } from '../lib/aiCandidateExtractionEngine';
import { buildOpenAiCandidateExtractionPrompt, parseCompletedAiExtractionResponse, emptyRawAiExtraction, OpenAiExtractionError, buildAiExtractionCacheKey } from '../lib/openAiCandidateExtractionProvider';
const source = 'Full Name: Synthetic Example\n' + 'SAP project evidence. '.repeat(1400) + '\nEmployment History: FINAL_EMPLOYER_2010_2014\nEducation: FINAL_EDUCATION';
for (const prompt of [buildAiExtractionPrompt(source, {}), buildOpenAiCandidateExtractionPrompt(source, {})]) {
  assert.ok(prompt.includes(source), 'Complete original source must reach the model, including tail employment');
}
const complete = JSON.stringify(emptyRawAiExtraction());
assert.deepEqual(parseCompletedAiExtractionResponse({choices:[{finish_reason:'stop',message:{content:complete}}]}).experience.employmentHistory, []);
for (const response of [
  {choices:[{finish_reason:'length',message:{content:complete}}]},
  {choices:[{finish_reason:'content_filter',message:{content:complete}}]},
  {choices:[{finish_reason:'stop',message:{content:'{}'}}]},
  {choices:[{finish_reason:'stop',message:{content:'[]'}}]},
  {choices:[{finish_reason:'stop',message:{content:''}}]},
  {choices:[{finish_reason:'stop',message:{content:'{invalid json'}}]},
  {choices:[{finish_reason:'stop',message:{refusal:'Cannot process'}}]},
  {choices:[]},
]) assert.throws(() => parseCompletedAiExtractionResponse(response), OpenAiExtractionError);
assert.notEqual(buildAiExtractionCacheKey({id:'synthetic'},source,'model'), buildAiExtractionCacheKey({id:'synthetic'},source,'model','primus-ai-cv-extraction-v3.1'));
console.log('Full CV source coverage, incomplete response rejection and stale cache isolation: passed');
import { requestedProviderMode } from '../lib/aiCandidateExtractionProvider';
import { extractAiCandidateProfile } from '../lib/aiCandidateExtractionEngine';
import { createOpenAiCandidateExtractionProvider } from '../lib/openAiCandidateExtractionProvider';
async function checkMissingConfiguration() {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldCache = process.env.AI_EXTRACTION_CACHE_ENABLED;
  try {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_EXTRACTION_CACHE_ENABLED = 'false';
    assert.equal(requestedProviderMode({providerMode:'openai',noFallbackOnError:true}), 'openai');
    const result = await extractAiCandidateProfile({id:'missing-config-synthetic',raw_text:source}, createOpenAiCandidateExtractionProvider(), {noFallbackOnError:true});
    assert.equal(result.providerUsed, 'openai');
    assert.equal(result.openAiErrorType, 'missing_api_key');
    assert.equal(result.fallbackParserUsed, false);
    assert.equal(result.openAiRequestAttempted, false);
    assert.equal(result.openAiRequestSucceeded, false);
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldCache === undefined) delete process.env.AI_EXTRACTION_CACHE_ENABLED; else process.env.AI_EXTRACTION_CACHE_ENABLED = oldCache;
  }
}
checkMissingConfiguration().then(() => console.log('Requested AI mode cannot silently become fallback: passed')).catch(error => {console.error(error);process.exitCode=1;});
