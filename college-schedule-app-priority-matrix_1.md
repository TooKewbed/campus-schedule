# Campus schedule app — feature priority matrix

A working sketch of scope for a "ultimate college time-management app," organized by build phase. The core hook is schedule import plus a distinction between fixed commitments and flexible/optional events (office hours, study groups) so the daily view stays legible instead of looking like a wall of conflicts.

## V1 — the core loop

These make the app usable day one. Without them there's no product.

**Schedule import.** Pull in a class schedule from a .ics file, a registrar export, or manual entry. This is the foundation everything else sits on top of.

**Daily and weekly views.** A time-grid view of today (and the current week) built from imported events, with clear visual separation between hours that are booked and hours that are open.

**Fixed vs. flexible event types.** The distinction at the heart of the original idea: classes, exams, and work shifts are fixed and block time; office hours, tutoring, and study sessions are flexible and render in their own lane or style so they never look like a double-booking. Real conflicts (two fixed events overlapping) get flagged distinctly from flexible overlap.

**Conflict detection.** Only fixed-vs-fixed overlaps count as conflicts. The app should surface these clearly (a badge, a warning color) rather than let them get lost in the grid.

**Two-way calendar sync.** Google Calendar, Outlook, and Apple Calendar sync, so the app doesn't become one more calendar students have to check separately.

## V1.5 — makes it sticky

Not required to launch, but close enough behind that they should be scoped early.

**Assignment and exam tracking.** Manual entry at minimum; syllabus PDF parsing to auto-populate due dates is the stretch version. This is what turns the app from "a nicer calendar" into something students check daily.

**Free-time surfacing.** A running total or visual cue for how much open time is left today/this week, and where the open blocks are — this is the natural payoff of importing a schedule in the first place.

**Study block suggestions.** Auto-proposed study sessions dropped into open gaps, sized to upcoming workload (assignments due, exam dates).

**Travel-time buffers.** Optional buffer blocks between classes in different buildings, especially valuable on larger campuses.

**Notifications tuned per event type.** A "leave now" nudge for a class ten minutes away reads differently from a "due tonight" nudge for an assignment — treat them as different notification classes, not one generic alert.

**General to-do list.** Tasks that aren't tied to a class time — errands, emails, admin — live alongside academic ones without requiring a time slot. Entries can auto-generate from the assignment tracker, but the list works standalone too; quick natural-language capture ("reading response due Friday"), recurring tasks for weekly readings or chores, and the option to drag any task onto an open calendar block to time-block it when that's useful.

**Read-only schedule sharing.** Export or share a read-only view of your week — a link or an image — so a roommate, study partner, or project team can see when you're free without you exposing every detail of your day. Low effort to build, high payoff: it's the simplest version of "coordinate with other people" and doesn't require anyone else to be on the app.

## V2 — differentiation

Where the app stops being "a calendar with import" and starts being something students recommend to friends.

**LMS integration.** Canvas/Blackboard sync for due dates and grades, reducing manual entry to near zero.

**Grade and GPA tracking.** Including "what do I need on the final" calculators tied to syllabus grading weights.

**Workload/crunch-week forecasting.** A look-ahead view that flags weeks with heavy exam or assignment overlap before the student is in the middle of it.

**Shared availability for group work.** Students can see overlapping free time with project teammates or friends without exposing their full schedule — useful for group projects and just hanging out.

**Recurring exceptions handling.** Holidays, no-class days, and one-off cancellations that shouldn't just be manually deleted from a recurring event.

**Room/building info with map links.** Turns "Room 204" into something a first-year can actually navigate to.

**Career and internship deadline tracker.** Application deadlines and career-fair dates in the same place as everything else, instead of scattered across email and a career-center site.

**Scholarship and financial-aid deadline tracker.** Same logic as above, applied to the dates that are easy to lose track of and expensive to miss.

**Campus resources directory.** Hours and locations for the tutoring center, health services, library, and similar — useful on its own, and it's the natural next step once the app already knows building locations for class rooms.

## V2.5 — wellbeing and polish

Lower urgency, but these are what make the app feel like it's designed for a whole person rather than just a scheduling engine.

**Sleep and meal blocks as first-class events**, not afterthoughts bolted onto the UI.

**Overload warnings** — a gentle flag when a day or week is packed too tight, without being preachy about it.

**Semester zoom-out view** alongside the daily/weekly grid, so students can see the whole term at a glance (useful for big-picture planning, not day-to-day use).

**"What's next" widget** — always-visible next-event-plus-countdown, for the home screen or lock screen.

## Notes on sequencing

The fixed/flexible distinction and conflict detection should be designed together from the start, even if flexible-event types ship narrow (just "office hours" at first) — retrofitting a visual conflict system after the fact is harder than building it in from the first schedule import. LMS and syllabus parsing are the highest-leverage V2 items but also the most technically uncertain (parsing quality varies a lot by school and professor), so they're worth a early technical spike even if the shipped feature waits until V2.

The to-do list and the assignment tracker should share one underlying task data model even though they ship in the same phase — an assignment is really just a task with a course and a due date attached. Designing them as two views over one model avoids a painful merge later and makes "auto-generate a task from an assignment" close to free instead of a separate sync system.

Read-only schedule sharing is worth pulling forward relative to its phase: it's cheap to build on top of the V1 daily/weekly view, and unlike shared availability (V2) or LMS sync it doesn't depend on any other student having the app installed, so it's one of the better low-effort, high-visibility features for early word-of-mouth.
