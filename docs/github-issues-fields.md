# GitHub Issues API Fields

## Core Fields (Always Present)
- **title** (string) - Issue title [Maps to: name]
- **body** (string/markdown) - Issue description [Maps to: description]
- **state** (string) - "open" or "closed" [Maps to: column status]
- **number** (integer) - Issue number (auto-generated)
- **id** (integer) - Unique identifier
- **node_id** (string) - GraphQL node ID
- **url** (string) - API URL
- **html_url** (string) - Web URL
- **created_at** (datetime) - Creation timestamp
- **updated_at** (datetime) - Last update timestamp
- **closed_at** (datetime/null) - Close timestamp

## User Fields
- **user** (object) - Issue creator
- **assignee** (object/null) - Single assignee (deprecated in favor of assignees)
- **assignees** (array) - Multiple assignees [Maps to: assigned_to]

## Categorization Fields
- **labels** (array) - Issue labels with name, color, description [Maps to: custom multiselect]
- **milestone** (object/null) - Associated milestone with title, due date [Maps to: custom field]

## Project Management Fields
- **project** (object) - Classic project (deprecated)
- **projects_v2** (via GraphQL) - New Projects fields

## Repository Context
- **repository** (object) - Repository information
- **repository_url** (string) - Repository API URL

## Relationship Fields
- **comments** (integer) - Number of comments
- **comments_url** (string) - Comments API URL
- **events_url** (string) - Events API URL
- **labels_url** (string) - Labels API URL

## Pull Request Related
- **pull_request** (object/null) - Linked PR information

## Permissions
- **locked** (boolean) - Is conversation locked
- **active_lock_reason** (string/null) - Reason for lock
- **author_association** (string) - Author's relationship to repo

## Reactions
- **reactions** (object) - Emoji reactions count

## Custom Fields (via Projects V2 GraphQL API)
- Text fields
- Number fields
- Date fields
- Single select fields
- Iteration fields

## Proposed Kanban Mapping

### Default Fields (Built-in)
1. **name** → GitHub `title`
2. **description** → GitHub `body` (markdown)
3. **assignees** → GitHub `assignees[]`
4. **labels** → GitHub `labels[]`
5. **milestone** → GitHub `milestone`
6. **state** → Derived from column (To Do = open, Done = closed)

### Column Mapping
- Backlog → open + no project status
- To Do → open + project status "To Do"
- In Progress → open + project status "In Progress"
- In Review → open + project status "In Review"
- Done → closed

### Additional GitHub Fields as Custom Fields
- **due_date** → From milestone or Projects V2
- **priority** → Via labels or Projects V2 custom field
- **estimate** → Projects V2 custom field
- **epic/issue_type** → Via labels

### Sync Strategy
1. Two-way sync with conflict resolution
2. Use GitHub webhooks for real-time updates
3. Store GitHub issue ID for linking
4. Map columns to issue states + labels/project fields