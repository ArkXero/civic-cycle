import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const mockMeetings = [
  {
    title: 'FCPS School Board Regular Meeting - January 2025',
    body: 'FCPS School Board',
    meeting_date: '2025-01-23',
    source_url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public',
    source: 'boarddocs',
    status: 'summarized',
    transcript_text: 'This is a mock transcript for the January 2025 FCPS School Board meeting discussing budget proposals and school safety initiatives.'
  },
  {
    title: 'FCPS School Board Work Session - Bell Schedule Review',
    body: 'FCPS School Board',
    meeting_date: '2025-01-16',
    source_url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public',
    source: 'boarddocs',
    status: 'summarized',
    transcript_text: 'Mock transcript covering the bell schedule review work session with community input and staff presentations.'
  },
  {
    title: 'FCPS School Board Regular Meeting - December 2024',
    body: 'FCPS School Board',
    meeting_date: '2024-12-12',
    source_url: 'https://go.boarddocs.com/vsba/fairfax/Board.nsf/Public',
    source: 'boarddocs',
    status: 'summarized',
    transcript_text: 'Mock transcript for the December meeting discussing winter break policies and facilities updates.'
  }
]

const mockSummaries = [
  {
    summary_text: `The FCPS School Board convened for their regular January meeting to discuss several important topics affecting Fairfax County schools.

The primary focus of the meeting was the proposed FY2026 budget, which includes increased funding for teacher salaries and mental health services. Superintendent Reid presented a comprehensive overview of the budget priorities, emphasizing the need for competitive compensation to retain quality educators.

Additionally, the board heard updates on the ongoing school safety initiatives, including the installation of new security systems at elementary schools and the expansion of the school resource officer program.`,
    key_decisions: [
      {
        decision: 'Approved FY2026 budget proposal for public comment period',
        vote_yes: 10,
        vote_no: 2,
        vote_abstain: 0
      },
      {
        decision: 'Authorized expansion of mental health counselor positions',
        vote_yes: 12,
        vote_no: 0,
        vote_abstain: 0
      }
    ],
    action_items: [
      {
        item: 'Schedule public budget hearings for February',
        responsible_party: 'Budget Office',
        deadline: 'February 15, 2025'
      },
      {
        item: 'Present school safety audit results',
        responsible_party: 'Safety and Security',
        deadline: 'March Board Meeting'
      }
    ],
    topics: ['budget', 'school safety', 'mental health', 'teacher salaries', 'facilities']
  },
  {
    summary_text: `The School Board held a work session dedicated to reviewing proposed changes to bell schedules across FCPS schools.

Staff presented research on adolescent sleep patterns and the potential benefits of later start times for middle and high school students. The presentation included data from other school districts that have implemented similar changes.

Community members provided testimony both in support of and against the proposed changes, with parents expressing concerns about impacts on childcare, after-school activities, and transportation logistics.`,
    key_decisions: [
      {
        decision: 'Directed staff to develop implementation timeline options',
        vote_yes: 9,
        vote_no: 3,
        vote_abstain: 0
      }
    ],
    action_items: [
      {
        item: 'Conduct transportation impact analysis',
        responsible_party: 'Transportation Services',
        deadline: 'February 28, 2025'
      },
      {
        item: 'Survey families on preferred start times',
        responsible_party: 'Communications Office',
        deadline: 'January 31, 2025'
      },
      {
        item: 'Meet with athletics directors regarding schedule impacts',
        responsible_party: 'Student Activities',
        deadline: 'February 2025'
      }
    ],
    topics: ['bell schedules', 'start times', 'transportation', 'student health', 'community input']
  },
  {
    summary_text: `The December regular meeting covered end-of-year business and planning for the upcoming semester.

The board approved updated winter weather policies that provide more flexibility for virtual learning days during inclement weather. This policy change reflects lessons learned from previous years and aims to minimize disruption to student learning.

Facilities updates were presented, including progress on the renovation of three elementary schools and the construction of the new middle school in the Tysons area. The projects remain on schedule and within budget.`,
    key_decisions: [
      {
        decision: 'Approved updated inclement weather policy',
        vote_yes: 11,
        vote_no: 1,
        vote_abstain: 0
      },
      {
        decision: 'Accepted facilities progress report',
        vote_yes: 12,
        vote_no: 0,
        vote_abstain: 0
      },
      {
        decision: 'Approved winter break calendar adjustment',
        vote_yes: 10,
        vote_no: 2,
        vote_abstain: 0
      }
    ],
    action_items: [
      {
        item: 'Communicate weather policy changes to families',
        responsible_party: 'Communications Office',
        deadline: 'December 20, 2024'
      },
      {
        item: 'Update virtual learning protocols',
        responsible_party: 'IT Department',
        deadline: 'January 2025'
      }
    ],
    topics: ['weather policy', 'facilities', 'construction', 'virtual learning', 'calendar']
  }
]

async function seed() {
  console.log('Starting seed...')

  // Insert meetings
  for (let i = 0; i < mockMeetings.length; i++) {
    const meeting = mockMeetings[i]
    const summary = mockSummaries[i]

    console.log(`Inserting meeting: ${meeting.title}`)

    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .insert(meeting)
      .select()
      .single()

    if (meetingError) {
      console.error('Error inserting meeting:', meetingError)
      continue
    }

    console.log(`Inserting summary for meeting: ${meetingData.id}`)

    const { error: summaryError } = await supabase
      .from('summaries')
      .insert({
        meeting_id: meetingData.id,
        ...summary
      })

    if (summaryError) {
      console.error('Error inserting summary:', summaryError)
    }
  }

  console.log('Seed completed!')
}

seed().catch(console.error)
