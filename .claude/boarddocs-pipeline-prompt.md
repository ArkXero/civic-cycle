# Fairfax Civic Digest — BoardDocs Data Pipeline

## What This Document Is

This is a standalone prompt for building the **data fetching and processing pipeline** for Fairfax Civic Digest. This pipeline runs separately from the main Next.js web app.

**The pipeline's job:**
1. Fetch meeting data from FCPS BoardDocs
2. Extract agenda items and PDF attachments
3. Summarize content using Claude API
4. Store everything in Supabase
5. Match new summaries against user alert keywords
6. Send email notifications

**Where it runs:** GitHub Actions (free, scheduled, full Ubuntu VM)

**Why separate from Vercel:** The BoardDocs scraper requires Python packages (llama-index) that can't run in Vercel's serverless environment. GitHub Actions gives us a full Linux VM where we can install anything.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS                                 │
│                         (Runs daily at 6 AM ET)                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │ │
│  │   │   STEP 1     │    │   STEP 2     │    │   STEP 3     │       │ │
│  │   │              │    │              │    │              │       │ │
│  │   │ Fetch new    │───▶│ Summarize    │───▶│ Store in     │       │ │
│  │   │ meetings     │    │ with Claude  │    │ Supabase     │       │ │
│  │   │ from         │    │ API          │    │              │       │ │
│  │   │ BoardDocs    │    │              │    │              │       │ │
│  │   └──────────────┘    └──────────────┘    └──────────────┘       │ │
│  │                                                  │                 │ │
│  │                                                  ▼                 │ │
│  │                                           ┌──────────────┐       │ │
│  │                                           │   STEP 4     │       │ │
│  │                                           │              │       │ │
│  │                                           │ Match alerts │       │ │
│  │                                           │ & send       │       │ │
│  │                                           │ emails       │       │ │
│  │                                           └──────────────┘       │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   BOARDDOCS     │  │   CLAUDE API    │  │    SUPABASE     │
│                 │  │                 │  │                 │
│ go.boarddocs.   │  │ Anthropic       │  │ PostgreSQL DB   │
│ com/vsba/       │  │ claude-sonnet   │  │ + Auth          │
│ fairfax/        │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │     RESEND      │
                                          │                 │
                                          │ Email delivery  │
                                          └─────────────────┘
```

---

## Project Structure

This pipeline lives inside the main project repository but is self-contained:

```
fairfax-civic-digest/
├── .github/
│   └── workflows/
│       └── fetch-meetings.yml      # GitHub Actions workflow definition
│
├── pipeline/                        # All pipeline code lives here
│   ├── requirements.txt            # Python dependencies
│   ├── __init__.py
│   │
│   ├── config.py                   # Configuration and environment variables
│   ├── boarddocs_client.py         # BoardDocs fetching logic
│   ├── summarizer.py               # Claude API summarization
│   ├── database.py                 # Supabase operations
│   ├── alerts.py                   # Alert matching and email sending
│   │
│   ├── main.py                     # Main entry point - orchestrates everything
│   │
│   └── tests/                      # Unit tests
│       ├── __init__.py
│       ├── test_boarddocs.py
│       ├── test_summarizer.py
│       └── test_alerts.py
│
├── app/                            # Next.js app (separate, don't modify)
├── components/                     # React components (separate, don't modify)
└── ...
```

---

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Runtime | Python | 3.11 | GitHub Actions default |
| BoardDocs Scraping | llama-index-readers-boarddocs | latest | Extract meeting data |
| LLM Framework | llama-index-core | latest | Document processing |
| AI Summarization | anthropic | latest | Claude API client |
| Database | supabase | latest | Python client for Supabase |
| Email | resend | latest | Transactional email |
| Testing | pytest | latest | Unit tests |
| Type Checking | mypy | latest | Static type checking |

### requirements.txt

```
# Core dependencies
llama-index-core>=0.10.0
llama-index-readers-boarddocs>=0.1.0
anthropic>=0.18.0
supabase>=2.0.0
resend>=0.7.0

# Utilities
python-dotenv>=1.0.0
pydantic>=2.0.0

# Development
pytest>=8.0.0
mypy>=1.8.0
```

---

## Environment Variables

The pipeline needs these environment variables (stored as GitHub Secrets):

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...  # Service role key, not anon key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alerts@fairfaxdigest.com

# App Configuration
APP_URL=https://fairfaxdigest.com
ENVIRONMENT=production
```

**Important:** Use `SUPABASE_SERVICE_KEY` (service role), not the anon key. The service role bypasses Row Level Security, which we need for the pipeline to insert data.

---

## BoardDocs Configuration

### FCPS BoardDocs Parameters

Based on the URL `https://go.boarddocs.com/vsba/fairfax/Board.nsf/goto?open&id=D8BHS949DD31`:

```python
BOARDDOCS_CONFIG = {
    "site": "go.boarddocs.com",
    "org": "vsba",                    # Virginia School Boards Association
    "committee": "fairfax",           # FCPS
    "body_name": "FCPS School Board"  # Display name for our app
}
```

### What the Reader Returns

The `BoardDocsReader` returns a list of `Document` objects:

```python
from llama_index.readers.boarddocs import BoardDocsReader

reader = BoardDocsReader(
    site="go.boarddocs.com",
    org="vsba",
    committee="fairfax"
)

# Get list of meetings
meetings = reader.get_meetings()
# Returns: [
#   {"meetingID": "ABC123", "date": "2025-01-15", "unid": "D8BHS949DD31"},
#   {"meetingID": "DEF456", "date": "2025-01-08", "unid": "C7AGR838CC20"},
#   ...
# ]

# Get documents for a specific meeting
documents = reader.process_meeting(meeting_id="D8BHS949DD31", index_pdfs=True)
# Returns: [
#   Document(
#     text="Agenda Item 1: Budget Review\n\nThe board will review...",
#     metadata={
#       "title": "Budget Review",
#       "category": "Action Items",
#       "meeting_date": "2025-01-15",
#       "source": "https://go.boarddocs.com/vsba/fairfax/..."
#     }
#   ),
#   Document(
#     text="[PDF Content] FY2026 Budget Proposal...",
#     metadata={
#       "title": "FY2026 Budget Proposal.pdf",
#       "type": "attachment",
#       ...
#     }
#   ),
#   ...
# ]
```

---

## Database Schema

The pipeline writes to these Supabase tables (should already exist from main app setup):

### meetings

```sql
create table public.meetings (
  id uuid default uuid_generate_v4() primary key,
  external_id text unique not null,           -- BoardDocs meeting ID
  title text not null,
  body text not null default 'FCPS School Board',
  meeting_date date not null,
  source_url text,                            -- Link to BoardDocs
  raw_content text,                           -- Full extracted text (for search)
  status text not null default 'pending',     -- pending, processing, summarized, failed
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create unique index meetings_external_id_idx on public.meetings(external_id);
```

### summaries

```sql
create table public.summaries (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade unique not null,
  summary_text text not null,
  key_decisions jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  topics text[] default '{}',
  created_at timestamp with time zone default now()
);
```

### alert_preferences

```sql
create table public.alert_preferences (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  keyword text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);
```

### alert_history

```sql
create table public.alert_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  alert_preference_id uuid references public.alert_preferences(id) on delete set null,
  matched_keyword text not null,
  sent_at timestamp with time zone default now(),
  email_status text default 'sent'
);
```

---

## Implementation Files

### pipeline/config.py

```python
"""
Configuration management for the pipeline.
Loads environment variables and provides typed config objects.
"""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class BoardDocsConfig:
    site: str = "go.boarddocs.com"
    org: str = "vsba"
    committee: str = "fairfax"
    body_name: str = "FCPS School Board"


@dataclass
class SupabaseConfig:
    url: str = ""
    service_key: str = ""
    
    def __post_init__(self):
        self.url = os.environ.get("SUPABASE_URL", "")
        self.service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        
        if not self.url or not self.service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")


@dataclass
class AnthropicConfig:
    api_key: str = ""
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096
    
    def __post_init__(self):
        self.api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY must be set")


@dataclass
class ResendConfig:
    api_key: str = ""
    from_email: str = ""
    
    def __post_init__(self):
        self.api_key = os.environ.get("RESEND_API_KEY", "")
        self.from_email = os.environ.get("RESEND_FROM_EMAIL", "alerts@fairfaxdigest.com")


@dataclass
class AppConfig:
    url: str = ""
    environment: str = "development"
    max_meetings_per_run: int = 10
    
    def __post_init__(self):
        self.url = os.environ.get("APP_URL", "http://localhost:3000")
        self.environment = os.environ.get("ENVIRONMENT", "development")


# Global config instances
boarddocs_config = BoardDocsConfig()
supabase_config = SupabaseConfig()
anthropic_config = AnthropicConfig()
resend_config = ResendConfig()
app_config = AppConfig()
```

### pipeline/boarddocs_client.py

```python
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
```

### pipeline/summarizer.py

```python
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
}

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
```

### pipeline/database.py

```python
"""
Database operations for storing meetings and summaries in Supabase.
"""

import logging
from dataclasses import asdict
from datetime import datetime
from typing import Optional
from supabase import create_client, Client

from .config import supabase_config, boarddocs_config
from .boarddocs_client import Meeting, MeetingContent
from .summarizer import MeetingSummary

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
            f"https://{boarddocs_config.site}/{boarddocs_config.org}/"
            f"{boarddocs_config.committee}/Board.nsf/goto?open&id={meeting.unid}"
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
    
    def create_summary(self, meeting_id: str, summary: MeetingSummary) -> dict:
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
        cutoff = datetime.utcnow().replace(
            hour=datetime.utcnow().hour - hours
        ).isoformat()
        
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
```

### pipeline/alerts.py

```python
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
                🔔 Alert: "{match.keyword}" mentioned in School Board meeting
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
                Read Full Summary →
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
                "subject": f'🔔 "{match.keyword}" mentioned in FCPS School Board meeting',
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
```

### pipeline/main.py

```python
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
                logger.info(f"✓ Successfully processed meeting {meeting.unid}")
                
            except Exception as e:
                logger.error(f"✗ Failed to process meeting {meeting.unid}: {e}")
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
    logger.info(f"  Meetings found:      {stats['meetings_found']}")
    logger.info(f"  New meetings:        {stats['meetings_new']}")
    logger.info(f"  Successfully processed: {stats['meetings_summarized']}")
    logger.info(f"  Failed:              {stats['meetings_failed']}")
    logger.info(f"  Alerts sent:         {stats['alerts_sent']}")
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
```

---

## GitHub Actions Workflow

### .github/workflows/fetch-meetings.yml

```yaml
name: Fetch FCPS School Board Meetings

on:
  # Run daily at 6 AM ET (11 AM UTC)
  schedule:
    - cron: '0 11 * * *'
  
  # Allow manual trigger from GitHub UI
  workflow_dispatch:
    inputs:
      max_meetings:
        description: 'Maximum meetings to process'
        required: false
        default: '10'

jobs:
  fetch-and-process:
    runs-on: ubuntu-latest
    
    # Set timeout to prevent runaway jobs
    timeout-minutes: 30
    
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
      RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
      APP_URL: ${{ secrets.APP_URL }}
      ENVIRONMENT: production
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: 'pipeline/requirements.txt'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r pipeline/requirements.txt
      
      - name: Run pipeline
        run: |
          python -m pipeline.main
      
      - name: Report status
        if: always()
        run: |
          echo "Pipeline finished with status: ${{ job.status }}"
```

---

## Local Development

### Running the pipeline locally

```bash
# 1. Navigate to project root
cd fairfax-civic-digest

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r pipeline/requirements.txt

# 4. Create .env file with your credentials
cat > .env << EOF
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alerts@fairfaxdigest.com
APP_URL=http://localhost:3000
ENVIRONMENT=development
EOF

# 5. Run the pipeline
python -m pipeline.main
```

### Testing individual components

```bash
# Test BoardDocs connection
python -c "
from pipeline.boarddocs_client import get_boarddocs_client
client = get_boarddocs_client()
meetings = client.get_meetings(limit=3)
print(f'Found {len(meetings)} meetings')
for m in meetings:
    print(f'  - {m.date}: {m.unid}')
"

# Test database connection
python -c "
from pipeline.database import get_database
db = get_database()
print('Database connected successfully')
"

# Test summarizer (requires meeting content)
python -c "
from pipeline.summarizer import get_summarizer
s = get_summarizer()
print(f'Summarizer initialized with model: {s.model}')
"
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `llama-index-readers-boarddocs` not found | Package not installed | `pip install llama-index-readers-boarddocs` |
| BoardDocs returns empty list | Wrong org/committee params | Verify URL structure matches config |
| Claude API rate limited | Too many requests | Add delays between summarizations |
| Supabase permission denied | Using anon key | Use service role key for pipeline |
| Emails not sending | Invalid Resend API key | Check key in Resend dashboard |
| GitHub Actions failing | Missing secrets | Add all env vars as repository secrets |

### Debugging

Add verbose logging:

```python
# At top of main.py
logging.getLogger("pipeline").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)  # See HTTP requests
```

### Testing with mock data

For development without hitting real APIs:

```python
# pipeline/tests/fixtures.py

MOCK_MEETING = {
    "meeting_id": "TEST123",
    "date": "2025-01-15",
    "unid": "TEST123",
    "title": "Test School Board Meeting"
}

MOCK_CONTENT = """
Agenda Item 1: Budget Review

The board reviewed the FY2026 budget proposal. 
Key highlights include a 3% increase in teacher salaries 
and $5M allocated for facility improvements.

Motion to approve the budget passed 10-2.

Agenda Item 2: Bell Schedule Discussion

Parents expressed concerns about early start times.
The board will form a committee to study alternatives.
"""
```

---

## Implementation Order

Follow this order strictly:

### Phase 1: Foundation (Day 1)
1. [ ] Create `pipeline/` directory structure
2. [ ] Create `requirements.txt`
3. [ ] Create `config.py` with environment loading
4. [ ] Test: Can import config without errors

### Phase 2: BoardDocs Client (Day 2)
1. [ ] Create `boarddocs_client.py`
2. [ ] Test: Can fetch meeting list from FCPS BoardDocs
3. [ ] Test: Can extract content from a single meeting
4. [ ] Handle errors gracefully

### Phase 3: Database Layer (Day 3)
1. [ ] Verify Supabase tables exist (from main app setup)
2. [ ] Create `database.py`
3. [ ] Test: Can check if meeting exists
4. [ ] Test: Can insert meeting and summary
5. [ ] Test: Can query recent summaries

### Phase 4: Summarizer (Day 4)
1. [ ] Create `summarizer.py`
2. [ ] Craft and test the summarization prompt
3. [ ] Test: Can summarize mock content
4. [ ] Test: Can summarize real meeting content
5. [ ] Handle long content (truncation)

### Phase 5: Alert System (Day 5)
1. [ ] Create `alerts.py`
2. [ ] Test: Can match keywords in summary
3. [ ] Test: Can send email via Resend
4. [ ] Test: Records alert history

### Phase 6: Orchestration (Day 6)
1. [ ] Create `main.py`
2. [ ] Test: Full pipeline runs end-to-end locally
3. [ ] Add proper error handling and logging
4. [ ] Test: Pipeline handles failures gracefully

### Phase 7: GitHub Actions (Day 7)
1. [ ] Create `.github/workflows/fetch-meetings.yml`
2. [ ] Add secrets to GitHub repository
3. [ ] Test: Manual workflow trigger works
4. [ ] Test: Scheduled run executes correctly
5. [ ] Monitor first few automated runs

---

## Questions to Ask Before Writing Code

1. Am I following the implementation order? Don't skip ahead.
2. Is this the simplest way to do it? Prefer boring solutions.
3. Have I tested the previous step? Don't build on untested foundations.
4. Am I handling errors? The pipeline runs unattended.
5. Am I logging enough? Debugging GitHub Actions is hard without logs.

---

## Success Criteria

The pipeline is complete when:

1. ✅ Runs daily via GitHub Actions without manual intervention
2. ✅ Fetches new meetings from FCPS BoardDocs
3. ✅ Generates useful, readable summaries via Claude
4. ✅ Stores everything in Supabase for the web app to display
5. ✅ Sends email alerts when keywords match
6. ✅ Handles errors without crashing (logs and continues)
7. ✅ Completes within 30 minutes (GitHub Actions timeout)

---

## Ready to Start

When I say "let's begin," start with Phase 1: Create the pipeline directory structure and requirements.txt. Walk me through each file and explain what it does.
