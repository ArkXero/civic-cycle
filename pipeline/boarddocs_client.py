"""
BoardDocs client for fetching meeting data.
Custom implementation that directly queries BoardDocs API.
"""

import logging
import requests
import re
from typing import Optional, Any
from dataclasses import dataclass
from markdownify import markdownify as md

from .config import boarddocs_config

logger = logging.getLogger(__name__)


@dataclass
class Meeting:
    """Represents a meeting from BoardDocs."""
    meeting_id: str
    date: str
    unid: str
    title: Optional[str] = None


@dataclass
class MeetingContent:
    """Processed content from a meeting."""
    meeting: Meeting
    combined_text: str
    agenda_items: list[str]
    attachment_count: int


class BoardDocsClient:
    """Client for fetching and processing BoardDocs meetings."""

    def __init__(self):
        self.site = boarddocs_config.site
        self.committee_id = boarddocs_config.committee_id
        self.base_url = f"https://go.boarddocs.com/{self.site}/Board.nsf"
        self.session = requests.Session()
        # These headers are required - BoardDocs checks for XMLHttpRequest
        self.session.headers.update({
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "sec-ch-ua": '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
            "Referer": f"https://go.boarddocs.com/{self.site}/Board.nsf/Public",
            "Origin": "https://go.boarddocs.com",
        })

        # Initialize session by visiting the public page first
        self._init_session()
        logger.info(f"Initialized BoardDocs client for: {self.base_url}")

    def _init_session(self):
        """Visit the public page to establish session cookies."""
        try:
            public_url = f"{self.base_url}/Public"
            logger.info(f"Initializing session by visiting: {public_url}")
            response = self.session.get(public_url)
            logger.info(f"Session init response: {response.status_code}")
            logger.info(f"Cookies received: {dict(self.session.cookies)}")
        except Exception as e:
            logger.warning(f"Failed to init session (continuing anyway): {e}")

    def get_meetings(self, limit: Optional[int] = None) -> list[Meeting]:
        """
        Fetch list of meetings from BoardDocs.

        Args:
            limit: Maximum number of meetings to return (most recent first)

        Returns:
            List of Meeting objects
        """
        logger.info("Fetching meeting list from BoardDocs...")
        logger.info(f"Base URL: {self.base_url}")
        logger.info(f"Committee ID: {self.committee_id}")

        try:
            # Try the standard BoardDocs API endpoint
            url = f"{self.base_url}/BD-GetMeetingsList?open"
            # Send as raw string, not dict (matches llama-index implementation)
            data = f"current_committee_id={self.committee_id}"

            logger.info(f"POST request to: {url}")
            logger.info(f"POST data: {data}")
            response = self.session.post(url, data=data)
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response content (first 500 chars): {response.text[:500]}")

            if response.status_code != 200:
                raise Exception(f"BoardDocs returned status {response.status_code}")

            # Try to parse as JSON
            try:
                raw_meetings = response.json()
            except Exception as json_err:
                logger.error(f"Failed to parse JSON: {json_err}")
                logger.error(f"Raw response: {response.text[:1000]}")
                raise

            logger.info(f"Found {len(raw_meetings)} meetings")
            if raw_meetings:
                logger.info(f"First meeting sample: {raw_meetings[0]}")

            meetings = []
            for m in raw_meetings:
                meeting_id = m.get("unique", m.get("meetingID", m.get("id", "")))
                meeting = Meeting(
                    meeting_id=meeting_id,
                    date=m.get("numberdate", m.get("date", "")),
                    unid=m.get("unique", meeting_id),
                    title=m.get("name", m.get("title", None))
                )
                meetings.append(meeting)

            # Sort by date descending (most recent first)
            meetings.sort(key=lambda x: x.date, reverse=True)

            if limit:
                meetings = meetings[:limit]

            return meetings

        except Exception as e:
            logger.error(f"Failed to fetch meetings: {e}")
            raise

    def process_meeting(self, meeting: Meeting) -> MeetingContent:
        """
        Extract all content from a meeting.

        Args:
            meeting: Meeting to process

        Returns:
            MeetingContent with all extracted data
        """
        logger.info(f"Processing meeting: {meeting.unid} ({meeting.date})")

        try:
            # Fetch the detailed agenda
            url = f"{self.base_url}/PRINT-AgendaDetailed"
            data = {
                "id": meeting.unid,
                "current_committee_id": self.committee_id
            }

            logger.info(f"Fetching agenda from: {url}")
            response = self.session.post(url, data=data)

            if response.status_code != 200:
                raise Exception(f"Failed to fetch agenda: status {response.status_code}")

            html_content = response.text
            logger.info(f"Received {len(html_content)} bytes of HTML")

            # Convert HTML to markdown/text
            text_content = md(html_content)

            # Clean up the text
            text_content = re.sub(r'\n{3,}', '\n\n', text_content)
            text_content = text_content.strip()

            logger.info(f"Converted to {len(text_content)} chars of text")

            # Extract title from HTML if not set
            if not meeting.title:
                title_match = re.search(r'<title>([^<]+)</title>', html_content, re.IGNORECASE)
                if title_match:
                    meeting.title = title_match.group(1).strip()
                else:
                    meeting.title = f"FCPS School Board Meeting - {meeting.date}"

            # Try to extract agenda items from the content
            agenda_items = []
            item_matches = re.findall(r'(?:^|\n)(\d+\.\s+[^\n]+)', text_content)
            agenda_items = item_matches[:20]  # Limit to first 20

            return MeetingContent(
                meeting=meeting,
                combined_text=text_content,
                agenda_items=agenda_items,
                attachment_count=0  # Would need additional parsing
            )

        except Exception as e:
            logger.error(f"Failed to process meeting {meeting.unid}: {e}")
            raise


# Singleton instance
_client: Optional[BoardDocsClient] = None


def get_boarddocs_client() -> BoardDocsClient:
    """Get or create the BoardDocs client singleton."""
    global _client
    if _client is None:
        _client = BoardDocsClient()
    return _client
