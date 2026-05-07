const express = require("express");
const User = require("../models/User");
const Project = require("../models/Project");
const { authMiddleware } = require("../middleware/auth");
const { getSocketIO } = require("../utils/socketHelpers");

const router = express.Router();
router.use(authMiddleware);

// GET /api/users/search - search users and public projects
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) return res.json({ users: [], projects: [] });

    const currentUserId = req.user._id;
    
    // Search users (exclude current user)
    const users = await User.find({
      username: { $regex: q, $options: "i" },
      _id: { $ne: currentUserId }
    }).select("username avatar cursorColor").limit(10);

    // Filter out already friends
    const userWithFriends = await User.findById(currentUserId).select("friends");
    const friendIds = userWithFriends.friends.map(f => f.toString());
    const filteredUsers = users.filter(u => !friendIds.includes(u._id.toString()));

    // Search public projects
    const projects = await Project.find({
      name: { $regex: q, $options: "i" },
      isPublic: true
    })
      .populate("owner", "username avatar")
      .select("name description language isPublic owner")
      .limit(10);

    res.json({ users: filteredUsers, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/friends - get friends list
router.get("/friends", async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "username avatar cursorColor");
    res.json(user.friends || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/requests - get incoming friend requests
router.get("/requests", async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friendRequests.from", "username avatar cursorColor");
    res.json(user.friendRequests?.filter(r => r.status === "pending") || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/friends/:userId - send friend request
router.post("/friends/:userId", async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    // Check if already friends
    if (targetUser.friends.includes(currentUserId)) {
      return res.status(400).json({ error: "Already friends" });
    }

    // Check if request already sent
    const existingRequest = targetUser.friendRequests?.find(
      r => r.from.toString() === currentUserId.toString() && r.status === "pending"
    );
    if (existingRequest) {
      return res.status(400).json({ error: "Friend request already sent" });
    }

    // Add to target user's friend requests
    if (!targetUser.friendRequests) targetUser.friendRequests = [];
    targetUser.friendRequests.push({
      from: currentUserId,
      username: req.user.username,
      status: "pending"
    });
    await targetUser.save();

    // Add to current user's sent requests
    const currentUser = await User.findById(currentUserId);
    if (!currentUser.sentFriendRequests) currentUser.sentFriendRequests = [];
    currentUser.sentFriendRequests.push({
      to: targetUserId,
      status: "pending"
    });
    await currentUser.save();

    // Notify via socket
    const io = getSocketIO();
    if (io) {
      io.emit("friend_request", {
        from: { _id: currentUserId, username: req.user.username },
        to: targetUserId
      });
    }

    res.json({ ok: true, message: "Friend request sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/friends/:requestId/accept - accept friend request
router.post("/friends/:requestId/accept", async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const request = currentUser.friendRequests?.id(req.params.requestId);
    
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Friend request not found" });
    }

    // Add to friends
    if (!currentUser.friends) currentUser.friends = [];
    currentUser.friends.push(request.from);
    request.status = "accepted";
    await currentUser.save();

    // Add to the other user's friends
    const otherUser = await User.findById(request.from);
    if (!otherUser.friends) otherUser.friends = [];
    otherUser.friends.push(req.user._id);
    
    // Remove from their sent requests
    otherUser.sentFriendRequests = otherUser.sentFriendRequests?.filter(
      r => r.to.toString() !== req.user._id.toString()
    ) || [];
    await otherUser.save();

    // Notify via socket
    const io = getSocketIO();
    if (io) {
      io.emit("friend_accepted", {
        user: { _id: req.user._id, username: req.user.username },
        friend: request.from
      });
    }

    res.json({ ok: true, message: "Friend request accepted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/friends/:requestId/reject - reject friend request
router.post("/friends/:requestId/reject", async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const request = currentUser.friendRequests?.id(req.params.requestId);
    
    if (!request || request.status !== "pending") {
      return res.status(404).json({ error: "Friend request not found" });
    }

    request.status = "rejected";
    await currentUser.save();

    // Remove from sender's sent requests
    const otherUser = await User.findById(request.from);
    if (otherUser) {
      otherUser.sentFriendRequests = otherUser.sentFriendRequests?.filter(
        r => r.to.toString() !== req.user._id.toString()
      ) || [];
      await otherUser.save();
    }

    res.json({ ok: true, message: "Friend request rejected" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/friends/:friendId - remove friend
router.delete("/friends/:friendId", async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const friendId = req.params.friendId;

    currentUser.friends = currentUser.friends.filter(f => f.toString() !== friendId);
    await currentUser.save();

    // Remove from other user
    const otherUser = await User.findById(friendId);
    if (otherUser) {
      otherUser.friends = otherUser.friends.filter(f => f.toString() !== req.user._id.toString());
      await otherUser.save();
    }

    res.json({ ok: true, message: "Friend removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;