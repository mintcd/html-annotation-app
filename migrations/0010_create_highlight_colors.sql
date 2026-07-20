-- Migration number: 0010 	 2026-07-20T13:57:50.118Z

CREATE TABLE IF NOT EXISTS highlight_colors (
  color     TEXT PRIMARY KEY
            CHECK (
              length(color) = 7
              AND substr(color, 1, 1) = '#'
            ),
  semantics TEXT NOT NULL CHECK (length(trim(semantics)) > 0)
);

INSERT OR IGNORE INTO highlight_colors (color, semantics) VALUES
  ('#87ceeb', 'Reference'),
  ('#90ee90', 'Confirmed'),
  ('#ff6b6b', 'Concern'),
  ('#d3d3d3', 'Follow-up');
