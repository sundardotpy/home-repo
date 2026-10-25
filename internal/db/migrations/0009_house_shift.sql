-- House Shift mode keeps its working copy in a throwaway `shift` schema,
-- created when the mode starts and dropped when it ends — so only the mode
-- flag itself needs to survive restarts.

CREATE TABLE app_settings (
    key   text PRIMARY KEY,
    value text NOT NULL
);
