import assert from 'node:assert/strict';
import { parseCv } from '../lib/cv-parser';
import { normalizeCandidatePayloadForSapUpload } from '../lib/candidateFileGuards';
import { sanitizeCandidateForPersistence, sanitizeCandidateSourceText } from '../lib/candidateSourcePreservation';
async function main() {
 const source = 'Full Name: Synthetic Example\r\nEmail: synthetic@example.com\r\nSAP FICO Consultant\r\nEmployment History\r\nCompany\tPosition\tDuration\r\nExample Systems\tSAP Consultant\t2020 – 2024\r\n\r\n• Project: Example\fEducation\nDegree\u0000';
 const expected = sanitizeCandidateSourceText(source);
 const parsed = await parseCv(Buffer.from(source),'synthetic.txt');
 assert.equal(parsed.rawText,expected,'TXT parser must preserve layout in returned source');
 const normalized = normalizeCandidatePayloadForSapUpload({...parsed,raw_text:parsed.rawText,resume_text:parsed.rawText},parsed.rawText);
 const saved = sanitizeCandidateForPersistence({...normalized,name:'  Synthetic\n Example  ',raw_text:normalized.raw_text,resume_text:parsed.rawText});
 assert.equal(saved.raw_text,expected);
 assert.equal(saved.resume_text,expected);
 assert.equal(saved.name,'Synthetic Example');
 assert.ok(saved.raw_text.includes('Company\tPosition\tDuration'));
 assert.ok(saved.raw_text.includes('\n\n• Project:'));
 assert.equal(sanitizeCandidateForPersistence(saved).raw_text,expected,'Payload sanitization must not flatten source on a second pass');
 assert.deepEqual(sanitizeCandidateForPersistence({nested:{raw_cv:source},skills:[' SAP\n FI '],score:5}),{nested:{raw_cv:expected},skills:['SAP FI'],score:5});
 console.log('Upload parser, payload normalization and persistence source preservation: passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
