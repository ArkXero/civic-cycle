"""
Meeting summarization using Claude API.
Transforms raw meeting content into structured summaries.
"""

import json
import logging
from dataclasses import dataclass
from anthropic import Anthropic

from .config import anthropic_config
from .boarddocs_client import MeetingContent

logger = logging.getLogger(__name__)


@dataclass
class KeyDecision:
    """A key decision made during the meeting."""
    decision: str
    vote_yes: int | None = None
    vote_no: int | None = None
    vote_abstain: int | None = None
    passed: bool | None = None


@dataclass
class ActionItem:
    """An action item or follow-up from the meeting."""
    item: str
    responsible_party: str | None = None
    deadline: str | None = None


@dataclass
class MeetingSummary:
    """Complete summary of a meeting."""
    summary_text: str
    key_decisions: list[KeyDecision]
    action_items: list[ActionItem]
    topics: list[str]


SUMMARIZATION_PROMPT = """You are summarizing an FCPS (Fairfax County Public Schools) School Board meeting for busy parents and residents who don't have time to watch the full meeting.

Your audience:
- Parents with kids in FCPS schools
- Fairfax County residents and taxpayers
- People who care about education policy but are time-constrained

Meeting Title: {title}
Meeting Date: {date}

Content from agenda and supporting documents:
{content}

---

Please provide a summary in the following JSON format:

{{
  "summary_text": "2-3 paragraphs summarizing the meeting in plain English. Focus on what matters to parents: school schedules, budgets, safety, policies, boundary changes, etc. Avoid jargon. Be specific about decisions made.",

  "key_decisions": [
    {{
      "decision": "Clear description of what was decided",
      "vote_yes": 10,
      "vote_no": 2,
      "vote_abstain": 0,
      "passed": true
    }}
  ],

  "action_items": [
    {{
      "item": "Description of follow-up action",
      "responsible_party": "Who is responsible (if mentioned)",
      "deadline": "When it's due (if mentioned)"
    }}
  ],

  "topics": ["budget", "school-safety", "bell-schedules", "boundary-changes"]
}}

Guidelines:
- Use 3-7 topic tags that would help parents find this meeting later
- Topic tags should be lowercase, hyphenated (e.g., "bell-schedules" not "Bell Schedules")
- If vote counts aren't available, set those fields to null
- If no formal votes occurred, key_decisions can be empty
- Focus on decisions and information that affect students and families
- Be neutral and factual, not editorializing

Respond with ONLY the JSON object, no additional text."""


class Summarizer:
    """Summarizes meeting content using Claude API."""

    def __init__(self):
        self.client = Anthropic(api_key=anthropic_config.api_key)
        self.model = anthropic_config.model
        self.max_tokens = anthropic_config.max_tokens
        logger.info(f"Initialized summarizer with model: {self.model}")

    def summarize(self, content: MeetingContent) -> MeetingSummary:
        """
        Generate a summary for meeting content.

        Args:
            content: Processed meeting content from BoardDocs

        Returns:
            Structured meeting summary
        """
        meeting = content.meeting
        logger.info(f"Summarizing meeting: {meeting.title or meeting.unid}")

        # Truncate content if too long (Claude has context limits)
        max_content_chars = 100000  # ~25k tokens
        truncated_content = content.combined_text[:max_content_chars]

        if len(content.combined_text) > max_content_chars:
            logger.warning(
                f"Content truncated from {len(content.combined_text)} to {max_content_chars} chars"
            )

        prompt = SUMMARIZATION_PROMPT.format(
            title=meeting.title or "FCPS School Board Meeting",
            date=meeting.date,
            content=truncated_content
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = response.content[0].text
            logger.debug(f"Raw response: {response_text[:500]}...")

            # Parse JSON response
            data = json.loads(response_text)

            # Convert to dataclasses
            key_decisions = [
                KeyDecision(
                    decision=d["decision"],
                    vote_yes=d.get("vote_yes"),
                    vote_no=d.get("vote_no"),
                    vote_abstain=d.get("vote_abstain"),
                    passed=d.get("passed")
                )
                for d in data.get("key_decisions", [])
            ]

            action_items = [
                ActionItem(
                    item=a["item"],
                    responsible_party=a.get("responsible_party"),
                    deadline=a.get("deadline")
                )
                for a in data.get("action_items", [])
            ]

            summary = MeetingSummary(
                summary_text=data["summary_text"],
                key_decisions=key_decisions,
                action_items=action_items,
                topics=data.get("topics", [])
            )

            logger.info(
                f"Summary generated: {len(summary.summary_text)} chars, "
                f"{len(summary.key_decisions)} decisions, "
                f"{len(summary.topics)} topics"
            )

            return summary

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            logger.error(f"Response was: {response_text[:1000]}")
            raise
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            raise


# Singleton instance
_summarizer: Summarizer | None = None


def get_summarizer() -> Summarizer:
    """Get or create the summarizer singleton."""
    global _summarizer
    if _summarizer is None:
        _summarizer = Summarizer()
    return _summarizer
