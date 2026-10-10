import assert from "node:assert/strict";
import { cvParserAccuracyGate, type CvAccuracyReview } from "../lib/cvParserAccuracyGate";
const population = Array.from({length:892}, (_,i)=>`synthetic-source-${i}`);
const reviews: CvAccuracyReview[] = population.map(sourceId=>({
  sourceId, revision:"test-v1", sourceCompared:true, independentlyReviewed:true,
  expectedFacts:100, wrongFacts:0, missingFacts:0, inventedFacts:0, unresolvedFacts:0,
}));
const gate=(rows: CvAccuracyReview[], sources=population)=>cvParserAccuracyGate("test-v1",sources,rows);
assert.equal(gate(reviews).parserAccuracyEvidencePassed,true);
assert.equal(gate(reviews).launchApproved,false);
assert.equal(gate([]).parserAccuracyEvidencePassed,false);
assert.equal(gate(reviews.slice(0,10),population.slice(0,10)).parserAccuracyEvidencePassed,false);
assert.equal(gate([...reviews,reviews[0]]).parserAccuracyEvidencePassed,false);
assert.equal(gate(reviews.map(r=>({...r, independentlyReviewed:false}))).parserAccuracyEvidencePassed,false);
assert.equal(gate(reviews.map(r=>({...r, revision:"old"}))).parserAccuracyEvidencePassed,false);
assert.equal(gate(reviews.map((r,i)=>({...r,wrongFacts:i<9?1:0}))).parserAccuracyEvidencePassed,false,
  "Nine erroneous profiles out of 892 exceed 1% even with very few field errors");
assert.equal(gate(reviews.map(r=>({...r,missingFacts:1}))).parserAccuracyEvidencePassed,false,
  "Exactly 1% is not below 1%; omissions count as errors");
assert.equal(gate(reviews.map((r,i)=>({...r,inventedFacts:i===0?1000:0}))).parserAccuracyEvidencePassed,false,
  "Invented facts cannot dilute the expected-source denominator");
assert.equal(gate(reviews.map((r,i)=>({...r,unresolvedFacts:i===0?1:0}))).parserAccuracyEvidencePassed,false);
assert.equal(gate(reviews.map((r,i)=>({...r,wrongFacts:i===0?-1:0}))).parserAccuracyEvidencePassed,false);
console.log("Source-adjudicated parser accuracy gate regressions passed");
