import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import Charger from '../models/Charger.js';
import { emitToUser, getIO } from '../config/socket.js';
import { sendNotification } from '../services/notifications/notification.service.js';
import logger from '../utils/logger.js';

export const startOrUpgradeChat = async (req, res, next) => {
  try {
    const { chargerId, bookingId } = req.body;
    const charger = await Charger.findById(chargerId);

    if (!charger) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Charger not found' },
      });
    }

    const hostId = charger.owner;
    const driverId = req.user._id;

    let chat = await Chat.findOne({
      participants: { $all: [driverId, hostId] },
      charger: chargerId,
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [driverId, hostId],
        charger: chargerId,
        booking: bookingId || null,
        lastMessage: {
          text: 'Chat started',
          sender: driverId,
          createdAt: new Date(),
        },
      });
    }

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name email avatar role')
      .populate('charger', 'title location powerOutput connectorType chargerType pricePerHour isFastCharger');

    res.status(200).json({
      success: true,
      data: { chat: populated },
    });
  } catch (error) {
    next(error);
  }
};

export const listChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .populate('participants', 'name email avatar role')
      .populate('charger', 'title location powerOutput connectorType chargerType pricePerHour isFastCharger')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: { chats },
    });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ chat: req.params.id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { messageText } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Chat thread not found' },
      });
    }

    const message = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      messageText,
    });

    // Populate sender details for real-time emission
    const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

    chat.lastMessage = {
      text: messageText,
      sender: req.user._id,
      createdAt: new Date(),
    };
    await chat.save();

    // Emit to chat room
    try {
      const io = getIO();
      io.to(`chat_${chat._id}`).emit('message:received', {
        chatId: chat._id.toString(),
        message: populatedMessage,
      });
    } catch (ioErr) {
      // Socket may not be connected in tests
    }

    // Also emit to each participant's personal room and dispatch notification
    for (const participantId of chat.participants) {
      if (String(participantId) !== String(req.user._id)) {
        emitToUser(participantId.toString(), 'message:received', {
          chatId: chat._id.toString(),
          message: populatedMessage,
        });

        try {
          const senderName = req.user?.name || 'Host';
          await sendNotification({
            recipientId: participantId,
            title: `New message from ${senderName}`,
            message: messageText.length > 80 ? `${messageText.substring(0, 77)}...` : messageText,
            type: 'NEW_MESSAGE',
            data: {
              chatId: chat._id.toString(),
              senderId: req.user._id.toString(),
              senderName: senderName,
            },
          });
        } catch (notifErr) {
          logger.warn('Failed to dispatch chat message notification', { error: notifErr.message });
        }
      }
    }

    res.status(201).json({
      success: true,
      data: { message: populatedMessage },
    });
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await Message.updateMany(
      { chat: req.params.id, sender: { $ne: req.user._id }, readAt: null },
      { $set: { readAt: now } }
    );

    if (result.modifiedCount > 0) {
      try {
        const io = getIO();
        io.to(`chat_${req.params.id}`).emit('message:read', {
          chatId: req.params.id,
          readBy: req.user._id,
          readAt: now,
        });

        const chat = await Chat.findById(req.params.id).select('participants');
        if (chat?.participants) {
          chat.participants.forEach((pId) => {
            if (String(pId) !== String(req.user._id)) {
              emitToUser(pId.toString(), 'message:read', {
                chatId: req.params.id,
                readBy: req.user._id,
                readAt: now,
              });
            }
          });
        }
      } catch (ioErr) {
        // Socket may not be connected in tests
      }
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

export const reportChat = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Chat report received',
    });
  } catch (error) {
    next(error);
  }
};
