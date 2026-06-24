CREATE TABLE IF NOT EXISTS GameUsers (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  discord_username VARCHAR(64) NULL,
  discord_global_name VARCHAR(64) NULL,
  discord_avatar VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameSessions (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(32) NULL,
  linked_at DATETIME(3) NULL,
  username VARCHAR(64) NULL,
  username_key VARCHAR(128) NULL,
  country_code CHAR(2) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_GameSessions_user_id (user_id),
  INDEX idx_GameSessions_username_key (username_key),
  INDEX idx_GameSessions_last_seen (last_seen_at),
  CONSTRAINT fk_GameSessions_user FOREIGN KEY (user_id)
    REFERENCES GameUsers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameSessionLinks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  action VARCHAR(32) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_session_links_user (user_id),
  INDEX idx_session_links_session (session_id),
  INDEX idx_GameSessionLinks_user_created (user_id, created_at),
  INDEX idx_GameSessionLinks_session_created (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameProgress (
  session_id VARCHAR(64) NOT NULL,
  dlc_id VARCHAR(64) NOT NULL,
  version SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  lifetime_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  combo INT UNSIGNED NOT NULL DEFAULT 0,
  last_manual_click BIGINT UNSIGNED NOT NULL DEFAULT 0,
  overclock_charge DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  overclock_ends_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  certification_points BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_tick BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (session_id, dlc_id),
  INDEX idx_GameProgress_dlc (dlc_id),
  CONSTRAINT fk_progress_session FOREIGN KEY (session_id)
    REFERENCES GameSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameStats (
  session_id VARCHAR(64) NOT NULL,
  dlc_id VARCHAR(64) NOT NULL,
  all_time_requests DOUBLE UNSIGNED NOT NULL DEFAULT 0,
  manual_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  critical_clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
  best_combo INT UNSIGNED NOT NULL DEFAULT 0,
  total_buildings_purchased BIGINT UNSIGNED NOT NULL DEFAULT 0,
  prestige_count INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
  started_at BIGINT UNSIGNED NOT NULL,
  last_saved BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (session_id, dlc_id),
  INDEX idx_GameStats_leaderboard (dlc_id, prestige_count, all_time_requests),
  CONSTRAINT fk_stats_session FOREIGN KEY (session_id)
    REFERENCES GameSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameBuildings (
  session_id VARCHAR(64) NOT NULL,
  dlc_id VARCHAR(64) NOT NULL,
  building_id VARCHAR(64) NOT NULL,
  quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, dlc_id, building_id),
  INDEX idx_GameBuildings_dlc (dlc_id),
  CONSTRAINT fk_buildings_session FOREIGN KEY (session_id)
    REFERENCES GameSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameUpgrades (
  session_id VARCHAR(64) NOT NULL,
  dlc_id VARCHAR(64) NOT NULL,
  upgrade_id VARCHAR(64) NOT NULL,
  acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (session_id, dlc_id, upgrade_id),
  INDEX idx_GameUpgrades_dlc (dlc_id),
  CONSTRAINT fk_upgrades_session FOREIGN KEY (session_id)
    REFERENCES GameSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS GameCertifications (
  session_id VARCHAR(64) NOT NULL,
  dlc_id VARCHAR(64) NOT NULL,
  certification_id VARCHAR(64) NOT NULL,
  acquired_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (session_id, dlc_id, certification_id),
  INDEX idx_GameCertifications_dlc (dlc_id),
  CONSTRAINT fk_certifications_session FOREIGN KEY (session_id)
    REFERENCES GameSessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
