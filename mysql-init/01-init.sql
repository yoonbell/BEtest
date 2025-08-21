-- MySQL 초기화 스크립트
-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS team_collaboration_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS team_collaboration_shadow_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 권한 설정
GRANT ALL PRIVILEGES ON team_collaboration_dev.* TO 'teamuser'@'%';
GRANT ALL PRIVILEGES ON team_collaboration_shadow_dev.* TO 'teamuser'@'%';
GRANT CREATE ON *.* TO 'teamuser'@'%';

-- 권한 적용
FLUSH PRIVILEGES;

-- 기본 데이터베이스 선택
USE team_collaboration_dev;
