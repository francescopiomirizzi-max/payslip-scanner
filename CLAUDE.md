# CLAUDE.md — payslip-scanner / RailFlow

## Istruzioni generali

- All'inizio di ogni sessione, leggi sempre [Francesco Pio.md](.claude/Francesco%20Pio.md) (anche se non viene invocato `/start`). Contiene i principi di metodo — pensa prima di produrre, semplicità, interventi chirurgici, obiettivi verificabili — e si applicano a come affronti ogni task.
- All'inizio di ogni sessione, rivedi [tasks/lessons.md](tasks/lessons.md) per le lezioni rilevanti al progetto.
- Rispondi sempre in italiano, salvo diversa indicazione.
- Quando menzioni file o cartelle in chat, usa sempre il formato link cliccabile: `[nome-file.md](percorso/relativo/nome-file.md)`. Mai solo backtick.
- Crea sempre i file in formato Markdown, salvo diversa indicazione.
- Per output lunghi (relazioni, audit, dump, transcript): non mostrare mai il contenuto in chat. Scrivi su file e comunica solo il percorso.
- Salva i piani in [tasks/todo.md](tasks/todo.md) e attendi approvazione prima di eseguire.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

### 3. Self-Improvement Loop
- After ANY correction from the user: update [tasks/lessons.md](tasks/lessons.md) with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until the mistake rate drops.
- Review lessons at session start for the relevant project.

### 4. Verification Before Done
- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes — don't over-engineer.
- Challenge your own work before presenting it.

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Zero context switching required from the user.
- Go fix failing CI tests without being told how.

## Task Management

- **Plan First:** write the plan to [tasks/todo.md](tasks/todo.md) with checkable items.
- **Verify Plan:** check in before starting implementation.
- **Track Progress:** mark items complete as you go.
- **Explain Changes:** high-level summary at each step.
- **Document Results:** add a review section to [tasks/todo.md](tasks/todo.md).
- **Capture Lessons:** update [tasks/lessons.md](tasks/lessons.md) after corrections.

## Core Principles

- **Simplicity First:** make every change as simple as possible. Impact minimal code.
- **No Laziness:** find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** changes should only touch what's necessary. Avoid introducing bugs.
