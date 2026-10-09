# Session workbench

Approved direction: session sidebar, professional workbench, optional projects.

A session is a named, persistent work context. Creating one requires no project. Projects group sessions; formal tasks keep their requirements, artifact references and reports. Existing professional modules remain interactive pages.

The sidebar contains new session, search, pinned/recent sessions, projects and formal tasks. A session header displays its title, group and real local save status. Compact capability tabs switch DOE, analysis, digital twin, virtual conditions and reports. Data and artifacts are available inside the session, not as the default global tree. The assistant opens on demand.

Each session has an internal artifact space separate from its optional organizational project. Internal spaces stay out of project pickers and navigation. Moving a session changes its group, not its inputs or artifact IDs. Existing projects and tasks retain their data. Task sessions use the original task artifact space.

Persist session metadata, per-capability committed settings, editable drafts, preparation confirmations, completed results and route handoffs. Do not persist temporary loading or modal-open states. Remount module content when session identity changes. Store model snapshots for sessions so another session's calibration does not silently change their inputs. Existing legacy task model behavior remains compatible.

Acceptance: create two independent sessions; configure them differently; switch capability/session and reload to recover each separately; group both into a project without losing work; save artifacts and generate a report without creating a visible project; reopen existing tasks and reports; operate at desktop and narrow widths; display saving errors truthfully. Uploaded digital-twin files currently supply names to mock calculations, not file-byte ingestion; preserve that existing behavior.

Execution stays in the supplied checkout on a codex branch. No commit, push or deployment is requested.

## Approved sidebar correction

Independent sessions appear only in the independent recent/pinned sections. Project sessions appear only beneath their project. Replace the large sidebar creation button with a plus beside Recent sessions. Show rename, archive/restore and delete controls on each row only on pointer hover or keyboard focus; touch devices keep controls accessible. Project archive hides its whole group without changing child session archive state. Deletion confirms its scope; task-linked projects retain the existing deletion protection. Conversation deletion preserves artifact spaces referenced by reports or task evidence.

The user subsequently requested GitHub synchronization: commit and push the completed changes to the current codex branch on the `github` remote. Deployment and merging to main remain outside this request.
