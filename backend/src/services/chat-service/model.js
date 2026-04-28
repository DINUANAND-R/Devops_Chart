const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, trim: true, default: '' },
    groupAvatar: { type: String, default: '' },
    groupDescription: { type: String, maxlength: 200, default: '' },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

chatSchema.index({ members: 1 });
chatSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
