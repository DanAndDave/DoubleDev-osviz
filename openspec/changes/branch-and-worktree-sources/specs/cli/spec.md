## ADDED Requirements

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
