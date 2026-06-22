CREATE TABLE IF NOT EXISTS game_sessions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  username VARCHAR(24) NULL,
  username_key VARCHAR(24) NULL,
  country_code CHAR(2) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_game_sessions_username (username),
  UNIQUE KEY uq_game_sessions_username_key (username_key),
  INDEX idx_game_sessions_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_progress (
  session_id VARCHAR(64) NOT NULL PRIMARY KEY,
  version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  lifetime_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  combo INT UNSIGNED NOT NULL DEFAULT 0,
  last_manual_click BIGINT UNSIGNED NOT NULL DEFAULT 0,
  overclock_charge DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  overclock_ends_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  certification_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_tick BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_progress_session FOREIGN KEY (session_id)
    REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_stats (
  session_id VARCHAR(64) NOT NULL PRIMARY KEY,
  all_time_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  manual_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  critical_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  best_combo INT UNSIGNED NOT NULL DEFAULT 0,
  total_buildings_purchased BIGINT UNSIGNED NOT NULL DEFAULT 0,
  prestige_count INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  started_at BIGINT UNSIGNED NOT NULL,
  last_saved BIGINT UNSIGNED NOT NULL,
  CONSTRAINT fk_stats_session FOREIGN KEY (session_id)
    REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_buildings (
  session_id VARCHAR(64) NOT NULL,
  building_id VARCHAR(64) NOT NULL,
  quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, building_id),
  CONSTRAINT fk_buildings_session FOREIGN KEY (session_id)
    REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_upgrades (
  session_id VARCHAR(64) NOT NULL,
  upgrade_id VARCHAR(64) NOT NULL,
  acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (session_id, upgrade_id),
  CONSTRAINT fk_upgrades_session FOREIGN KEY (session_id)
    REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_certifications (
  session_id VARCHAR(64) NOT NULL,
  certification_id VARCHAR(64) NOT NULL,
  acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (session_id, certification_id),
  CONSTRAINT fk_certifications_session FOREIGN KEY (session_id)
    REFERENCES game_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
