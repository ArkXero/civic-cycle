"""
Alert matching and email notification system.
Checks new summaries against user keywords and sends email alerts.
"""

import logging
import re
from dataclasses import dataclass
import resend

from .config import resend_config, app_config
from .database import get_database

logger = logging.getLogger(__name__)


@dataclass
class AlertMatch:
    """Represents a matched alert for a user."""
    user_id: str
    user_email: str
    alert_preference_id: str
    keyword: str
    meeting_id: str
    meeting_title: str
    meeting_date: str
    summary_excerpt: str


def find_keyword_in_text(keyword: str, text: str) -> bool:
    """
    Check if a keyword appears in text (case-insensitive, word boundaries).
    """
    pattern = r'\b' + re.escape(keyword) + r'\b'
    return bool(re.search(pattern, text, re.IGNORECASE))


def extract_excerpt(text: str, keyword: str, context_chars: int = 200) -> str:
    """
    Extract a text excerpt around the first occurrence of a keyword.
    """
    match = re.search(
        r'\b' + re.escape(keyword) + r'\b',
        text,
        re.IGNORECASE
    )

    if not match:
        return text[:context_chars] + "..."

    start = max(0, match.start() - context_chars // 2)
    end = min(len(text), match.end() + context_chars // 2)

    excerpt = text[start:end]

    if start > 0:
        excerpt = "..." + excerpt
    if end < len(text):
        excerpt = excerpt + "..."

    return excerpt


class AlertService:
    """Handles alert matching and email notifications."""

    def __init__(self):
        resend.api_key = resend_config.api_key
        self.from_email = resend_config.from_email
        self.db = get_database()
        logger.info("Initialized alert service")

    def find_matches(self, summary_data: dict) -> list[AlertMatch]:
        """
        Find all alert preferences that match a summary.

        Args:
            summary_data: Summary record with joined meeting data

        Returns:
            List of AlertMatch objects
        """
        meeting = summary_data["meetings"]
        summary_text = summary_data["summary_text"]
        topics = summary_data.get("topics", [])

        # Combine searchable text
        searchable = f"{summary_text} {' '.join(topics)}"

        # Get all active alerts
        alerts = self.db.get_active_alerts()

        matches = []
        for alert in alerts:
            keyword = alert["keyword"]

            if find_keyword_in_text(keyword, searchable):
                match = AlertMatch(
                    user_id=alert["user_id"],
                    user_email=alert["user_profiles"]["email"],
                    alert_preference_id=alert["id"],
                    keyword=keyword,
                    meeting_id=meeting["id"],
                    meeting_title=meeting["title"],
                    meeting_date=meeting["meeting_date"],
                    summary_excerpt=extract_excerpt(summary_text, keyword)
                )
                matches.append(match)
                logger.info(
                    f"Alert match: '{keyword}' for user {alert['user_id']}"
                )

        return matches

    def send_alert_email(self, match: AlertMatch) -> bool:
        """
        Send an alert email to a user.

        Args:
            match: Alert match information

        Returns:
            True if email sent successfully
        """
        meeting_url = f"{app_config.url}/meetings/{match.meeting_id}"
        settings_url = f"{app_config.url}/alerts"

        html_content = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">
                Alert: "{match.keyword}" mentioned in School Board meeting
            </h2>

            <p style="color: #666;">
                Your keyword <strong>"{match.keyword}"</strong> was found in a recent
                FCPS School Board meeting summary.
            </p>

            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1a1a1a;">
                    {match.meeting_title}
                </h3>
                <p style="color: #666; font-size: 14px;">
                    {match.meeting_date}
                </p>
                <p style="color: #333;">
                    "{match.summary_excerpt}"
                </p>
            </div>

            <a href="{meeting_url}"
               style="display: inline-block; background: #2563eb; color: white;
                      padding: 12px 24px; border-radius: 6px; text-decoration: none;
                      font-weight: 500;">
                Read Full Summary
            </a>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="color: #999; font-size: 12px;">
                You're receiving this because you set up an alert for "{match.keyword}"
                on Fairfax Civic Digest.
                <a href="{settings_url}" style="color: #999;">Manage your alerts</a>
            </p>
        </div>
        """

        try:
            resend.Emails.send({
                "from": self.from_email,
                "to": match.user_email,
                "subject": f'"{match.keyword}" mentioned in FCPS School Board meeting',
                "html": html_content
            })

            logger.info(f"Sent alert email to {match.user_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")
            return False

    def process_new_summaries(self) -> dict:
        """
        Process all new summaries and send alerts.

        Returns:
            Stats about matches found and emails sent
        """
        stats = {
            "summaries_checked": 0,
            "matches_found": 0,
            "emails_sent": 0,
            "emails_failed": 0
        }

        # Get summaries from last 24 hours
        recent_summaries = self.db.get_recent_summaries(hours=24)
        stats["summaries_checked"] = len(recent_summaries)

        logger.info(f"Checking {len(recent_summaries)} recent summaries for alerts")

        for summary in recent_summaries:
            matches = self.find_matches(summary)
            stats["matches_found"] += len(matches)

            for match in matches:
                # Send email
                success = self.send_alert_email(match)

                # Record in history
                self.db.create_alert_history(
                    user_id=match.user_id,
                    meeting_id=match.meeting_id,
                    alert_preference_id=match.alert_preference_id,
                    matched_keyword=match.keyword,
                    email_status="sent" if success else "failed"
                )

                if success:
                    stats["emails_sent"] += 1
                else:
                    stats["emails_failed"] += 1

        logger.info(f"Alert processing complete: {stats}")
        return stats


# Singleton instance
_alert_service: AlertService | None = None


def get_alert_service() -> AlertService:
    """Get or create the alert service singleton."""
    global _alert_service
    if _alert_service is None:
        _alert_service = AlertService()
    return _alert_service
