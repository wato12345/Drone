-- Local development database for drone-path-planner
CREATE DATABASE IF NOT EXISTS drone_path_planner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'drone_app'@'localhost' IDENTIFIED BY 'drone_dev_password';
CREATE USER IF NOT EXISTS 'drone_app'@'127.0.0.1' IDENTIFIED BY 'drone_dev_password';
GRANT ALL PRIVILEGES ON drone_path_planner.* TO 'drone_app'@'localhost';
GRANT ALL PRIVILEGES ON drone_path_planner.* TO 'drone_app'@'127.0.0.1';
FLUSH PRIVILEGES;
