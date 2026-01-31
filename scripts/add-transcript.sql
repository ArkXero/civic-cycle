-- Add a sample transcript to the first meeting so we can test AI summarization
-- Run this in Supabase SQL Editor

UPDATE meetings
SET
  transcript_text = 'FAIRFAX COUNTY PUBLIC SCHOOLS
SCHOOL BOARD MEETING
January 15, 2025

ATTENDEES:
- Chair Karen Corbett Sanders
- Vice Chair Melanie Meren
- Member Rachna Sizemore Heizer
- Member Abrar Omeish
- Member Karl Frisch
- Member Marcia St. John-Cunning
- Member Ricardy Anderson
- Superintendent Dr. Michelle Reid

[Meeting called to order at 7:00 PM]

CHAIR SANDERS: Good evening everyone. I call this meeting of the Fairfax County School Board to order. Tonight we have several important items on our agenda, including discussion of mental health resources and our budget planning for the upcoming fiscal year.

DR. REID: Thank you, Chair Sanders. Before we begin, I want to highlight some exciting news. Our student achievement scores have shown significant improvement this quarter, particularly in mathematics where we''ve seen a 12% increase across middle schools.

MEMBER HEIZER: That''s wonderful news, Dr. Reid. I''d like to know how the new tutoring programs have contributed to these results.

DR. REID: Absolutely. The after-school tutoring initiative we launched in September has served over 3,000 students. Preliminary data shows students who participated at least twice weekly improved their grades by an average of one letter grade.

CHAIR SANDERS: Let''s move to our first agenda item - the mental health support services expansion.

[AGENDA ITEM 1: MENTAL HEALTH SERVICES]

MEMBER OMEISH: As many of you know, student mental health has been a priority for this board. I''m pleased to present our proposal to add 15 new school counselors across the district, with priority placement in Title I schools.

MEMBER FRISCH: What''s the timeline for hiring these counselors?

MEMBER OMEISH: We''re proposing to have all positions filled by August 2025, in time for the new school year. The total budget allocation would be $1.2 million annually.

MEMBER ANDERSON: I fully support this initiative. The feedback from parents and students has been overwhelming. Many have shared that current wait times to see a counselor can be up to two weeks.

DR. REID: Our goal is to reduce that wait time to no more than 3 days for initial consultations.

[VOTE: The motion to approve the mental health counselor expansion passes 7-0]

[AGENDA ITEM 2: BUDGET PLANNING FY2026]

CHAIR SANDERS: Moving on to our budget discussion. Our CFO will present the preliminary numbers.

CFO JOHNSON: Thank you. For FY2026, we''re projecting total revenues of $3.2 billion, with anticipated expenditures of $3.15 billion. This leaves us with a small surplus that I recommend allocating to our capital improvement fund.

MEMBER ST. JOHN-CUNNING: What about teacher salary increases? That''s been a major concern from our educators.

CFO JOHNSON: We''ve allocated a 4% cost-of-living adjustment for all staff, plus an additional 2% for teachers who have completed professional development requirements.

MEMBER MEREN: I want to ensure we''re also addressing facility maintenance. Several schools have reported HVAC issues.

CFO JOHNSON: Yes, we''ve set aside $45 million for facility improvements, with HVAC upgrades as the top priority. Specifically, Marshall High School, Langley High School, and Annandale Terrace Elementary are scheduled for complete HVAC replacements.

[VOTE: The preliminary budget framework is approved 6-1]

[AGENDA ITEM 3: TECHNOLOGY INITIATIVE]

MEMBER FRISCH: I''d like to discuss our 1:1 device program. We need to ensure all students have equal access to technology.

DR. REID: Currently, 94% of our students have assigned devices. We''re working to close the remaining gap by providing hotspot devices to families without reliable internet access.

MEMBER HEIZER: How many families would benefit from the hotspot program?

DR. REID: Approximately 2,500 families have been identified as needing connectivity support. We''ve budgeted $500,000 for this initiative.

[VOTE: The technology access initiative passes unanimously]

[PUBLIC COMMENT PERIOD]

PARENT SPEAKER 1: My name is Jennifer Thompson, and I have three children in FCPS schools. I want to thank the board for prioritizing mental health. My daughter has benefited greatly from counseling services, but we waited six weeks for an appointment. I urge you to fast-track the counselor hiring.

PARENT SPEAKER 2: Good evening, I''m Marcus Williams, parent of a student at Falls Church High School. I''m concerned about school safety. Can the board provide an update on security measures?

CHAIR SANDERS: Thank you for your concern. We recently completed security assessments at all facilities and have allocated $10 million for security improvements including updated camera systems and secure entry vestibules.

TEACHER SPEAKER: I''m Sarah Chen, a teacher at Oakton High School. I appreciate the salary increase discussion, but I want to emphasize that workload is equally important. Many teachers are handling classes of 35+ students.

DR. REID: Thank you for raising this. We''re committed to reducing class sizes where possible. The budget includes funding for 50 new teaching positions specifically to address overcrowding in our most impacted schools.

[CLOSING REMARKS]

CHAIR SANDERS: Thank you all for attending tonight. To summarize our key actions:
1. Approved expansion of mental health counselors - 15 new positions
2. Approved preliminary FY2026 budget framework of $3.2 billion
3. Approved technology access initiative for 2,500 families
4. Confirmed $10 million allocation for school security improvements

Our next meeting will be February 5, 2025. This meeting is adjourned.

[Meeting adjourned at 9:45 PM]',
  status = 'pending'
WHERE title LIKE '%Mental Health%';

-- Verify the update
SELECT id, title, status,
       CASE WHEN transcript_text IS NOT NULL THEN 'Has transcript' ELSE 'No transcript' END as transcript_status
FROM meetings
WHERE title LIKE '%Mental Health%';
