import { ArticleBrief, ArticleDraft, EditorialReview, PipelineRequestSnapshot, QualityGate, ResearchBundle, WritingMode } from '../types/pipeline';

export interface PromptContext {
    targetAudience: string;
    articleStyle: string;
    theme: string;
    writingMode: WritingMode;
}

const contextBlock = (context: PromptContext): string => `
Target audience: ${context.targetAudience}
Article style: ${context.articleStyle}
Theme: ${context.theme}
Writing mode: ${context.writingMode}`;

export function buildBriefPrompt(researchBundle: ResearchBundle, context: PromptContext): string {
    if (context.writingMode === 'publish-ready') {
        return `
You are an experienced human author who writes viral essays on Medium. You have just spent a week immersed in research on a topic and you are now planning your article.

You are NOT a summariser. You are NOT a reporter. You are a thinker with a point of view who uses research as raw material to support an original argument.

${contextBlock(context)}

RESEARCH (your private notes - never cite the source platform in the article):
${JSON.stringify(researchBundle, null, 2)}

VOICE & AUTHORSHIP RULES (non-negotiable):
- You are the author. Write in first person with a clear, confident voice.
- First person means "I think / I believe / I have come to see" reasoning. Do NOT invent personal life events, credentials, jobs, trauma, anecdotes, or experiences unless they are explicitly supplied in the research.
- You have a THESIS you DEFEND - not a "both sides have merit" conclusion. Pick a lane.
- NEVER mention Reddit, subreddits, usernames, upvote counts, or any platform metadata anywhere in the article brief or article. Reddit is your research source, not your story.
- Human voices from the research become ANONYMOUS UNIVERSAL VOICES: "one person put it perfectly:", "someone who has lived this wrote:", "a question that keeps coming up:"
- The hooks must read like the first line of a book - specific, visceral, present tense. Not "In this article I will explore..."
- The thesis must be a CLAIM the reader could disagree with. Not a topic. A STANCE.
- Counterarguments exist to be steelmanned and then defeated - not to create false balance.
- Keep sourceNotes as hidden internal notes for the author. They must preserve provenance and evidence checks, but must never appear in the reader-facing article.

Create a rigorous article brief. Return strict JSON:
{
  "title": "working title - specific, not generic",
  "headlineOptions": ["curiosity gap headline", "bold claim headline", "how-to or transformation headline"],
  "hookOptions": ["hook 1 - reads like the first sentence of a published book", "hook 2 - different emotional register"],
  "thesis": "one clear, arguable claim the entire article defends",
  "targetAudience": "specific description of who this is for and why they will care",
  "promise": "what the reader will think, feel, or be able to do after reading",
  "outline": [
    {"heading": "section heading", "purpose": "the job this section does in the narrative arc", "evidence": ["specific insight or story moment from research to deploy here"]}
  ],
  "counterarguments": ["the strongest objection to the thesis - steelmanned"],
  "practicalTakeaways": ["specific, actionable - not generic advice"],
  "authorStance": "one sentence: what the author personally believes and why",
  "sourceNotes": ["hidden provenance/evidence notes for the author; okay to mention source metadata here, never in finalMarkdown"],
  "risks": ["framing or claim the author must avoid to maintain credibility"]
}`;
    }

    return `
You are an expert Medium editor. Create a rigorous article brief from this Reddit research bundle.

Rules:
- Use only the provided research.
- Do not invent statistics, quotes, or source claims.
- Keep source quotes attributed and source-aware.
- Optimize for a strong, original Medium story, not a generic summary.
- Preserve enough source context for a human writer to understand the material and form their own opinion.

${contextBlock(context)}

Research bundle:
${JSON.stringify(researchBundle, null, 2)}

Return strict JSON:
{
  "title": "working title",
  "headlineOptions": ["headline 1", "headline 2", "headline 3"],
  "hookOptions": ["hook 1", "hook 2"],
  "thesis": "clear thesis",
  "targetAudience": "specific audience",
  "promise": "what reader gets",
  "outline": [
    {"heading": "section heading", "purpose": "why this section exists", "evidence": ["source-backed evidence"]}
  ],
  "counterarguments": ["balanced counterpoint"],
  "practicalTakeaways": ["takeaway"],
  "authorStance": "source-aware editorial stance for the writer to consider",
  "sourceNotes": ["source note with Reddit link context"],
  "risks": ["claim or framing risk to avoid"]
}`;
}

export function buildDraftPrompt(brief: ArticleBrief, researchBundle: ResearchBundle, context: PromptContext): string {
    if (context.writingMode === 'publish-ready') {
        return `
You are writing a Medium article as a first-person human author. This is NOT a summary, NOT a report, and NOT a Reddit thread analysis.

You have spent time thinking deeply about this topic. You have a point of view. You are writing for people who are intelligent, curious, and pressed for time - they will stop reading the moment they sense they are reading a content machine's output.

${contextBlock(context)}

YOUR BRIEF:
${JSON.stringify(brief, null, 2)}

YOUR RESEARCH (private notes - the source platform is NEVER named in the article):
${JSON.stringify(researchBundle, null, 2)}

ABSOLUTE RULES:
1. NEVER mention Reddit, r/anything, u/username, upvotes, downvotes, threads, or any platform in the article body. Zero exceptions.
2. Human voices from research become anonymous: "one person described it this way:", "a question worth sitting with:", "someone who has lived this for a decade wrote:". Never a username.
3. Write in first person as a thinker with a stance. Do NOT invent personal life events, credentials, workplace experiences, trauma, or anecdotes. If using "I", use it for reasoning and conviction, not fabricated biography.
4. The opening sentence must work as the first line of a published book - specific, present tense, emotionally immediate. Never start with "In today's world", "Have you ever", or "This article".
5. The thesis must appear within the first 200 words and must be a CLAIM, not a topic.
6. Every section must advance the argument - no section exists just to add length.
7. The conclusion must land with emotional weight - a transformation, a reframe, or a call to action that earns the reader's time.
8. Do NOT fabricate statistics, quotes, lived experience, credentials, or external studies. Use only what is in the research bundle.
9. Format for Medium: use ## for section headings, > blockquotes for powerful anonymous human voices, **bold** for key insights. No footnote-style sources section.

Write the complete article in Markdown. Return strict JSON:
{
  "title": "final title - the one that gets clicked",
  "markdown": "# Title\\n\\nFull article in Markdown - complete, not truncated",
  "sourceLinks": ["hidden internal source/provenance links from the research bundle; not rendered in the article body"],
  "estimatedReadTime": 8
}`;
    }

    return `
Write a polished Medium-style Markdown draft from this brief and Reddit research.

Rules:
- Output strict JSON only.
- The markdown must be the complete article.
- Do not fabricate quotes, studies, metrics, or external facts.
- Use source-backed claims and include a "Sources" section with Reddit links.
- Include a strong hook, clear thesis, useful sections, counterpoints, and practical takeaways.
- No Medium publishing, only Markdown.

${contextBlock(context)}

Brief:
${JSON.stringify(brief, null, 2)}

Research:
${JSON.stringify(researchBundle, null, 2)}

Return strict JSON:
{
  "title": "final title",
  "markdown": "# Title\\n\\nFull article in Markdown...",
  "sourceLinks": ["https://reddit.com/..."],
  "estimatedReadTime": 8
}`;
}

export function buildEditPrompt(draft: ArticleDraft, brief: ArticleBrief, researchBundle: ResearchBundle, context: PromptContext): string {
    if (context.writingMode === 'publish-ready') {
        return `
You are a senior Medium editor known for turning good drafts into articles that get boosted. You are demanding, precise, and you have zero tolerance for content that reads like it was generated by a machine.

Your mandate: make this article feel like it was written by a specific, intelligent human being with a point of view - not assembled from research.

${contextBlock(context)}

BRIEF:
${JSON.stringify(brief, null, 2)}

RESEARCH (for fact-checking only):
${JSON.stringify(researchBundle, null, 2)}

CURRENT DRAFT:
${draft.markdown}

YOUR EDITORIAL CHECKLIST - fix every item that fails:

VOICE:
- Does the opening sentence work as the first line of a published book? If not, rewrite it.
- Is there a clear first-person authorial voice throughout? Or does it drift into neutral summarising?
- Does the author have a THESIS they DEFEND - not just a topic they explore?
- Does the conclusion earn its place? Does it land with emotional or intellectual weight?

PLATFORM HYGIENE (CRITICAL):
- Does the word "Reddit" appear anywhere in the article body? DELETE IT. Every instance.
- Do any usernames (u/anything) appear? DELETE THEM.
- Do any subreddit references (r/anything) appear? DELETE THEM.
- Do upvote counts, comment counts, or thread references appear? DELETE THEM.
- Are human voices properly anonymised? ("one person wrote:", "a reader of this question said:") - never a username.

STRUCTURE:
- Does every section advance the argument? Cut any section that is just filler.
- Are transitions between sections smooth - does each section earn the next?
- Is the thesis stated clearly within the first 200 words?
- Do counterarguments appear and get genuinely defeated - not just acknowledged?

MEDIUM FORMAT:
- ## headings for sections, not # except the article title.
- > blockquotes for anonymous human voices.
- **bold** for key insights.
- No footnote sources section visible to readers.
- Reading time accurate?

CREDIBILITY:
- Are all statistics, quotes, and claims sourced from the research bundle? Remove anything not verifiable from the provided research.
- Does the author claim personal experiences, credentials, jobs, or anecdotes not present in the research? Remove or reframe as reasoning.
- Are there any claims that could embarrass the author if fact-checked? Flag them.

Score the draft 0-100 AFTER your improvements, not before.

Return strict JSON:
{
  "score": 0-100,
  "strengths": ["what worked"],
  "improvements": ["specific change made and why"],
  "factCheckNotes": ["claim that needs author verification before publishing"],
  "finalMarkdown": "# Improved Title\\n\\nComplete improved article in Markdown"
}`;
    }

    return `
Act as a demanding Medium editor. Improve this Markdown article while preserving source integrity.

Rules:
- Return strict JSON only.
- Make the article clearer, more original, more credible, and more readable.
- Do not add unsupported claims, fake statistics, or fake quotes.
- Preserve or improve the Markdown structure.
- Keep Reddit source links in the article.

${contextBlock(context)}

Brief:
${JSON.stringify(brief, null, 2)}

Research:
${JSON.stringify(researchBundle, null, 2)}

Draft:
${draft.markdown}

Return strict JSON:
{
  "score": 0-100,
  "strengths": ["strength"],
  "improvements": ["improvement made"],
  "factCheckNotes": ["source or claim note"],
  "finalMarkdown": "# Improved Title\\n\\nImproved article..."
}`;
}

export function buildQualityScorePrompt(draft: ArticleDraft, review: EditorialReview, brief: ArticleBrief, context: PromptContext): string {
    const publishReadyRules = context.writingMode === 'publish-ready'
        ? `
Also check publish-ready hygiene:
- finalMarkdown must not mention Reddit, subreddits, usernames, vote counts, thread metadata, or a visible sources section.
- Evidence should still be grounded in hidden research and source notes.
- First person may express reasoning, but must not invent personal experiences, credentials, jobs, or anecdotes.`
        : `
Also check research-report integrity:
- Source context should be clear enough for a human writer to audit.
- Reddit/source references are allowed when they improve understanding.
- Claims must remain grounded and not overstate what the research proves.`;

    return `
Evaluate this Medium-style article for boost-worthy quality.

${contextBlock(context)}

Score each dimension from 0-100:
- hookStrength: does sentence 1 create immediate curiosity?
- thesisClarity: is the core argument clear in the first 200 words?
- evidenceDensity: are claims backed by real source data, not generic advice?
- narrativeArc: does it build to a satisfying conclusion?
- mediumFormatCompliance: heading hierarchy, blockquotes for quotes, no Wikipedia-style writing
- originality: would this feel distinct from 10 other Medium articles on this topic?
${publishReadyRules}

Return strict JSON:
{
  "passed": boolean,
  "score": 0-100,
  "dimensionScores": {
    "hookStrength": 0-100,
    "thesisClarity": 0-100,
    "evidenceDensity": 0-100,
    "narrativeArc": 0-100,
    "mediumFormatCompliance": 0-100,
    "originality": 0-100
  },
  "blockers": ["reason this would prevent Medium success"],
  "suggestions": ["specific improvement"]
}

Brief:
${JSON.stringify(brief, null, 2)}

Draft:
${draft.markdown}

Edited article:
${review.finalMarkdown}`;
}

export function buildQualityImprovePrompt(run: { request: PipelineRequestSnapshot; articleBrief: ArticleBrief; editorialReview: EditorialReview }, qualityGate: QualityGate): string {
    const context = toPromptContext(run.request);
    const publishReadyRule = context.writingMode === 'publish-ready'
        ? '- Do not expose Reddit, usernames, subreddit names, vote counts, thread metadata, or a visible sources section in finalMarkdown.\n- Do not invent personal experiences, credentials, jobs, or anecdotes.'
        : '- Preserve useful source context and source links where they help the writer audit the article.';

    return `
Improve this Medium article so it clears the quality blockers below.

Rules:
- Return strict JSON matching the EditorialReview shape.
- Preserve real source links and do not invent claims, quotes, or statistics.
${publishReadyRule}
- Focus specifically on the blockers and suggestions.

${contextBlock(context)}

Quality blockers:
${JSON.stringify(qualityGate.blockers, null, 2)}

Suggestions:
${JSON.stringify(qualityGate.suggestions, null, 2)}

Brief:
${JSON.stringify(run.articleBrief, null, 2)}

Current article:
${run.editorialReview.finalMarkdown}

Return strict JSON:
{
  "score": 0-100,
  "strengths": ["strength"],
  "improvements": ["improvement made"],
  "factCheckNotes": ["source or claim note"],
  "finalMarkdown": "# Improved article..."
}`;
}

export function toPromptContext(request: Pick<PipelineRequestSnapshot, 'targetAudience' | 'articleStyle' | 'theme' | 'writingMode'>): PromptContext {
    return {
        targetAudience: request.targetAudience,
        articleStyle: request.articleStyle,
        theme: request.theme,
        writingMode: request.writingMode,
    };
}
