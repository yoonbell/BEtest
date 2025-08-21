-- Team Collaboration Database Schema
-- MySQL 버전

-- 사용자 테이블
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    avatar TEXT,
    role VARCHAR(20) DEFAULT 'member',
    isActive BOOLEAN DEFAULT TRUE,
    lastLogin DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 친구 관계 테이블
CREATE TABLE friends (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    friendId VARCHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (userId, friendId),
    INDEX idx_userId (userId),
    INDEX idx_friendId (friendId),
    INDEX idx_status (status)
);

-- 개인 Todo 테이블
CREATE TABLE personal_todos (
    id VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    startDate DATETIME,
    dueDate DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_startDate (startDate),
    INDEX idx_dueDate (dueDate)
);

-- 워크스페이스 테이블
CREATE TABLE workspaces (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ownerId VARCHAR(36) NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ownerId (ownerId)
);

-- 워크스페이스 멤버 테이블
CREATE TABLE workspace_members (
    id VARCHAR(36) PRIMARY KEY,
    workspaceId VARCHAR(36) NOT NULL,
    userId VARCHAR(36) NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_workspace_member (workspaceId, userId),
    INDEX idx_workspaceId (workspaceId),
    INDEX idx_userId (userId)
);

-- 단체 Task 테이블
CREATE TABLE group_tasks (
    id VARCHAR(36) PRIMARY KEY,
    workspaceId VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    startDate DATETIME NOT NULL,
    dueDate DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
    INDEX idx_workspaceId (workspaceId),
    INDEX idx_department (department),
    INDEX idx_status (status),
    INDEX idx_startDate (startDate),
    INDEX idx_dueDate (dueDate)
);

-- 워크스페이스 채팅 메시지 테이블
CREATE TABLE chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    workspaceId VARCHAR(36) NOT NULL,
    userId VARCHAR(36) NOT NULL,
    content TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspaceId) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_workspaceId (workspaceId),
    INDEX idx_userId (userId),
    INDEX idx_createdAt (createdAt)
);

-- 리프레시 토큰 테이블
CREATE TABLE refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    token VARCHAR(512) UNIQUE NOT NULL,
    userId VARCHAR(36) NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_userId (userId),
    INDEX idx_expiresAt (expiresAt)
);
