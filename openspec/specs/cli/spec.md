# cli Specification

## Purpose

Defines how the `osviz` command is invoked, which Project it opens, and how the user leaves it.

## Requirements

### Requirement: Project path argument
The `osviz` command SHALL accept an optional path argument naming the Project to show. When no path is given, it SHALL use the current working directory.

#### Scenario: Path given
- **WHEN** the user runs `osviz /work/app` and `/work/app/openspec/` exists
- **THEN** the dashboard lists the Changes of the Project at `/work/app`

#### Scenario: No path given
- **WHEN** the user runs `osviz` from a directory containing `openspec/`
- **THEN** the dashboard lists the Changes of the Project in that directory

### Requirement: Quit key
The dashboard SHALL exit with status 0 when the user presses `q`.

#### Scenario: Quit
- **WHEN** the dashboard is showing and the user presses `q`
- **THEN** the process exits with status 0 and restores the terminal

### Requirement: Problems do not exit the dashboard
The dashboard SHALL stay running when the Project cannot be read, and SHALL show the problem as an error row instead.

#### Scenario: Path without openspec folder
- **WHEN** the user runs `osviz /tmp/empty` and `/tmp/empty/openspec/` does not exist
- **THEN** the dashboard stays open and shows an error row saying no `openspec/` folder was found at that path

#### Scenario: Path does not exist
- **WHEN** the user runs `osviz /no/such/dir`
- **THEN** the dashboard stays open and shows an error row saying the path does not exist

### Requirement: Base option
The `osviz` command SHALL accept `--base <ref>` and `--base=<ref>`, before or after the path argument, naming the Base for the Project. When `--base` is given without a value, or an unknown option is given, the command SHALL print the problem and a usage line to standard error and exit with status 2 without starting the dashboard.

#### Scenario: Base given
- **WHEN** the user runs `osviz /work/app --base develop`
- **THEN** the dashboard shows the Project at `/work/app` with `develop` as its Base

#### Scenario: Missing value
- **WHEN** the user runs `osviz --base`
- **THEN** the command prints the problem and a usage line to standard error and exits with status 2

#### Scenario: Unknown option
- **WHEN** the user runs `osviz --frobnicate`
- **THEN** the command prints the problem and a usage line to standard error and exits with status 2
