"""
Database operations for storing meetings and summaries in Supabase.
"""

import logging
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import Optional
from supabase import create_client, Client

from .config import supabase_config, boarddocs_config
from .boarddocs_client import Meeting, MeetingContent

logger = logging.getLogger(__name__)


class Database:
    """Handles all Supabase database operations."""

    def __init__(self):
        self.client: Client = create_client(
            supabase_config.url,
            supabase_config.service_key
        )
        logger.info("Connected to Supabase")

    def meeting_exists(self, external_id: str) -> bool:
        """Check if a meeting has already been processed."""
        result = self.client.table("meetings").select("id").eq(
            "external_id", external_id
        ).execute()
        return len(result.data) > 0

    def get_pending_meetings(self) -> list[dict]:
        """Get meetings that need summarization."""
        result = self.client.table("meetings").select("*").eq(
            "status", "pending"
        ).execute()
        return result.data

    def create_meeting(
        self,
        meeting: Meeting,
        content: MeetingContent,
        status: str = "pending"
    ) -> dict:
        """
        Create a new meeting record.

        Args:
            meeting: Meeting metadata
            content: Processed meeting content
            status: Initial status (pending, summarized, failed)

        Returns:
            Created meeting record
        """
        source_url = (
            f"https://go.boarddocs.com/{boarddocs_config.site}/"
            f"Board.nsf/goto?open&id={meeting.unid}"
        )

        data = {
            "external_id": meeting.unid,
            "title": meeting.title or f"FCPS School Board Meeting - {meeting.date}",
            "body": boarddocs_config.body_name,
            "meeting_date": meeting.date,
            "source_url": source_url,
            "raw_content": content.combined_text[:500000],  # Limit size
            "status": status
        }

        result = self.client.table("meetings").insert(data).execute()
        logger.info(f"Created meeting record: {result.data[0]['id']}")
        return result.data[0]

    def update_meeting_status(
        self,
        meeting_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """Update the status of a meeting."""
        data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }
        if error_message:
            data["error_message"] = error_message

        self.client.table("meetings").update(data).eq("id", meeting_id).execute()
        logger.info(f"Updated meeting {meeting_id} status to {status}")

    def create_summary(self, meeting_id: str, summary: "MeetingSummary") -> dict:
        """
        Create a summary record for a meeting.

        Args:
            meeting_id: UUID of the meeting
            summary: Processed summary data

        Returns:
            Created summary record
        """
        # Convert dataclasses to dicts for JSON storage
        key_decisions = [
            {k: v for k, v in asdict(d).items() if v is not None}
            for d in summary.key_decisions
        ]
        action_items = [
            {k: v for k, v in asdict(a).items() if v is not None}
            for a in summary.action_items
        ]

        data = {
            "meeting_id": meeting_id,
            "summary_text": summary.summary_text,
            "key_decisions": key_decisions,
            "action_items": action_items,
            "topics": summary.topics
        }

        result = self.client.table("summaries").insert(data).execute()
        logger.info(f"Created summary for meeting {meeting_id}")
        return result.data[0]

    def get_active_alerts(self) -> list[dict]:
        """Get all active alert preferences with user info."""
        result = self.client.table("alert_preferences").select(
            "*, user_profiles(email)"
        ).eq("is_active", True).execute()
        return result.data

    def create_alert_history(
        self,
        user_id: str,
        meeting_id: str,
        alert_preference_id: str,
        matched_keyword: str,
        email_status: str = "sent"
    ) -> dict:
        """Record that an alert was sent."""
        data = {
            "user_id": user_id,
            "meeting_id": meeting_id,
            "alert_preference_id": alert_preference_id,
            "matched_keyword": matched_keyword,
            "email_status": email_status
        }

        result = self.client.table("alert_history").insert(data).execute()
        return result.data[0]

    def get_recent_summaries(self, hours: int = 24) -> list[dict]:
        """Get summaries created in the last N hours."""
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat()

        result = self.client.table("summaries").select(
            "*, meetings(*)"
        ).gte("created_at", cutoff).execute()

        return result.data


# Singleton instance
_database: Database | None = None


def get_database() -> Database:
    """Get or create the database singleton."""
    global _database
    if _database is None:
        _database = Database()
    return _database


# Import here to avoid circular dependency
from .summarizer import MeetingSummary  # noqa: E402
