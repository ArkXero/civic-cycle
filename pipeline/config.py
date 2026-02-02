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
    # Site format: "org/committee" e.g., "vsba/fairfax"
    site: str = "vsba/fairfax"
    # Committee ID - empty string for FCPS (found from page inspection)
    committee_id: str = ""
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
