#!/usr/bin/env python3
"""
Main entry point for the Fairfax Civic Digest data pipeline.

This script orchestrates the entire data fetching and processing workflow:
1. Fetch new meetings from BoardDocs
2. Summarize meetings with Claude
3. Store in Supabase
4. Process alerts and send emails

Run with: python -m pipeline.main
"""

import logging
import sys
from datetime import datetime

from .config import app_config
from .boarddocs_client import get_boarddocs_client
from .summarizer import get_summarizer
from .database import get_database
from .alerts import get_alert_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def fetch_and_process_meetings() -> dict:
    """
    Fetch new meetings from BoardDocs and process them.

    Returns:
        Stats about the run
    """
    stats = {
        "started_at": datetime.utcnow().isoformat(),
        "meetings_found": 0,
        "meetings_new": 0,
        "meetings_summarized": 0,
        "meetings_failed": 0,
        "alerts_sent": 0
    }

    boarddocs = get_boarddocs_client()
    summarizer = get_summarizer()
    db = get_database()
    alerts = get_alert_service()

    try:
        # Step 1: Fetch meeting list
        logger.info("=" * 60)
        logger.info("STEP 1: Fetching meetings from BoardDocs")
        logger.info("=" * 60)

        meetings = boarddocs.get_meetings(limit=app_config.max_meetings_per_run)
        stats["meetings_found"] = len(meetings)
        logger.info(f"Found {len(meetings)} recent meetings")

        # Step 2: Process each meeting
        logger.info("=" * 60)
        logger.info("STEP 2: Processing meetings")
        logger.info("=" * 60)

        for meeting in meetings:
            # Skip if already processed
            if db.meeting_exists(meeting.unid):
                logger.info(f"Skipping {meeting.unid} - already processed")
                continue

            stats["meetings_new"] += 1
            logger.info(f"Processing new meeting: {meeting.unid} ({meeting.date})")

            try:
                # Extract content
                content = boarddocs.process_meeting(meeting)

                # Create meeting record
                meeting_record = db.create_meeting(meeting, content, status="processing")

                # Summarize
                summary = summarizer.summarize(content)

                # Store summary
                db.create_summary(meeting_record["id"], summary)

                # Update status
                db.update_meeting_status(meeting_record["id"], "summarized")

                stats["meetings_summarized"] += 1
                logger.info(f"Successfully processed meeting {meeting.unid}")

            except Exception as e:
                logger.error(f"Failed to process meeting {meeting.unid}: {e}")
                stats["meetings_failed"] += 1

                # Try to update status if we created the record
                try:
                    if 'meeting_record' in locals():
                        db.update_meeting_status(
                            meeting_record["id"],
                            "failed",
                            error_message=str(e)
                        )
                except Exception:
                    pass

        # Step 3: Process alerts
        logger.info("=" * 60)
        logger.info("STEP 3: Processing alerts")
        logger.info("=" * 60)

        alert_stats = alerts.process_new_summaries()
        stats["alerts_sent"] = alert_stats["emails_sent"]

    except Exception as e:
        logger.error(f"Pipeline failed with error: {e}")
        raise

    finally:
        stats["finished_at"] = datetime.utcnow().isoformat()

    # Print summary
    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  Meetings found:         {stats['meetings_found']}")
    logger.info(f"  New meetings:           {stats['meetings_new']}")
    logger.info(f"  Successfully processed: {stats['meetings_summarized']}")
    logger.info(f"  Failed:                 {stats['meetings_failed']}")
    logger.info(f"  Alerts sent:            {stats['alerts_sent']}")
    logger.info("=" * 60)

    return stats


def main():
    """Main entry point."""
    logger.info("Starting Fairfax Civic Digest pipeline")
    logger.info(f"Environment: {app_config.environment}")

    try:
        stats = fetch_and_process_meetings()

        # Exit with error if any meetings failed
        if stats["meetings_failed"] > 0:
            sys.exit(1)

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
