# Pixel Office

A Claude Code mod that shows the agents of your session as staff in a cozy 16-bit pixel-art office, in a pane beside the chat.

- **Claude** is the manager, in the glass corner office.
- Every **subagent, workflow agent and teammate** walks in through the front door to a free desk, with a name plate for its type: Ellie · Explorer, Pat · Planner, Gus · Generalist, and so on.
- While it works it types, its monitor scrolls code, and a speech bubble shows the tool it is using (search, read, edit, shell, web, delegating, ...).
- An agent waiting on a **permission prompt** raises its hand.
- Each desk has **IN and OUT trays**: a paper per file read or written. Click a name to see the files, or turn on **Tooltips** under the picture to see them by hovering a tray (the picture then flashes briefly when it updates).
- When an agent finishes it gets a check mark, walks back out the door, and its desk is free again.
- The office grows a new row of desks when it fills up.
- **Other sessions** running this mod show up as colleagues at the bottom of the office.
- Click a name under the picture for that agent's task, brief, time on the clock, tool calls and files.

Open it with `/office`. It also opens by itself when a session starts.

## Install

At the prompt of a terminal session:

```
/plugin install pixel-office --marketplace roboza/pixel-office
```

Answer `y` to add the marketplace, then pick a scope (user, to have it in every session).

From a shell:

```
claude plugin install pixel-office --marketplace roboza/pixel-office
```

In the Claude desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `roboza/pixel-office`, then **Add plugin**.

## Notes

- The pixel office draws in the desktop app (and other surfaces that draw SVG). A terminal session shows a text roster of the same people instead.
- Other sessions find each other through the mod's own storage, best effort.

## Development

`claude plugin validate .` checks the manifest and hooks; `claude plugin test .` runs the tests in `tests/`.
