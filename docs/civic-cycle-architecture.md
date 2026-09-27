# Civic Cycle architecture

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "background": "#F7F5EF",
    "primaryColor": "#EAF5F5",
    "primaryTextColor": "#112C33",
    "primaryBorderColor": "#0D5E6B",
    "lineColor": "#52666B",
    "secondaryColor": "#FFF4D8",
    "tertiaryColor": "#F2F5F5",
    "fontFamily": "Manrope, Arial, sans-serif",
    "fontSize": "24px"
  },
  "flowchart": {
    "curve": "basis",
    "htmlLabels": true,
    "nodeSpacing": 42,
    "rankSpacing": 74,
    "diagramPadding": 28
  }
}}%%

flowchart LR
    USER["<b>Residents</b><br/><span>Web browser + email</span>"]
    INFRA["<b>Hosting + automation</b><br/><span>Cloudflare · Caddy · Docker</span><br/><span>GitHub Actions schedules</span>"]
    APP["<b>Civic Cycle web app</b><br/><span>Next.js 16 · React 19 · TypeScript</span><br/><span>App Router + Route Handlers</span>"]
    DATA[("<b>Data + identity</b><br/><span>Supabase · PostgreSQL</span><br/><span>Auth + Row Level Security</span>")]
    BOARD["<b>Meeting source</b><br/><span>BoardDocs</span>"]
    AI["<b>AI summaries</b><br/><span>Anthropic Claude</span>"]
    EMAIL["<b>Notifications</b><br/><span>Resend</span>"]

    USER -->|"1 · Search a topic"| INFRA
    INFRA -->|"2 · HTTPS request"| APP
    APP -->|"3 · Full-text query"| DATA
    DATA -->|"4 · Matching summaries"| APP
    APP -->|"5 · Rendered results"| USER

    BOARD -. "Agendas · motions · PDFs" .-> APP
    APP -. "Structured meeting text" .-> AI
    AI -. "Summary · decisions · actions" .-> APP
    APP -. "Store imported data" .-> DATA
    APP -. "Alerts + weekly digest" .-> EMAIL
    EMAIL -. "Email" .-> USER

    classDef person fill:#FFFFFF,stroke:#0D5E6B,stroke-width:3px,color:#112C33;
    classDef infra fill:#F2F5F5,stroke:#52666B,stroke-width:2px,color:#233A40;
    classDef app fill:#0D5E6B,stroke:#083F48,stroke-width:4px,color:#FFFFFF;
    classDef data fill:#E9F5EE,stroke:#2D7650,stroke-width:3px,color:#173D2B;
    classDef source fill:#FFF4D8,stroke:#C47A00,stroke-width:2px,color:#553800;
    classDef ai fill:#F3ECFA,stroke:#765197,stroke-width:2px,color:#38244A;
    classDef email fill:#FFF0E8,stroke:#B96235,stroke-width:2px,color:#522C19;

    class USER person;
    class INFRA infra;
    class APP app;
    class DATA data;
    class BOARD source;
    class AI ai;
    class EMAIL email;

    linkStyle 0,1,2,3,4 stroke:#0D5E6B,stroke-width:4px;
    linkStyle 5,6,7,8,9,10 stroke:#8A6A2F,stroke-width:2px;
```

## Components

- **Residents:** Browse public meeting summaries, search topics, manage authenticated alerts, and receive email updates.
- **Hosting + automation:** Cloudflare terminates public HTTPS, Caddy proxies traffic to the read-only Docker container, and GitHub Actions calls protected scheduled endpoints.
- **Civic Cycle web app:** One Next.js application serves the React interface, Server Components, REST-style route handlers, and the core import, search, summarization, alert, and digest logic in `lib/`.
- **Data + identity:** Supabase provides PostgreSQL, full-text search, authentication, and Row Level Security. Server-only jobs use a service-role client for privileged writes.
- **BoardDocs:** Supplies public school-board meeting lists, agendas, official motions and votes, and optional PDF attachments.
- **Anthropic Claude:** Converts parsed meeting text and official motions into structured summaries, key decisions, topics, and action items.
- **Resend:** Delivers keyword-alert and weekly-digest emails, including links back to the relevant Civic Cycle meeting.

## Highlighted feature flow

The numbered teal path shows a resident searching for a topic. The browser request passes through Cloudflare and Caddy to the Next.js app. The app runs PostgreSQL full-text searches across meeting and summary indexes in Supabase, merges the matching meeting IDs, fetches the paginated records, and renders the results back to the resident.

The dashed paths show how that searchable data is prepared: scheduled or admin-triggered jobs fetch BoardDocs content, the application parses it and asks Claude for a structured summary, then stores the source data and summary in Supabase. Separate jobs match saved keywords and send alerts or digests through Resend.
