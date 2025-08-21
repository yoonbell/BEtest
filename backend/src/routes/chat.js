const express = require("express");
const { PrismaClient } = require("@prisma/client");
const auth = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// 워크스페이스 채팅 메시지 조회
router.get("/workspace/:workspaceId", auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // 워크스페이스 멤버인지 확인
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: req.user.id,
        accepted: true,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: "워크스페이스에 접근할 권한이 없습니다." });
    }

    // 채팅 메시지 조회 (최신순)
    const messages = await prisma.chatMessage.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: offset,
    });

    // 전체 메시지 수 조회
    const totalCount = await prisma.chatMessage.count({
      where: { workspaceId },
    });

    res.json({
      messages: messages.reverse(), // 시간순으로 정렬
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + messages.length < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("채팅 메시지 조회 오류:", error);
    res.status(500).json({ error: "채팅 메시지를 조회할 수 없습니다." });
  }
});

// 워크스페이스에 채팅 메시지 전송
router.post("/workspace/:workspaceId", auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "메시지 내용을 입력해주세요." });
    }

    // 워크스페이스 멤버인지 확인
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: req.user.id,
        accepted: true,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: "워크스페이스에 접근할 권한이 없습니다." });
    }

    // 채팅 메시지 생성
    const message = await prisma.chatMessage.create({
      data: {
        workspaceId,
        userId: req.user.id,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    // 모든 워크스페이스 멤버의 읽지 않은 메시지 개수 증가 (메시지 작성자 제외)
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        accepted: true,
        userId: { not: req.user.id }, // 메시지 작성자 제외
      },
    });

    // 워크스페이스 소유자도 포함 (메시지 작성자가 소유자가 아닌 경우)
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    const allMembers = [...workspaceMembers];
    if (workspace.ownerId !== req.user.id) {
      allMembers.push({ userId: workspace.ownerId });
    }

    // 각 멤버의 읽지 않은 메시지 개수 업데이트
    for (const member of allMembers) {
      await prisma.chatNotification.upsert({
        where: {
          userId_workspaceId: {
            userId: member.userId,
            workspaceId: workspaceId,
          },
        },
        update: {
          unreadCount: {
            increment: 1,
          },
        },
        create: {
          userId: member.userId,
          workspaceId: workspaceId,
          unreadCount: 1,
        },
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("채팅 메시지 전송 오류:", error);
    res.status(500).json({ error: "채팅 메시지를 전송할 수 없습니다." });
  }
});

// 특정 채팅 메시지 삭제 (작성자만 가능)
router.delete("/message/:messageId", auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    // 메시지 조회
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: req.user.id, accepted: true },
            },
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({ error: "메시지를 찾을 수 없습니다." });
    }

    // 권한 확인 (작성자이거나 워크스페이스 소유자)
    const isOwner = message.workspace.ownerId === req.user.id;
    const isAuthor = message.userId === req.user.id;
    const isMember = message.workspace.members.length > 0;

    if (!isOwner && !isAuthor && !isMember) {
      return res
        .status(403)
        .json({ error: "메시지를 삭제할 권한이 없습니다." });
    }

    // 메시지 삭제
    await prisma.chatMessage.delete({
      where: { id: messageId },
    });

    // 메시지 삭제 후 모든 멤버의 읽지 않은 메시지 개수 재계산
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: message.workspaceId,
        accepted: true,
      },
    });

    // 워크스페이스 소유자도 포함
    const allMembers = [
      ...workspaceMembers,
      { userId: message.workspace.ownerId },
    ];

    for (const member of allMembers) {
      // 해당 사용자가 마지막으로 읽은 시간 이후의 메시지 개수 계산
      const notification = await prisma.chatNotification.findUnique({
        where: {
          userId_workspaceId: {
            userId: member.userId,
            workspaceId: message.workspaceId,
          },
        },
      });

      if (notification) {
        const lastReadAt = notification.lastReadAt;
        const unreadCount = await prisma.chatMessage.count({
          where: {
            workspaceId: message.workspaceId,
            createdAt: { gt: lastReadAt },
          },
        });

        await prisma.chatNotification.update({
          where: {
            userId_workspaceId: {
              userId: member.userId,
              workspaceId: message.workspaceId,
            },
          },
          data: { unreadCount },
        });
      }
    }

    res.json({ message: "메시지가 삭제되었습니다." });
  } catch (error) {
    console.error("채팅 메시지 삭제 오류:", error);
    res.status(500).json({ error: "메시지를 삭제할 수 없습니다." });
  }
});

// 워크스페이스 채팅 메시지 검색
router.get("/workspace/:workspaceId/search", auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { query, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: "검색어를 입력해주세요." });
    }

    // 워크스페이스 멤버인지 확인
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: req.user.id,
        accepted: true,
      },
    });

    if (!member) {
      return res
        .status(403)
        .json({ error: "워크스페이스에 접근할 권한이 없습니다." });
    }

    // 메시지 검색
    const messages = await prisma.chatMessage.findMany({
      where: {
        workspaceId,
        content: {
          contains: query.trim(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit),
      skip: offset,
    });

    // 검색 결과 수 조회
    const totalCount = await prisma.chatMessage.count({
      where: {
        workspaceId,
        content: {
          contains: query.trim(),
        },
      },
    });

    res.json({
      messages: messages.reverse(),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: offset + messages.length < totalCount,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("채팅 메시지 검색 오류:", error);
    res.status(500).json({ error: "메시지 검색에 실패했습니다." });
  }
});

// 워크스페이스 채팅 메시지 읽음 처리
router.post("/workspace/:workspaceId/read", auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // 워크스페이스 멤버인지 확인
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: userId,
        accepted: true,
      },
    });

    const isOwner = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
    });

    if (!member && !isOwner) {
      return res
        .status(403)
        .json({ error: "워크스페이스에 접근할 권한이 없습니다." });
    }

    // 읽지 않은 메시지 개수를 0으로 초기화하고 마지막 읽은 시간 업데이트
    await prisma.chatNotification.upsert({
      where: {
        userId_workspaceId: {
          userId: userId,
          workspaceId: workspaceId,
        },
      },
      update: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
      create: {
        userId: userId,
        workspaceId: workspaceId,
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    });

    res.json({ message: "채팅 메시지가 읽음 처리되었습니다." });
  } catch (error) {
    console.error("채팅 메시지 읽음 처리 오류:", error);
    res.status(500).json({ error: "읽음 처리에 실패했습니다." });
  }
});

// 워크스페이스별 읽지 않은 채팅 메시지 개수 조회
router.get("/workspace/:workspaceId/unread-count", auth, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user.id;

    // 워크스페이스 멤버인지 확인
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: userId,
        accepted: true,
      },
    });

    const isOwner = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
    });

    if (!member && !isOwner) {
      return res
        .status(403)
        .json({ error: "워크스페이스에 접근할 권한이 없습니다." });
    }

    // 읽지 않은 메시지 개수 조회
    const notification = await prisma.chatNotification.findUnique({
      where: {
        userId_workspaceId: {
          userId: userId,
          workspaceId: workspaceId,
        },
      },
      select: { unreadCount: true },
    });

    res.json({ unreadCount: notification?.unreadCount || 0 });
  } catch (error) {
    console.error("읽지 않은 메시지 개수 조회 오류:", error);
    res
      .status(500)
      .json({ error: "읽지 않은 메시지 개수 조회에 실패했습니다." });
  }
});

module.exports = router;
