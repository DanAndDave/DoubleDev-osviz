# cli Specification

## Purpose

Defines how the `osviz` command is invoked, which Project it opens, and how the user leaves it.

## Requirements

### Requirement: Project path argument
The `osviz` command SHALL accept zero or more path arguments, each naming a Project to show, and SHALL show the Projects in the order their paths are given. A path given twice SHALL be shown as two Projects. When no path is given, it SHALL show one Project, the current working directory.

#### Scenario: Path given
- **WHEN** the user runs `osviz /work/app` and `/work/app/openspec/` exists
- **THEN** the dashboard lists the Changes of the Project at `/work/app`

#### Scenario: No path given
- **WHEN** the user runs `osviz` from a directory containing `openspec/`
- **THEN** the dashboard lists the Changes of the Project in that directory

#### Scenario: Several paths given
- **WHEN** the user runs `osviz /work/web /work/api`, and both contain `openspec/`
- **THEN** the dashboard lists the Changes of `/work/web`, then the Changes of `/work/api`

### Requirement: Quit key
The dashboard SHALL exit with status 0 when the user presses `q`.

#### Scenario: Quit
- **WHEN** the dashboard is showing and the user presses `q`
- **THEN** the process exits with status 0 and restores the terminal

### Requirement: Problems do not exit the dashboard
The dashboard SHALL stay running when one or more Projects cannot be read, even when none can. It SHALL show each Project's problem as an error row in place of that Project's Change rows, and SHALL show the other Projects normally.

#### Scenario: Path without openspec folder
- **WHEN** the user runs `osviz /tmp/empty` and `/tmp/empty/openspec/` does not exist
- **THEN** the dashboard stays open and shows an error row saying no `openspec/` folder was found at that path

#### Scenario: Path does not exist
- **WHEN** the user runs `osviz /no/such/dir`
- **THEN** the dashboard stays open and shows an error row saying the path does not exist

#### Scenario: One of several Projects fails
- **WHEN** the user runs `osviz /work/app /tmp/empty`, `/work/app/openspec/` exists and `/tmp/empty/openspec/` does not
- **THEN** the dashboard stays open, lists the Changes of `/work/app`, and shows an error row for `/tmp/empty`

### Requirement: Base option
The `osviz` command SHALL accept `--base <ref>` and `--base=<ref>`, before, between or after the path arguments, naming the Base for every Project. A Project in which the ref does not exist SHALL show an error row naming the unknown ref, like any other Project that cannot be read. When `--base` is given without a value, or an unknown option is given, the command SHALL print the problem and a usage line to standard error and exit with status 2 without starting the dashboard.

#### Scenario: Base given
- **WHEN** the user runs `osviz /work/app --base develop`
- **THEN** the dashboard shows the Project at `/work/app` with `develop` as its Base

#### Scenario: Base for several Projects
- **WHEN** the user runs `osviz /work/web --base develop /work/api`
- **THEN** both Projects are shown with `develop` as their Base

#### Scenario: Base missing in one Project
- **WHEN** the user runs `osviz /work/web /work/api --base develop`, and only `/work/web` has a `develop` branch
- **THEN** `/work/web` is shown with `develop` as its Base, and `/work/api` shows an error row naming the unknown `--base` ref `develop`

#### Scenario: Missing value
- **WHEN** the user runs `osviz --base`
- **THEN** the command prints the problem and a usage line to standard error and exits with status 2

#### Scenario: Unknown option
- **WHEN** the user runs `osviz --frobnicate`
- **THEN** the command prints the problem and a usage line to standard error and exits with status 2
