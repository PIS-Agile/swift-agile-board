The name should be "minimal kanban". It should have minimalistic and tidy, clean UI, dark themed. It shoul have  the following features:
- login with supabase auth
- a "projects" side banner with a default project called "kanban" and the option to create a new project
- inside the kanban project, a set of 5 columns, called "backlog", "to do", "in development", "in review", "done", and the option to create new columns
- each column must have items, and users can drag and drop items into the different columns. Each item will have by deafult the following fields: "name", "description",  "estimated time", "time", "asigned to" (it should allow to be assigned to multiple users), and  the option to create a new field.
when selecting a user to asign an item to, it should list all the available users and allow for multi selection.
- every user can add, edit and delete items, and columns. If a column is deleted, all the items in that column are deleted.
-users must see each others' changes in real time.

It would be great to be able to select multiple items at the same time (by right-clicking and dragging), then move all of them to another column, or delete them all with the SUPR button.

I want you to make all the necessary database features and tables, and to implement the desired site. 
