"""
BoardDocs client for fetching meeting data.
Wraps llama-index-readers-boarddocs with error handling and logging.
"""

import logging
from typing import Optional
from dataclasses import dataclass
from llama_index.readers.boarddocs import BoardDocsReader
from llama_index.core.schema import Document

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
    documents: list[Document]
    combined_text: str
    agenda_items: list[str]
    attachment_count: int


class BoardDocsClient:
    """Client for fetching and processing BoardDocs meetings."""

    def __init__(self):
        self.reader = BoardDocsReader(
            site=boarddocs_config.site,
            org=boarddocs_config.org,
            committee=boarddocs_config.committee
        )
        logger.info(
            f"Initialized BoardDocs client for {boarddocs_config.org}/{boarddocs_config.committee}"
        )

    def get_meetings(self, limit: Optional[int] = None) -> list[Meeting]:
        """
        Fetch list of meetings from BoardDocs.

        Args:
            limit: Maximum number of meetings to return (most recent first)

        Returns:
            List of Meeting objects
        """
        logger.info("Fetching meeting list from BoardDocs...")

        try:
            raw_meetings = self.reader.get_meetings()
            logger.info(f"Found {len(raw_meetings)} meetings")

            meetings = []
            for m in raw_meetings:
                meeting = Meeting(
                    meeting_id=m.get("meetingID", ""),
                    date=m.get("date", ""),
                    unid=m.get("unid", m.get("meetingID", "")),
                    title=m.get("title")
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

    def process_meeting(self, meeting: Meeting, index_pdfs: bool = True) -> MeetingContent:
        """
        Extract all content from a meeting.

        Args:
            meeting: Meeting to process
            index_pdfs: Whether to extract text from PDF attachments

        Returns:
            MeetingContent with all extracted data
        """
        logger.info(f"Processing meeting: {meeting.unid} ({meeting.date})")

        try:
            documents = self.reader.process_meeting(
                meeting_id=meeting.unid,
                index_pdfs=index_pdfs
            )

            logger.info(f"Extracted {len(documents)} documents")

            # Combine all text
            combined_text = "\n\n---\n\n".join([doc.text for doc in documents])

            # Extract agenda items (documents that aren't PDFs)
            agenda_items = [
                doc.metadata.get("title", "Untitled")
                for doc in documents
                if doc.metadata.get("type") != "attachment"
            ]

            # Count attachments
            attachment_count = sum(
                1 for doc in documents
                if doc.metadata.get("type") == "attachment"
            )

            # Try to get meeting title from first document
            if documents and not meeting.title:
                meeting.title = documents[0].metadata.get(
                    "meeting_title",
                    f"FCPS School Board Meeting - {meeting.date}"
                )

            return MeetingContent(
                meeting=meeting,
                documents=documents,
                combined_text=combined_text,
                agenda_items=agenda_items,
                attachment_count=attachment_count
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
