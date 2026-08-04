# Candidate Search V2 Specification

## Objective

Provide recruiters with fast, explainable, and filterable candidate search across the full candidate database.

## Search modes

1. Keyword search
2. Structured filters
3. Semantic search
4. Hybrid ranking
5. JD-to-candidate matching

## Required filters

- Candidate name
- Current title
- Current employer
- Location
- Country
- Total years of experience
- Relevant years of experience
- Skills
- SAP modules
- Industry
- Languages
- Salary expectation
- Notice period
- Work authorization
- Candidate quality status
- Recruiter workflow status

## Ranking model

Final score should combine:

- Exact keyword match
- Skill match
- Semantic similarity
- Title relevance
- Industry relevance
- Location relevance
- Candidate profile quality
- Data confidence
- Recency

## Explainability

Every result should show:

- Overall relevance score
- Matched skills
- Missing requirements
- Supporting evidence
- Confidence level
- Ranking reasons

## Safety

- Read-only search
- No candidate updates
- No automatic shortlist
- No automatic workflow movement
- No email sends
- No AI-generated facts without evidence

## Phase 1 deliverables

- Search request schema
- Search result schema
- Hybrid scoring engine
- Search API V2
- Regression tests
- Read-only UI integration